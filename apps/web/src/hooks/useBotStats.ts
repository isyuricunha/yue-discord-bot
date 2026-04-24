import { useEffect, useState } from 'react'
import { getApiUrl } from '../env'

interface BotStats {
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
    const fetchStats = async () => {
      try {
        const apiUrl = getApiUrl()
        if (!apiUrl) {
          throw new Error('Configuração do painel incompleta')
        }

        const response = await fetch(`${apiUrl}/api/bot/stats`)

        if (!response.ok) {
          throw new Error('Não foi possível carregar estatísticas do bot')
        }

        const data = await response.json()

        // Extract stats from the API response (which includes 'success' wrapper)
        // API returns: { success: true, servers: number, users: number }
        if (data && typeof data.servers === 'number' && typeof data.users === 'number') {
          setStats({
            servers: data.servers,
            users: data.users,
            shards: data.shards,
            uptime: data.uptime,
            version: data.version,
            lastUpdated: data.lastUpdated
          })
        } else {
          console.warn('Invalid stats response:', data)
          throw new Error('Formato de resposta inválido')
        }
      } catch (err) {
        console.error('Failed to fetch bot stats:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading, error }
}