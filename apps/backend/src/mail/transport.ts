import nodemailer, { type Transporter } from 'nodemailer';
import type { Sender } from '@prisma/client';
import { createLogger } from '../lib/logger.js';

const log = createLogger('smtp');

/**
 * One pooled transporter per sender, reused for the lifetime of the process.
 * Building a transporter per send would open a fresh TCP+TLS connection every
 * time, which is both slow and a good way to get throttled by a real provider.
 */
const transporters = new Map<string, Transporter>();

export function getTransport(sender: Sender): Transporter {
  const existing = transporters.get(sender.id);
  if (existing) return existing;

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    // Ethereal uses STARTTLS on 587; secure is only for implicit TLS on 465.
    secure: sender.smtpPort === 465,
    auth: { user: sender.smtpUser, pass: sender.smtpPass },
    pool: true,
    // Connection reuse is capped low on purpose: the scheduler's own send-slot
    // reservation is what paces delivery, so the pool never needs to burst.
    maxConnections: 3,
    maxMessages: 100,
  });

  transporters.set(sender.id, transporter);
  log.debug({ senderId: sender.id, host: sender.smtpHost }, 'created smtp transport');
  return transporter;
}

export function closeAllTransports(): void {
  for (const transporter of transporters.values()) transporter.close();
  transporters.clear();
}
