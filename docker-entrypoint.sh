#!/bin/bash
set -e

echo "🚀 Starting Yue Bot..."

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
until pnpm --filter @yuebot/database exec prisma migrate status 2>/dev/null; do
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
