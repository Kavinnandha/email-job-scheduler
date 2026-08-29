import { createApp } from './app.js';
import { env } from './config/env.js';
import { initEmailSearch } from './search/emails.js';
import { createLogger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';
import { ensureSenderPool } from './mail/senders.js';
import { startWorker, stopWorker } from './queue/runWorker.js';

const log = createLogger('server');

/**
 * Single-process entrypoint: API, SPA and BullMQ consumer in one Node process.
 *
 * The two-process split (index.ts + worker.ts) is the better shape and stays
 * the default - the API can restart without pausing delivery. This entrypoint
 * exists for hosts whose free tier only grants one always-on process, where
 * the alternative is not "two processes" but "no worker at all". The tradeoff
 * is real and worth naming: an API restart here also restarts the consumer,
 * and reconcileQueue() on boot is what makes that survivable.
 */
async function main() {
  await initEmailSearch();
  await ensureSenderPool();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    log.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
  });

  const worker = await startWorker();

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down server');
    // HTTP first: stop accepting new work before draining what is in flight.
    server.close();
    await stopWorker(worker);
    await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'server failed to start');
  process.exit(1);
});
