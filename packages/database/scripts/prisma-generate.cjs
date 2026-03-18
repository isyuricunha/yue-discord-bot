const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Lock file path for preventing parallel prisma generate on Windows
const LOCK_FILE_PATH = path.resolve(__dirname, '../.prisma-generate.lock');
const LOCK_TIMEOUT_MS = 60000; // 60 seconds timeout
const LOCK_CHECK_INTERVAL_MS = 100; // Check every 100ms

function safe_error_details(error) {
  if (error && typeof error === 'object') {
    return {
      name: typeof error.name === 'string' ? error.name : undefined,
      message: typeof error.message === 'string' ? error.message : 'Unknown error',
      code: typeof error.code === 'string' ? error.code : undefined,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Unknown error' };
}

/**
 * Acquires a lock file to prevent parallel prisma generate execution.
 * On Windows, prisma generate uses file locking that conflicts when run in parallel.
 * @returns {boolean} true if lock was acquired, false if timeout
 */
function acquireLock() {
  const startTime = Date.now();

  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    try {
      // Try to create the lock file exclusively
      fs.writeFileSync(LOCK_FILE_PATH, String(process.pid), { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock file exists, check if it's stale (older than 5 minutes)
        try {
          const stats = fs.statSync(LOCK_FILE_PATH);
          const age = Date.now() - stats.mtimeMs;
          if (age > 300000) {
            // Lock is older than 5 minutes, remove it and try again
            fs.unlinkSync(LOCK_FILE_PATH);
            continue;
          }
        } catch {
          // File might have been deleted, try again
        }

        // Wait and retry
        // eslint-disable-next-line no-console
        console.log('Waiting for prisma generate lock...');
        // Use synchronous sleep alternative
        const start = Date.now();
        while (Date.now() - start < LOCK_CHECK_INTERVAL_MS) {
          // busy wait
        }
      } else if (err.code === 'EBUSY' || err.code === 'ENOENT') {
        // File busy or doesn't exist, retry
        const start = Date.now();
        while (Date.now() - start < LOCK_CHECK_INTERVAL_MS) {
          // busy wait
        }
      } else {
        throw err;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.error('Failed to acquire lock for prisma generate after timeout');
  return false;
}

/**
 * Releases the lock file
 */
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
    // eslint-disable-next-line no-unused-vars
  } catch (_err) {
    // Ignore errors when releasing lock
  }
}

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

// Acquire lock before running prisma generate
if (!acquireLock()) {
  process.exit(1);
}

let exitCode = 0;

try {
  const prismaPackageJsonPath = require.resolve('prisma/package.json');
  const prismaPackageDir = path.dirname(prismaPackageJsonPath);
  const prismaCliPath = path.join(prismaPackageDir, 'build', 'index.js');

  const result = spawnSync(process.execPath, [prismaCliPath, 'generate'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });

  if (result.error) {
    // eslint-disable-next-line no-console
    console.error('Failed to run prisma generate:', safe_error_details(result.error));
    exitCode = 1;
  } else if (typeof result.status === 'number' && result.status !== 0) {
    // eslint-disable-next-line no-console
    console.error(`prisma generate exited with code ${result.status}`);
    exitCode = result.status;
  }
} finally {
  releaseLock();
}

process.exit(exitCode);
