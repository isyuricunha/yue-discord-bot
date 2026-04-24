/**
 * Hook customizado para buscar dados da guild
 *
 * @param {string} guildId - ID da guild
 * @returns {UseGuildSummaryResult} Objeto com guild, estado de loading e error
 */

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getApiUrl } from '../../../env'
import type { Guild } from '../types'

interface UseGuildSummaryResult {
  guild: Guild | null
  isLoading: boolean
  isError: boolean
  error: Error | null
}

export function useGuildSummary(guildId: string): UseGuildSummaryResult {
  const [internalError, setInternalError] = useState<Error | null>(null)
  const API_URL = getApiUrl()

  // Validar environment variables
  useEffect(() => {
    if (!API_URL) {
      console.error('API_URL não configurado')
      setInternalError(new Error('Configuração do painel incompleta'))
    }
  }, [API_URL])

  const {
    data: guild = null,
    isLoading,
    isError: queryIsError = false,
    error: queryError = null,
  } = useQuery<Guild, Error>({
    queryKey: ['guild-summary', guildId],
    queryFn: async (): Promise<Guild> => {
      if (!API_URL) {
        throw new Error('API URL not configured')
      }
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/summary`)
      return response.data.guild as Guild
    },
    enabled: !!API_URL && !!guildId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
  })

  // Tratamento de erros
  useEffect(() => {
    if (queryIsError) {
      const errorMessage = queryError?.message || 'Não foi possível carregar os dados do servidor'
      toast.error(errorMessage)
      console.error('Failed to fetch guild summary:', queryError)
    }
  }, [queryIsError, queryError])

  return {
    guild,
    isLoading,
    isError: queryIsError || !!internalError,
    error: queryError || internalError,
  }
}
