import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
// Single .env at the repo root, shared by the API and the worker process.
loadDotenv({ path: path.resolve(here, '../../../../.env') });

/** Accepts "5" or 5 and rejects NaN, so a typo in .env fails at boot. */
const intFromEnv = (fallback: number, min = 0) =>
  z.coerce.number().int().min(min).default(fallback);

const smtpSenderSchema = z.object({
  name: z.string().min(1),
  fromEmail: z.string().email(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().positive(),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
});

export type SmtpSenderConfig = z.infer<typeof smtpSenderSchema>;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: intFromEnv(4000, 1),
  BACKEND_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:4000/api/auth/google/callback'),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().url().default('http://localhost:4000/api/slack/callback'),

  // --- Throughput knobs. Every one of these is read from env, never inlined.
  WORKER_CONCURRENCY: intFromEnv(5, 1),
  DELAY_BETWEEN_EMAILS_MS: intFromEnv(2000, 0),
  MAX_EMAILS_PER_HOUR_PER_SENDER: intFromEnv(200, 1),
  /** 0 disables the cross-sender ceiling. */
  MAX_EMAILS_PER_HOUR_GLOBAL: intFromEnv(0, 0),
  DEFAULT_CAMPAIGN_HOURLY_LIMIT: intFromEnv(100, 1),
  ORDER_STEP_MS: intFromEnv(250, 0),

  SENDER_COUNT: intFromEnv(3, 1),
  /** JSON array of SMTP accounts. Empty => auto-provision Ethereal accounts. */
  SMTP_SENDERS: z
    .string()
    .default('')
    .transform((raw, ctx) => {
      if (!raw.trim()) return [] as SmtpSenderConfig[];
      try {
        return z.array(smtpSenderSchema).parse(JSON.parse(raw));
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SMTP_SENDERS is not a valid JSON array of SMTP accounts: ${String(err)}`,
        });
        return z.NEVER;
      }
    }),

  BULL_BOARD_USER: z.string().default('admin'),
  BULL_BOARD_PASS: z.string().default('admin'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail loudly at boot rather than surfacing as a confusing runtime error later.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

/** True only when both halves of a Google OAuth app are configured. */
export const googleOAuthConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** True only when both halves of a Slack app are configured. */
export const slackOAuthConfigured = Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);

export const QUEUE_NAME = 'email-send';
