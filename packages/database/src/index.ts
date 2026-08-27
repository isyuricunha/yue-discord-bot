import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Singleton para evitar múltiplas instâncias
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prismaAdapter = new PrismaPg(pgPool as any);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: prismaAdapter,
    // In production, Prisma query-engine errors are surfaced by the thrown
    // exception and logged by the service that owns the operation. Keeping
    // engine-level `error` logging enabled also prints transient SERIALIZABLE
    // conflicts before the application retry layer can recover them, which
    // makes healthy retries look like failures in container logs.
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export types
export * from '@prisma/client';
