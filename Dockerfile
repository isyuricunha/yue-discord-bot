# Multi-service Dockerfile - API + Bot + Web em um único container
FROM node:24-slim AS builder

# Install build dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build packages primeiro (ordem importa!)
RUN pnpm --filter @yuebot/shared build
RUN pnpm --filter @yuebot/database build

# Build apps
RUN pnpm --filter @yuebot/api build
RUN echo "API build output:" && ls -la /app/apps/api/dist/ || echo "No dist folder for API"
RUN pnpm --filter @yuebot/bot build
RUN echo "Bot build output:" && ls -la /app/apps/bot/dist/ || echo "No dist folder for Bot"
RUN pnpm --filter @yuebot/web build
RUN echo "Web build output:" && ls -la /app/apps/web/dist/ || echo "No dist folder for Web"

# Production stage
FROM node:24-slim

# Install nginx, supervisor, OpenSSL, wget and other dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    openssl \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/

# Install all dependencies (need devDeps for Prisma generation)
# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy Prisma schema for migrations
COPY packages/database/prisma ./packages/database/prisma

# Generate Prisma Client (prisma already in node_modules from install)
RUN cd packages/database && pnpm exec prisma generate

# Setup Nginx for web frontend
RUN mkdir -p /var/www/html
COPY nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
RUN rm -f /etc/nginx/sites-enabled/default.dpkg-dist
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Setup Supervisor
COPY supervisord.conf /etc/supervisord.conf

# Create startup scripts
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY inject-env.sh /inject-env.sh
RUN chmod +x /docker-entrypoint.sh /inject-env.sh

# Expose ports
EXPOSE 80 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start all services with supervisor
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
