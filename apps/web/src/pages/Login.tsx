import { useEffect, useState, useCallback } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  Shield,
  Coins,
  Trophy,
  Music,
  Sparkles,
  Users,
  Heart,
  LayoutDashboard,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, CardHeader, Badge } from '../components/ui'

const API_URL = getApiUrl()

interface Feature {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Sparkles,
    title: 'Sistema de XP',
    description: 'Rankings,level-ups e recompensas automáticas',
  },
  {
    icon: Coins,
    title: 'Economia',
    description: 'Banco,Loja,itens e transações seguras',
  },
  {
    icon: Shield,
    title: 'Moderação',
    description: 'Autoraid,mutes,warns e logs automáticos',
  },
  {
    icon: Trophy,
    title: 'Sorteios',
    description: 'Sorteios com requisitos e múltiplos prêmios',
  },
  {
    icon: Music,
    title: 'Música',
    description: 'DJ mode,filas e controle de volume',
  },
  {
    icon: Users,
    title: 'Gestão',
    description: 'Tickets,reaction roles e bienvenidas',
  },
]

function ServerStats() {
  // Using static values since there's no public stats API
  // In production, this could be fetched from an endpoint like /api/stats
  const stats = {
    servers: '2,000+',
    users: '5M+',
    commands: '150+',
  }

  return (
    <div className="flex flex-wrap justify-center gap-6 text-center">
      <div className="flex flex-col items-center">
        <div className="text-2xl font-bold text-accent">{stats.servers}</div>
        <div className="text-xs text-muted-foreground">Servidores</div>
      </div>
      <div className="flex flex-col items-center">
        <div className="text-2xl font-bold text-accent">{stats.users}</div>
        <div className="text-xs text-muted-foreground">Usuários</div>
      </div>
      <div className="flex flex-col items-center">
        <div className="text-2xl font-bold text-accent">{stats.commands}</div>
        <div className="text-xs text-muted-foreground">Comandos</div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for OAuth errors in URL
  useEffect(() => {
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (errorParam) {
      // Handle specific OAuth errors
      const errorMessages: Record<string, string> = {
        access_denied: 'Login cancelado. Tente novamente.',
        rate_limited: 'Muitas tentativas. Aguarde um momento.',
        invalid_request: 'Requisição inválida. Tente novamente.',
        server_error: 'Erro no servidor. Tente novamente mais tarde.',
        temporarily_unavailable: 'Serviço temporariamente indisponível.',
      }

      const message = errorMessages[errorParam] || errorDescription || 'Erro na autenticação. Tente novamente.'
      setError(message)
    }
  }, [searchParams])

  const handleLogin = useCallback(() => {
    setIsLoading(true)
    setError(null)
    window.location.href = `${API_URL}/api/auth/login`
  }, [])

  // Keyboard accessibility - Enter key triggers login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        handleLogin()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleLogin, isLoading])

  // Clear error when user tries to login again
  const handleLoginAttempt = () => {
    if (!isLoading) {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute -bottom-52 right-[-120px] h-[520px] w-[520px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      {/* Header - consistent with PublicShell */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <img src="/icon.png" alt="Yue" className="h-6 w-6 rounded" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Yue</div>
              <div className="text-xs text-muted-foreground">Painel</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink
              to="/extras"
              className="inline-flex items-center rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface/70 hover:text-foreground"
            >
              Extras
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Login Card */}
          <div className="flex flex-col justify-center">
            <Card className="animate-[fadeIn_500ms_ease-out]">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <h1 className="text-xl font-semibold tracking-tight">Yue Bot</h1>
                      <p className="text-sm text-muted-foreground">Painel de Gerenciamento</p>
                    </div>
                  </div>
                  <Badge variant="accent">Beta</Badge>
                </div>

                {/* Error state display */}
                {error && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                    <div className="text-sm text-red-400">{error}</div>
                  </div>
                )}

                <div className="rounded-xl border border-border/80 bg-surface/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    Faça login com sua conta Discord para gerenciar seus servidores.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Button
                  onClick={handleLoginAttempt}
                  isLoading={isLoading}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {!isLoading && (
                    <span className="inline-flex items-center gap-3">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      <span>Login com Discord</span>
                    </span>
                  )}
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                  Ao fazer login, você concorda com nossos{' '}
                  <NavLink to="/termos" className="underline underline-offset-4 hover:text-foreground">
                    termos
                  </NavLink>{' '}
                  e{' '}
                  <NavLink to="/privacidade" className="underline underline-offset-4 hover:text-foreground">
                    política de privacidade
                  </NavLink>
                  .
                </div>

                <NavLink
                  to="/extras"
                  className="block text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Ver Extras (FAQ, Placeholders e Guias)
                </NavLink>
              </CardContent>
            </Card>

            {/* Social Proof */}
            <Card className="mt-6 border-border/50 bg-surface/30">
              <CardContent className="flex flex-col items-center gap-3 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span>Confiado por</span>
                </div>
                <ServerStats />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Features & Preview */}
          <div className="flex flex-col gap-8">
            {/* Feature Highlights */}
            <Card className="border-border/50 bg-surface/30">
              <CardHeader className="pb-2">
                <h2 className="text-lg font-semibold">Recursos Principais</h2>
                <p className="text-sm text-muted-foreground">
                  Tudo que você precisa para gerenciar sua comunidade
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {features.map((feature) => {
                    const IconComponent = feature.icon
                    return (
                      <div
                        key={feature.title}
                        className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/50 p-3 transition-colors hover:bg-surface/50"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10">
                          <IconComponent className="h-5 w-5 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{feature.title}</div>
                          <div className="text-xs text-muted-foreground">{feature.description}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Dashboard Preview */}
            <Card className="border-border/50 bg-surface/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Visualize o Dashboard</h2>
                    <p className="text-sm text-muted-foreground">
                      Interface moderna e intuitiva
                    </p>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10">
                    <LayoutDashboard className="h-5 w-5 text-accent" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mock dashboard preview */}
                <div className="overflow-hidden rounded-xl border border-border/50 bg-background">
                  {/* Mock sidebar */}
                  <div className="flex h-48">
                    <div className="w-16 border-r border-border/50 bg-surface/30 p-2">
                      <div className="mb-3 h-8 w-8 rounded-lg bg-accent/20" />
                      <div className="space-y-2">
                        <div className="h-6 w-6 rounded bg-surface/50" />
                        <div className="h-6 w-6 rounded bg-surface/50" />
                        <div className="h-6 w-6 rounded bg-surface/50" />
                      </div>
                    </div>
                    {/* Mock content */}
                    <div className="flex-1 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="h-6 w-24 rounded bg-surface/50" />
                        <div className="h-6 w-16 rounded bg-surface/50" />
                      </div>
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        <div className="h-16 rounded-lg bg-accent/10" />
                        <div className="h-16 rounded-lg bg-accent/10" />
                        <div className="h-16 rounded-lg bg-accent/10" />
                      </div>
                      <div className="h-20 rounded-lg bg-surface/50" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Pronto para usar</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer - consistent with PublicShell */}
      <footer className="border-t border-border/80 bg-background/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} Yue</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <NavLink to="/termos" className="underline underline-offset-4 hover:text-foreground">
              Termos
            </NavLink>
            <NavLink to="/privacidade" className="underline underline-offset-4 hover:text-foreground">
              Privacidade
            </NavLink>
          </div>
        </div>
      </footer>
    </div>
  )
}
