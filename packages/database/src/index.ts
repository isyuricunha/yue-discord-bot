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

const prismaAdapter = new PrismaPg(pgPool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: prismaAdapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export types
export * from '@prisma/client';
