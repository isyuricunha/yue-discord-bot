type runtime_env = {
  apiUrl?: string
  discordClientId?: string
}

declare global {
  interface Window {
    __ENV__?: runtime_env
  }
}

export function getApiUrl() {
  return window.__ENV__?.apiUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
}

export function getDiscordClientId() {
  return window.__ENV__?.discordClientId ?? import.meta.env.VITE_DISCORD_CLIENT_ID
}
