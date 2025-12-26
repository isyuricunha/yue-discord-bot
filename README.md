# Yue Bot Discord

Bot para Discord com:

- **Bot** (Discord.js) para moderação e sorteios
- **API** (Fastify) consumida pelo painel
- **Web UI** (React + Vite) para gerenciar/configurar

Monorepo `pnpm` com workspaces:

```
apps/
  api/   (Fastify)
  bot/   (Discord.js)
  web/   (React + Vite)
packages/
  database/ (Prisma)
  shared/   (utils/schemas compartilhados)
```

## Stack (atual)

- **Node.js**: 24+
- **pnpm**: 10+
- **TypeScript**: 5.9+
- **Prisma**: 7+
- **Fastify**: 5+
- **Discord.js**: 14+
- **React**: 19+
- **Vite**: 7+
- **TailwindCSS**: 4+
- **ESLint**: 9 (flat config)

## 🚀 Quick Start

### Pré-requisitos

- Node.js 24+
- pnpm 10+
- PostgreSQL (local ou remoto)
- App do Discord (token/clientId/clientSecret)

### 1) Instalar dependências

```bash
pnpm install
```

### 2) Configurar `.env`

```bash
cp .env.example .env
# Edite .env com suas credenciais
```

⚠️ Importante (monorepo): o **Web UI (Vite)** carrega variáveis de ambiente a partir de `apps/web/.env` (diretório do app), e **não** herda automaticamente o `.env` da raiz.

Para o painel:

```bash
cp apps/web/.env.example apps/web/.env
# Edite apps/web/.env (VITE_*) se necessário
```

### `.env.local` (opcional) - override local

Se você quiser rodar em ambiente local (HTTP) sem mexer no `.env` base (que pode estar configurado com URLs HTTPS/domínio), use um `.env.local`.

O loader do projeto carrega o `.env` e, se existir, carrega o `.env.local` em seguida (sobrescrevendo as variáveis).

```bash
cp .env.local.example .env.local
```

- `/.env.example`: exemplo com **HTTPS + domínio** (produção/ambiente realista)
- `/.env.local.example`: exemplo com **HTTP + IP/IP:porta** (dev/local)

### 3) Banco de dados (Prisma)

```bash
pnpm db:generate

# Para desenvolvimento (cria/atualiza schema direto)
pnpm db:push

# Para migrations (cria/aplica migrations)
pnpm db:migrate

# UI do Prisma
pnpm db:studio
```

### 4) Rodar em desenvolvimento

```bash
# Tudo em paralelo (bot + api + web)
pnpm dev

# Ou individual
pnpm dev:bot
pnpm dev:api
pnpm dev:web
```

### 5) URLs

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`

## Variáveis de ambiente (root)

O projeto usa um `.env` na raiz. Comece copiando `.env.example`.

### Web UI (Vite) - `.env` próprio

O app do painel (`apps/web`) usa Vite, então as variáveis do frontend precisam:

- Estar no arquivo `apps/web/.env` (copie de `apps/web/.env.example`), e
- Começar com o prefixo `VITE_` (ex: `VITE_API_URL`).

Se você apenas definir `VITE_API_URL` no `.env` da raiz, **não é garantido** que o Vite vá ler, porque ele resolve o `.env` relativo ao diretório do app.

Obrigatórias para rodar tudo local:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DATABASE_URL=
JWT_SECRET=
INTERNAL_API_SECRET=
```

Observações:

- `DISCORD_REDIRECT_URI` precisa bater com a rota de callback OAuth da API (`/api/auth/callback`).
- `WEB_URL` e `API_URL` são usados para CORS e redirects.

## Scripts (monorepo)

```bash
pnpm dev
pnpm build
pnpm lint
pnpm type-check

pnpm dev:bot
pnpm dev:api
pnpm dev:web

pnpm db:generate
pnpm db:push
pnpm db:migrate
pnpm db:studio
```

## Deploy de Slash Commands

Quando você criar/alterar comandos do bot, registre no Discord:

```bash
pnpm --filter @yuebot/bot deploy-commands
```

## Docker (produção)

Este repo inclui um container único com **nginx + api + bot** (supervisor).

Arquivos relevantes:

- `Dockerfile`
- `docker-compose.yml`
- `docker-entrypoint.sh` (aguarda DB e roda `prisma migrate deploy`)
- `inject-env.sh` (gera `/usr/share/nginx/html/env.js`)

### Como rodar

1) Copie `.env.docker.example` (ou configure as env vars no compose).

2) Suba o compose:

```bash
docker-compose up -d
docker-compose logs -f
```

### Runtime env no frontend

No Docker, o frontend lê a configuração em tempo de execução via `window.__ENV__` carregado de `/env.js`.

- `VITE_API_URL` -> `window.__ENV__.apiUrl`
- `VITE_DISCORD_CLIENT_ID` -> `window.__ENV__.discordClientId`

## Troubleshooting

- Se o bot não responder a slash commands, rode `deploy-commands`.
- Se `pnpm db:generate` falhar por env, confirme `DATABASE_URL` no `.env`.
- No Docker, a API é servida atrás do nginx em `/api` e o frontend precisa de `VITE_API_URL` apontando para o host correto.
