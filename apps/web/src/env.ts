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
  const configured = window.__ENV__?.apiUrl ?? import.meta.env.VITE_API_URL
  if (typeof configured === 'string') return configured

  // In production, prefer same-origin requests by default.
  // In development, keep a sensible localhost default.
  return import.meta.env.DEV ? 'http://localhost:3000' : ''
}

export function getDiscordClientId() {
  return window.__ENV__?.discordClientId ?? import.meta.env.VITE_DISCORD_CLIENT_ID
}
