import { useEffect, useState } from 'react'
import { getApiUrl } from '../env'

export interface BotStats {
  servers: number
  users: number
  shards?: number
  uptime?: string
  version?: string
  lastUpdated?: string
}

export function useBotStats() {
  const [stats, setStats] = useState<BotStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const fetchStats = async () => {
      try {
        const apiUrl = getApiUrl()
        if (!apiUrl) {
          throw new Error('Configuração do painel incompleta')
        }

        const response = await fetch(`${apiUrl}/api/bot/stats`, {
          signal: controller.signal,
          cache: 'force-cache',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        if (data && typeof data.servers === 'number' && typeof data.users === 'number') {
          setStats({
            servers: data.servers,
            users: data.users,
            shards: data.shards,
            uptime: data.uptime,
            version: data.version,
            lastUpdated: data.lastUpdated,
          })
        } else {
          console.warn('Invalid stats response:', data)
          throw new Error('Formato de resposta inválido do servidor')
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Failed to fetch bot stats:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido ao carregar estatísticas')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void fetchStats()

    return () => {
      controller.abort()
    }
  }, [])

  return { stats, loading, error }
}
