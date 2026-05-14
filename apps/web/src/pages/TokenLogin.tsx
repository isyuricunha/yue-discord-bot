import { type FormEvent, useState, useCallback, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { KeyRound, CheckCircle2, XCircle } from 'lucide-react'

import { Button, Card, CardContent, Textarea } from '../components/ui'
import { useAuthStore } from '../store/auth'
import { getApiUrl } from '../env'
import { toast_error } from '../store/toast'

// Detectar se é um token JWT válido (formato básico)
const isValidJwtFormat = (token: string): boolean => {
  // JWT tem 3 partes separadas por ponto
  const parts = token.split('.')
  if (parts.length !== 3) return false
  
  // Cada parte deve ser base64url encoded
  const base64url = /^[A-Za-z0-9_-]+={0,2}$/
  return parts.every(part => base64url.test(part))
}

export default function TokenLoginPage() {
const [token, setToken] = useState('')
const [isValidating, setIsValidating] = useState(false)
const [_validationResult, setValidationResult] = useState<'valid' | 'invalid' | null>(null)
const navigate = useNavigate()
const { setToken: saveToken } = useAuthStore()
const API_URL = getApiUrl()

const allow_token_login = import.meta.env.DEV

if (!allow_token_login) {
return <Navigate to="/login" replace />
}

// Auto-detectar token colado
const _handlePaste = useCallback((e: React.ClipboardEvent) => {
const pasted = e.clipboardData.getData('text').trim()
if (pasted) {
  setToken(pasted)
  
  // Validar formato do token
  if (isValidJwtFormat(pasted)) {
    setValidationResult('valid')
    toast_error('Token detectado', 'Token JWT válido detectado automaticamente!')
  } else {
    setValidationResult('invalid')
    toast_error('Token inválido', 'Formato de token não parece ser um JWT válido')
  }
}
}, [])

// Analytics: track view
useEffect(() => {
window.dispatchEvent(new CustomEvent('token_login_page_view', {
  detail: { timestamp: Date.now(), path: '/login/token' }
}))
}, [])

const handleSubmit = async (e: FormEvent) => {
e.preventDefault()
const trimmedToken = token.trim()

if (!trimmedToken) {
  toast_error('Token necessário', 'Por favor, cole um token válido')
  return
}

// Validar formato JWT
if (!isValidJwtFormat(trimmedToken)) {
  setValidationResult('invalid')
  toast_error('Token inválido', 'O token não está no formato JWT válido')
  return
}

setIsValidating(true)

try {
  // Tentar validar o token com a API
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${trimmedToken}`,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    throw new Error('Token inválido ou expirado')
  }
  
  // Token válido, salvar e navegar
  saveToken(trimmedToken)
  
  // Analytics: track successful token login
  window.dispatchEvent(new CustomEvent('token_login_success', {
    detail: { timestamp: Date.now() }
  }))
  
  toast_error('Sucesso', 'Token válido! Redirecionando...')
  navigate('/')
} catch (error) {
  setValidationResult('invalid')
  toast_error(
    'Erro na validação', 
    error instanceof Error ? error.message : 'Falha ao validar token'
  )
  
  // Analytics: track failed token login
  window.dispatchEvent(new CustomEvent('token_login_failed', {
    detail: { 
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }))
} finally {
  setIsValidating(false)
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
  onPaste={_handlePaste}
  placeholder="Cole o token JWT completo aqui..."
  rows={6}
  disabled={isValidating}
  />
</div>
</div>

<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
  <Button type="button" variant="outline" onClick={() => navigate('/login')} disabled={isValidating}>
  Voltar
  </Button>
  <Button 
  type="submit" 
  disabled={!token.trim() || isValidating}
  isLoading={isValidating}
  >
  {isValidating ? 'Validando...' : 'Entrar'}
  </Button>
</div>
</form>

{/* Feedback visual de validação */}
{_validationResult && (
  <div className={`mt-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${
    _validationResult === 'valid' 
      ? 'border-green-500/20 bg-green-500/10 text-green-500' 
      : 'border-destructive/20 bg-destructive/10 text-destructive'
  }`}>
    {_validationResult === 'valid' ? (
      <><CheckCircle2 className="h-4 w-4" /> Token válido</>
    ) : (
      <><XCircle className="h-4 w-4" /> Token inválido</>
    )}
  </div>
)}

          <div className="mt-6 text-sm text-muted-foreground">
            Para obter o token, faça login via Discord e copie da URL.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
