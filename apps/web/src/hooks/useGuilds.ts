import { useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { getApiUrl, getDiscordClientId } from '../env'
import { toast } from 'sonner'

export interface Guild {
  id: string
  name: string
  icon: string | null
  permissions?: string
  owner?: boolean
  features?: string[]
}

interface UseGuildsOptions {
  enabled?: boolean
}

interface UseGuildsResult {
  guilds: Guild[] | null
  filteredGuilds: Guild[] | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  searchQuery: string
  setSearchQuery: (query: string) => void
  buildInviteUrl: (clientId: string) => string
  inviteUrl: string | null
}

export function useGuilds(options: UseGuildsOptions = {}): UseGuildsResult {
  const { enabled = true } = options
  const [searchQuery, setSearchQuery] = useState('')
  const [internalError, setInternalError] = useState<Error | null>(null)

  const API_URL = getApiUrl()
  const clientId = getDiscordClientId()

  // Validate environment variables
  useEffect(() => {
    if (!API_URL || !clientId) {
      console.error('Environment variables missing for guilds')
      setInternalError(new Error('Configuração do painel incompleta'))
    }
  }, [API_URL, clientId])

  // Build invite URL
  const buildInviteUrl = useCallback((clientId: string): string => {
    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'bot applications.commands',
      permissions: '0',
    })
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`
  }, [])

  const inviteUrl = useMemo(() => {
    return clientId ? buildInviteUrl(clientId) : null
  }, [clientId, buildInviteUrl])

  // Fetch guilds from API
  const {
    data: guilds = null,
    isLoading,
    isError: queryIsError = false,
    error: queryError = null,
  } = useQuery({
    queryKey: ['guilds'],
    queryFn: async (): Promise<Guild[]> => {
      if (!API_URL) {
        throw new Error('API URL not configured')
      }
      const response = await axios.get(`${API_URL}/api/guilds`)
      return response.data.guilds as Guild[]
    },
    enabled: enabled && !!API_URL,
    retry: 2,
  })

  // Handle errors
  useEffect(() => {
    if (queryIsError) {
      const errorMessage = queryError?.message || 'Não foi possível carregar seus servidores'
      toast.error(errorMessage)
      console.error('Failed to fetch guilds:', queryError)
    }
  }, [queryIsError, queryError])

  // Filter guilds based on search query
  const filteredGuilds = useMemo(() => {
    if (!Array.isArray(guilds)) return null

    if (!searchQuery.trim()) return guilds

    return guilds.filter(
      (guild: Guild) =>
        guild.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guild.id.includes(searchQuery)
    )
  }, [guilds, searchQuery])

  return {
    guilds,
    filteredGuilds,
    isLoading,
    isError: queryIsError || !!internalError,
    error: queryError || internalError,
    searchQuery,
    setSearchQuery,
    buildInviteUrl,
    inviteUrl,
  }
}
