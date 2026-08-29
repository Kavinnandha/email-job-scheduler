import { createLogger } from './lib/logger.js';
import { initEmailSearch } from './search/emails.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';
import { ensureSenderPool } from './mail/senders.js';
import { startWorker, stopWorker } from './queue/runWorker.js';

const log = createLogger('worker-main');

async function main() {
  await initEmailSearch();
  await ensureSenderPool();

  const worker = await startWorker();

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down worker');
    await stopWorker(worker);
    await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'worker failed to start');
  process.exit(1);
});
