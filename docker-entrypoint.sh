#!/bin/bash
set -euo pipefail

echo "🚀 Starting Yue Bot..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
attempt=0
max_attempts=60
until node -e "
  const net = require('node:net');
  const { URL } = require('node:url');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) process.exit(1);
  const u = new URL(databaseUrl);
  const host = u.hostname;
  const port = Number(u.port || 5432);

  const socket = net.connect({ host, port });
  const timeout = setTimeout(() => {
    socket.destroy();
    process.exit(1);
  }, 2000);

  socket.on('connect', () => {
    clearTimeout(timeout);
    socket.end();
    process.exit(0);
  });

  socket.on('error', () => {
    clearTimeout(timeout);
    process.exit(1);
  });
"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "ERROR: PostgreSQL did not become ready in time"
    exit 1
  fi
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run migrations
echo "🔄 Running database migrations..."
pnpm --filter @yuebot/database exec prisma migrate deploy

# Inject runtime environment variables into frontend
echo "🔧 Injecting frontend environment variables..."
/inject-env.sh

echo "🎉 Starting all services..."

# Execute CMD
exec "$@"
