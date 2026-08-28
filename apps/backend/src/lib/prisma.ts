import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env.js';

/**
 * Reused across hot reloads in dev so `tsx watch` does not leak connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
