import { createApp } from './app.js';
import { env } from './config/env.js';
import { initEmailSearch } from './search/emails.js';
import { createLogger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';
import { ensureSenderPool } from './mail/senders.js';

const log = createLogger('api');

async function main() {
  // Both are idempotent and safe to run on every boot in either process.
  await initEmailSearch();
  await ensureSenderPool();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    log.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
  });

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down api');
    server.close();
    await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'api failed to start');
  process.exit(1);
});
