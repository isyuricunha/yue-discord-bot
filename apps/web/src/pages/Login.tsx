import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { Shield, Users, Server, ExternalLink } from 'lucide-react'

import { getApiUrl, getDiscordClientId } from '../env'
import { Button } from '../components/ui'

const API_URL = getApiUrl()

interface BotStats {
  servers: number
  users: number
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export default function LoginPage() {
  const [stats, setStats] = useState<BotStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  useEffect(() => {
    // Fetch bot stats
    const fetchStats = async () => {
      try {
        const apiUrl = getApiUrl() // Get API URL inside useEffect to ensure env is loaded
        const response = await fetch(`${apiUrl}/api/bot/stats`)
        if (response.ok) {
          const data = await response.json()
          // Extract stats from the API response (which includes 'success' wrapper)
          // API returns: { success: true, servers: number, users: number }
          if (data && typeof data.servers === 'number' && typeof data.users === 'number') {
            setStats({ servers: data.servers, users: data.users })
          } else {
            console.warn('Invalid stats response:', data)
          }
        } else {
          console.warn('Failed to fetch stats:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Failed to fetch bot stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }

    // Set up invite link
    const clientId = getDiscordClientId()
    if (clientId) {
      setInviteLink(`https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=8`)
    }

    fetchStats()
  }, [])

  const handleLogin = () => {
    window.location.href = `${API_URL}/api/auth/login`
  }

  const handleInvite = () => {
    if (inviteLink) {
      window.open(inviteLink, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Refined geometric background */}
      <div className="fixed inset-0 overflow-hidden">
        {/* Primary gradient orbs */}
        <div className="absolute -top-1/2 -left-1/4 h-[800px] w-[800px] rounded-full bg-accent/8 blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-1/2 -right-1/4 h-[600px] w-[600px] rounded-full bg-accent/5 blur-[140px] animate-pulse" style={{ animationDuration: '12s' }} />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header - minimal */}
        <header className="flex w-full items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Yue Bot</span>
          </div>
        </header>

        {/* Centered login card */}
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            {/* Logo/Brand section */}
            <div className="text-center mb-8 animate-[fadeIn_600ms_ease-out]">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-1">
                Yue Bot
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seu servidor com excelência
              </p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3 mb-6 animate-[fadeIn_400ms_ease-out_100ms_both]">
              <div className="rounded-xl border border-border/60 bg-surface/40 backdrop-blur-xl p-4 text-center transition-all duration-300 hover:border-accent/30 hover:bg-surface/60">
                <Server className="h-5 w-5 mx-auto mb-2 text-accent/80" />
                <div className="text-2xl font-bold text-foreground">
                  {statsLoading ? (
                    <span className="animate-pulse">---</span>
                  ) : stats ? (
                    formatNumber(stats.servers)
                  ) : (
                    '---'
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Servidores</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface/40 backdrop-blur-xl p-4 text-center transition-all duration-300 hover:border-accent/30 hover:bg-surface/60">
                <Users className="h-5 w-5 mx-auto mb-2 text-accent/80" />
                <div className="text-2xl font-bold text-foreground">
                  {statsLoading ? (
                    <span className="animate-pulse">---</span>
                  ) : stats ? (
                    formatNumber(stats.users)
                  ) : (
                    '---'
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Usuários</div>
              </div>
            </div>

            {/* Login card */}
            <div
              className="rounded-2xl border border-border/60 bg-surface/40 backdrop-blur-xl p-6 shadow-2xl shadow-black/20 animate-[fadeIn_400ms_ease-out_200ms_both]"
            >
              {/* Description */}
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Faça login com sua conta Discord para gerenciar seus servidores de forma simples e eficiente.
                </p>
              </div>

              {/* Discord Login Button - prominent */}
              <Button
                onClick={handleLogin}
                size="lg"
                className="w-full gap-2 !bg-[#5865F2] hover:!bg-[#4752C4] !text-white !border-none shadow-lg shadow-[#5865F2]/20 hover:shadow-[#5865F2]/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span>Entrar com Discord</span>
                </span>
              </Button>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-surface/40 px-2 text-muted-foreground/50">ou</span>
                </div>
              </div>

              {/* Invite Button */}
              {inviteLink && (
                <Button
                  onClick={handleInvite}
                  size="lg"
                  variant="outline"
                  className="w-full border-accent/30 text-foreground hover:bg-accent/10 hover:border-accent/50 transition-all duration-300"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span>Convidar Bot</span>
                </Button>
              )}

              {/* Terms notice */}
              <p className="mt-4 text-center text-xs text-muted-foreground/70">
                Ao fazer login, você concorda com nossos{' '}
                <NavLink
                  to="/termos"
                  className="text-foreground/70 underline underline-offset-2 hover:text-accent transition-colors"
                >
                  termos
                </NavLink>{' '}
                e{' '}
                <NavLink
                  to="/privacidade"
                  className="text-foreground/70 underline underline-offset-2 hover:text-accent transition-colors"
                >
                  política de privacidade
                </NavLink>
                .
              </p>
            </div>

            {/* Footer links */}
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground animate-[fadeIn_600ms_ease-out_400ms_both]">
              <NavLink
                to="/extras"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Shield className="h-3 w-3" />
                <span>Ver Extras</span>
              </NavLink>
              <span className="opacity-30">•</span>
              <NavLink
                to="/extras"
                className="hover:text-foreground transition-colors"
              >
                FAQ
              </NavLink>
              <span className="opacity-30">•</span>
              <NavLink
                to="/extras/placeholders"
                className="hover:text-foreground transition-colors"
              >
                Placeholders
              </NavLink>
              <span className="opacity-30">•</span>
              <NavLink
                to="/extras/comandos"
                className="hover:text-foreground transition-colors"
              >
                Guias
              </NavLink>
            </nav>
          </div>
        </main>
      </div>
    </div>
  )
}
