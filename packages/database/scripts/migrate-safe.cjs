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

const migrationNameArgIndex = process.argv.indexOf('--name');
const migrationName = migrationNameArgIndex !== -1 ? process.argv[migrationNameArgIndex + 1] : null;

if (!migrationName || typeof migrationName !== 'string' || !migrationName.trim()) {
  // eslint-disable-next-line no-console
  console.error('Missing required argument: --name <migration_name>');
  process.exit(1);
}

const safeSlug = migrationName
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

if (!safeSlug) {
  // eslint-disable-next-line no-console
  console.error('Invalid migration name.');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const migrationDirName = `${timestamp}_${safeSlug}`;

const pkgRoot = path.resolve(__dirname, '..');
const prismaDir = path.join(pkgRoot, 'prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const migrationsDir = path.join(prismaDir, 'migrations');
const targetDir = path.join(migrationsDir, migrationDirName);
const outputSqlPath = path.join(targetDir, 'migration.sql');

if (!fs.existsSync(schemaPath)) {
  // eslint-disable-next-line no-console
  console.error('schema.prisma not found at', schemaPath);
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

const prismaPackageJsonPath = require.resolve('prisma/package.json');
const prismaPackageDir = path.dirname(prismaPackageJsonPath);
const prismaCliPath = path.join(prismaPackageDir, 'build', 'index.js');

function runPrisma(args, opts = {}) {
  const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
    stdio: 'inherit',
    cwd: pkgRoot,
    env: process.env,
    ...opts,
  });

  if (result.error) {
    // eslint-disable-next-line no-console
    console.error('Failed to run prisma:', result.error);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    return { ok: false, status: result.status };
  }

  return { ok: true };
}

// First, apply any existing migrations from the repo. This prevents duplicate
// timestamped migrations when changes are already covered by an existing folder.
const initialDeployResult = runPrisma(['migrate', 'deploy']);
if (!initialDeployResult.ok) {
  process.exit(initialDeployResult.status ?? 1);
}

// Fast path: check if diff is empty before creating a migration folder.
const exitCodeResult = runPrisma([
  'migrate',
  'diff',
  '--from-config-datasource',
  '--to-schema',
  schemaPath,
  '--exit-code',
]);

// exit-code behavior: empty=0, error=1, not empty=2
if (!exitCodeResult.ok && exitCodeResult.status === 2) {
  // proceed
} else if (exitCodeResult.ok) {
  // eslint-disable-next-line no-console
  console.log('✅ no schema changes detected; no migration generated');
  process.exit(0);
} else {
  process.exit(exitCodeResult.status ?? 1);
}

fs.mkdirSync(targetDir, { recursive: true });

// Generate SQL migration based on live datasource -> schema (no shadow DB required).
const diffResult = runPrisma([
  'migrate',
  'diff',
  '--from-config-datasource',
  '--to-schema',
  schemaPath,
  '--script',
  '--output',
  outputSqlPath,
]);

if (!diffResult.ok) {
  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  process.exit(diffResult.status ?? 1);
}

// Apply via deploy (doesn't require shadow DB)
const deployResult = runPrisma(['migrate', 'deploy']);
if (!deployResult.ok) {
  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  process.exit(deployResult.status ?? 1);
}

// eslint-disable-next-line no-console
console.log(`✅ migration generated and applied: ${migrationDirName}`);
