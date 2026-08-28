import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sender } from '@prisma/client';
import { env, type SmtpSenderConfig } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const log = createLogger('senders');

const here = path.dirname(fileURLToPath(import.meta.url));
/**
 * Cached Ethereal credentials. Ethereal issues a brand new inbox on every
 * createTestAccount() call, so without this file each restart would strand
 * previously sent mail in an inbox nobody can open again.
 */
const CACHE_FILE = path.resolve(here, '../../../../.ethereal-accounts.json');

async function readCachedAccounts(): Promise<SmtpSenderConfig[]> {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SmtpSenderConfig[]) : [];
  } catch {
    return [];
  }
}

async function writeCachedAccounts(accounts: SmtpSenderConfig[]): Promise<void> {
  await fs.writeFile(CACHE_FILE, JSON.stringify(accounts, null, 2), 'utf8');
}

const ETHEREAL_API = 'https://api.nodemailer.com/user';

interface EtherealAccount {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
}

/**
 * Calls the Ethereal API directly instead of nodemailer's createTestAccount().
 * createTestAccount() memoises its result for the lifetime of the process, so
 * asking it for N accounts returns the SAME inbox N times - which then
 * collapses to a single row on the fromEmail upsert, leaving the "multiple
 * senders" requirement quietly unsatisfied. The raw endpoint issues a
 * genuinely distinct mailbox per call.
 */
async function createEtherealAccount(): Promise<EtherealAccount> {
  const response = await fetch(ETHEREAL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestor: 'email-job-scheduler', version: '1.0.0' }),
  });

  if (!response.ok) {
    throw new Error(`Ethereal account creation failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as EtherealAccount;
}

async function provisionEtherealAccounts(
  count: number,
  startIndex: number,
): Promise<SmtpSenderConfig[]> {
  const accounts: SmtpSenderConfig[] = [];

  for (let i = 0; i < count; i += 1) {
    const account = await createEtherealAccount();
    accounts.push({
      name: `Sender ${startIndex + i + 1}`,
      fromEmail: account.user,
      smtpHost: account.smtp.host,
      smtpPort: account.smtp.port,
      smtpUser: account.user,
      smtpPass: account.pass,
    });
    log.info({ index: startIndex + i + 1, user: account.user }, 'provisioned ethereal account');
  }

  return accounts;
}

/**
 * Resolves the sender pool, in priority order:
 *   1. SMTP_SENDERS env var (real accounts, explicit)
 *   2. cached Ethereal accounts from a previous boot
 *   3. freshly provisioned Ethereal accounts
 *
 * Idempotent: safe to run in both the API and worker processes, and on every
 * restart. Senders are upserted on fromEmail so the pool converges rather
 * than growing.
 */
export async function ensureSenderPool(): Promise<Sender[]> {
  let configs: SmtpSenderConfig[] = env.SMTP_SENDERS;
  let source = 'env';

  if (configs.length === 0) {
    // Drop any duplicates left by an older build that used the memoising
    // createTestAccount(), so an existing cache heals itself on next boot.
    const cached = await readCachedAccounts();
    configs = cached.filter(
      (acc, i) => cached.findIndex((other) => other.fromEmail === acc.fromEmail) === i,
    );
    source = 'cache';
  }

  if (configs.length < env.SENDER_COUNT) {
    const missing = env.SENDER_COUNT - configs.length;
    log.info({ missing }, 'provisioning ethereal accounts');
    const fresh = await provisionEtherealAccounts(missing, configs.length);
    configs = [...configs, ...fresh];
    await writeCachedAccounts(configs);
    source = source === 'cache' ? 'cache+new' : 'new';
  }

  const senders: Sender[] = [];
  for (const config of configs) {
    const sender = await prisma.sender.upsert({
      where: { fromEmail: config.fromEmail },
      create: { ...config, active: true },
      update: {
        name: config.name,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
      },
    });
    senders.push(sender);
  }

  log.info({ count: senders.length, source }, 'sender pool ready');
  return senders;
}

export async function listActiveSenders(): Promise<Sender[]> {
  // Stable ordering: round-robin assignment must be deterministic so a
  // campaign's sender distribution is reproducible.
  return prisma.sender.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } });
}
