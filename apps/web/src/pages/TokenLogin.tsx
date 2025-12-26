import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { KeyRound } from 'lucide-react'

import { Button, Card, CardContent, Textarea } from '../components/ui'
import { useAuthStore } from '../store/auth'

export default function TokenLoginPage() {
  const [token, setToken] = useState('')
  const navigate = useNavigate()
  const { setToken: saveToken } = useAuthStore()

  const allow_token_login = import.meta.env.DEV

  if (!allow_token_login) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (token.trim()) {
      saveToken(token.trim())
      navigate('/')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-xl">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <KeyRound className="h-5 w-5 text-accent" />
                Login manual (dev)
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Cole um token JWT válido para autenticar no painel.</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <div className="text-sm font-medium">Token</div>
              <div className="mt-2">
                <Textarea
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole o token JWT completo aqui..."
                  rows={6}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate('/login')}>
                Voltar
              </Button>
              <Button type="submit" disabled={!token.trim()}>
                Entrar
              </Button>
            </div>
          </form>

          <div className="mt-6 text-sm text-muted-foreground">
            Para obter o token, faça login via Discord e copie da URL.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
