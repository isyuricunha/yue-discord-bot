import { defineConfig } from 'prisma/config';

const database_url =
  process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/dummy?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: database_url,
  },
});
