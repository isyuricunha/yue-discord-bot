#!/bin/bash
# Inject runtime environment variables into the frontend build

set -euo pipefail

echo "🔧 Injecting runtime environment variables..."

env_file="/usr/share/nginx/html/env.js"

ENV_FILE="$env_file" node - <<'NODE'
const fs = require('node:fs')

const env = {
  apiUrl: process.env.VITE_API_URL ?? '',
  discordClientId: process.env.VITE_DISCORD_CLIENT_ID ?? '',
}

const content = `window.__ENV__ = ${JSON.stringify(env, null, 2)};\n`
fs.writeFileSync(process.env.ENV_FILE, content, 'utf8')
NODE

echo "✅ Environment variables injected successfully!"
