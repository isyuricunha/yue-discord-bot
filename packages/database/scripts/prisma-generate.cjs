const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootEnvPath = path.resolve(__dirname, '../../../.env');
const rootEnvLocalPath = path.resolve(__dirname, '../../../.env.local');

if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
}

if (fs.existsSync(rootEnvLocalPath)) {
  require('dotenv').config({ path: rootEnvLocalPath, override: true });
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/dummy?schema=public';
}

const prismaPackageJsonPath = require.resolve('prisma/package.json');
const prismaPackageDir = path.dirname(prismaPackageJsonPath);
const prismaCliPath = path.join(prismaPackageDir, 'build', 'index.js');

const result = spawnSync(process.execPath, [prismaCliPath, 'generate'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

if (result.error) {
  // eslint-disable-next-line no-console
  console.error('Failed to run prisma generate:', result.error);
}

if (typeof result.status === 'number' && result.status !== 0) {
  // eslint-disable-next-line no-console
  console.error(`prisma generate exited with code ${result.status}`);
}

process.exit(result.status ?? 1);
