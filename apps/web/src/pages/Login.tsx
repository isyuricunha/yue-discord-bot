import { useCallback, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { Users, Server, ExternalLink, Info } from 'lucide-react'

import { getApiUrl, getDiscordClientId } from '../env'
import { Button, StatCard, Card, CardContent } from '../components/ui'
import { Seo } from '../components/seo/seo'
import { useBotStats } from '../hooks/useBotStats'
import { formatNumber } from '../lib/format_number'
import { toast_error } from '../store/toast'

export default function LoginPage() {
  const { stats, loading: statsLoading, error: statsError } = useBotStats()
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  const API_URL = useMemo(() => getApiUrl(), [])
  const inviteLink = useMemo(() => {
    const clientId = getDiscordClientId()
    return clientId
      ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=8`
      : null
  }, [])

  const handleLogin = useCallback(() => {
    if (!API_URL) {
      toast_error('URL de autenticação não disponível')
      return
    }
    setIsLoginLoading(true)
    window.location.href = `${API_URL}/api/auth/login`
  }, [API_URL])

  const handleInvite = useCallback(() => {
    if (inviteLink) {
      const newWindow = window.open(inviteLink, '_blank', 'noopener,noreferrer')
      if (!newWindow) {
        toast_error('Permita popups para abrir o convite do bot')
        void navigator.clipboard.writeText(inviteLink)
        toast_error('Link copiado para área de transferência!')
      }
    }
  }, [inviteLink])

  const hasVersion = Boolean(stats?.version)

  return (
    <>
      <Seo />
      <div className="min-h-screen bg-background flex flex-col">
        {/* Background consistente com AppShell */}
        <div
          className="fixed inset-0 overflow-hidden"
          role="img"
          aria-label="Fundo decorativo com gradientes e padrões geométricos"
        >
          <div
            className="absolute -top-1/2 -left-1/4 h-[800px] w-[800px] rounded-full bg-accent/8 blur-[80px] animate-pulse"
            style={{ animationDuration: '8s' }}
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-1/2 -right-1/4 h-[600px] w-[600px] rounded-full bg-accent/5 blur-[80px] animate-pulse"
            style={{ animationDuration: '12s' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"
            aria-hidden="true"
          />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Header com logo e navegação */}
          <header className="flex w-full items-center justify-between px-6 py-5" role="banner">
            <NavLink
              to="/extras"
              className="flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Ir para página inicial do Yue Bot"
            >
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-border/80 bg-surface/60 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                <img src="/icon.png" alt="" className="h-5 w-5 rounded" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">Yue Bot</span>
            </NavLink>

            <nav className="flex items-center gap-2">
              <NavLink
                to="/extras"
                className="inline-flex items-center rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface/40 hover:text-foreground"
              >
                Extras
              </NavLink>
            </nav>
          </header>

          {/* Conteúdo principal */}
          <main className="flex flex-1 items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
              {/* Logo e tagline */}
              <div className="text-center mb-8 animate-fadeIn">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-border/80 bg-surface/60 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                  <img src="/icon.png" alt="Yue Bot" className="h-10 w-10 rounded-xl" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-1">
                  Yue Bot
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie seu servidor com excelência
                </p>
                {hasVersion && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" aria-hidden="true" />
                    <span>v{stats!.version}</span>
                  </div>
                )}
              </div>

              {/* Stats cards */}
              <div
                className="grid grid-cols-2 gap-3 mb-6 animate-fadeIn"
                role="region"
                aria-label="Estatísticas do bot"
                aria-live="polite"
                aria-atomic="true"
              >
                <StatCard
                  icon={<Server className="h-5 w-5" />}
                  value={stats ? formatNumber(stats.servers) : '---'}
                  label="Servidores"
                  isLoading={statsLoading}
                />
                <StatCard
                  icon={<Users className="h-5 w-5" />}
                  value={stats ? formatNumber(stats.users) : '---'}
                  label="Usuários"
                  isLoading={statsLoading}
                />
              </div>

              {/* Erro das stats */}
              {statsError && (
                <div
                  className="mb-4 p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm text-center"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  {statsError}
                </div>
              )}

              {/* Card de login */}
              <Card className="animate-fadeIn border-border/60 shadow-2xl shadow-black/20">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Faça login com sua conta Discord para gerenciar seus servidores de forma simples e eficiente.
                    </p>
                  </div>

                  <Button
                    onClick={handleLogin}
                    size="lg"
                    className="w-full gap-2 !bg-[#5865F2] hover:!bg-[#4752C4] !text-white !border-none shadow-lg shadow-[#5865F2]/20 hover:shadow-[#5865F2]/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    isLoading={isLoginLoading}
                    disabled={isLoginLoading || !API_URL}
                    aria-label="Entrar com Discord para acessar o painel de controle"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <title>Discord Logo</title>
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      <span>Entrar com Discord</span>
                    </span>
                  </Button>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/40" aria-hidden="true" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-surface/50 px-2 text-muted-foreground/50">ou</span>
                    </div>
                  </div>

                  {inviteLink && (
                    <Button
                      onClick={handleInvite}
                      size="lg"
                      variant="outline"
                      className="w-full border-accent/30 text-foreground hover:bg-accent/10 hover:border-accent/50 transition-all duration-300"
                      aria-label="Convidar o Yue Bot para o seu servidor Discord"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                      <span>Convidar Bot</span>
                    </Button>
                  )}

                  <p className="mt-4 text-center text-xs text-muted-foreground/70">
                    Ao fazer login, você concorda com nossos{' '}
                    <NavLink
                      to="/termos"
                      className="text-foreground/70 underline underline-offset-2 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                      aria-label="Abrir página de termos de serviço"
                    >
                      termos
                    </NavLink>{' '}
                    e{' '}
                    <NavLink
                      to="/privacidade"
                      className="text-foreground/70 underline underline-offset-2 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                      aria-label="Abrir página de política de privacidade"
                    >
                      política de privacidade
                    </NavLink>
                    .
                  </p>
                </CardContent>
              </Card>

              {/* Footer de links */}
              <nav
                className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground animate-fadeIn"
                aria-label="Links adicionais"
              >
                <NavLink
                  to="/extras"
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Sobre
                </NavLink>
                <span className="opacity-30" aria-hidden="true">•</span>
                <NavLink
                  to="/extras/comandos"
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Comandos
                </NavLink>
                <span className="opacity-30" aria-hidden="true">•</span>
                <NavLink
                  to="/extras/placeholders"
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Placeholders
                </NavLink>
                <span className="opacity-30" aria-hidden="true">•</span>
                <NavLink
                  to="/termos"
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Termos
                </NavLink>
                <span className="opacity-30" aria-hidden="true">•</span>
                <NavLink
                  to="/privacidade"
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Privacidade
                </NavLink>
              </nav>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
