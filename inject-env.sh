#!/bin/bash
# Inject runtime environment variables into the frontend build

echo "🔧 Injecting runtime environment variables..."

env_file="/usr/share/nginx/html/env.js"

cat > "$env_file" <<EOF
window.__ENV__ = {
  apiUrl: "${VITE_API_URL:-}",
  discordClientId: "${VITE_DISCORD_CLIENT_ID:-}",
};
EOF

echo "✅ Environment variables injected successfully!"
