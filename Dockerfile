# syntax=docker/dockerfile:1

# Multi-service Dockerfile - API + Bot + Web in one container.
FROM node:24-slim AS pnpm-base

# All dependency operations run non-interactively. In particular, the
# production install is allowed to prune the virtual store created by
# `pnpm fetch` without requiring a TTY.
ENV CI=true

# Prisma dependency lifecycle scripts inspect OpenSSL even during `pnpm fetch`.
# Keep it in the common base so dependency caching stays warning-free and the
# runtime inherits the same library without reinstalling it later.
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Fetch dependency tarballs from the lockfile once. Build and production
# installs branch from this stage and link their own node_modules offline.
# This layer survives source and package.json changes while the lockfile stays
# unchanged.
FROM pnpm-base AS deps-cache

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile

# Install the full workspace once for compilation.
FROM deps-cache AS build-deps

COPY package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/livepix/package.json ./packages/livepix/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --offline --frozen-lockfile

# Build shared packages once. App-only changes can reuse this whole stage.
FROM build-deps AS packages-builder

COPY tsconfig.json ./
COPY packages ./packages
RUN pnpm --filter @yuebot/shared build \
    && pnpm --filter @yuebot/livepix build \
    && pnpm --filter @yuebot/database build

# Build each app in an independent stage so a Web-only change does not rebuild
# the API or Bot, and vice versa.
FROM packages-builder AS api-builder
COPY apps/api ./apps/api
RUN pnpm --filter @yuebot/api exec tsup

FROM packages-builder AS bot-builder
COPY apps/bot ./apps/bot
RUN pnpm --filter @yuebot/bot exec tsup

FROM packages-builder AS web-builder
COPY apps/web ./apps/web
RUN pnpm --filter @yuebot/web exec tsc \
    && pnpm --filter @yuebot/web exec vite build

# Prune/link only runtime dependencies from the already fetched virtual store.
# The clean runtime stage below copies this production /app tree, never the
# full build-dependency tree.
FROM deps-cache AS prod-deps

COPY package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/livepix/package.json ./packages/livepix/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/
RUN pnpm install --prod --offline --frozen-lockfile

# Production stage starts from the clean pnpm base, not from build-deps. It
# retains pnpm for `prisma migrate deploy` in the entrypoint but receives only
# production workspace dependencies from prod-deps.
FROM pnpm-base AS runtime

RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app /app

# Copy built files from their independent build stages.
COPY --from=packages-builder /app/packages/database/dist ./packages/database/dist
COPY --from=packages-builder /app/packages/livepix/dist ./packages/livepix/dist
COPY --from=packages-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=bot-builder /app/apps/bot/dist ./apps/bot/dist
COPY --from=web-builder /app/apps/web/dist ./apps/web/dist

# Prisma schema/config are copied after dependency installation so normal
# application source changes do not invalidate production dependencies.
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/prisma.config.ts ./packages/database/prisma.config.ts
RUN cd packages/database && pnpm exec prisma generate

# Runtime prompt templates.
COPY prompts ./prompts

# Setup Nginx for the web frontend.
RUN mkdir -p /var/www/html
COPY nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default \
    && rm -f /etc/nginx/sites-enabled/default.dpkg-dist
COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html

# Setup Supervisor.
COPY supervisord.conf /etc/supervisord.conf

# Create startup scripts.
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY inject-env.sh /inject-env.sh
RUN chmod +x /docker-entrypoint.sh /inject-env.sh

EXPOSE 80 3000

# Container readiness: API + database + bot internal API + Discord client.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ready || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
