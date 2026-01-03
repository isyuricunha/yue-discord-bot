import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Settings as SettingsIcon } from 'lucide-react'

import { getApiUrl } from '../env'
import { Card, CardContent, ErrorState, Input, Select, Skeleton, Button } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

interface GuildConfig {
  prefix: string
  locale: string
  timezone: string
}

type settings_config_response = {
  success: boolean
  config: GuildConfig
}

export default function SettingsPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const {
    data: config_data,
    isLoading: is_config_loading,
    isError: is_config_error,
    refetch: refetch_config,
  } = useQuery({
    queryKey: ['settings-config', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/settings-config`)
      return response.data as settings_config_response
    },
  })

  const [prefix, setPrefix] = useState('')
  const [locale, setLocale] = useState('pt-BR')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')

  const has_initialized = useRef(false)

  const config = config_data?.config

  useEffect(() => {
    if (!config) return

    if (has_initialized.current) return
    has_initialized.current = true

    setPrefix(config.prefix || '/')
    setLocale(config.locale || 'pt-BR')
    setTimezone(config.timezone || 'America/Sao_Paulo')
  }, [config])

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<GuildConfig>) => {
      const response = await axios.put(`${API_URL}/api/guilds/${guildId}/settings-config`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      prefix,
      locale,
      timezone,
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Configurações</div>
            <div className="text-sm text-muted-foreground">Preferências do servidor</div>
          </div>
        </div>

        <Button onClick={handleSave} isLoading={updateMutation.isPending} className="shrink-0">
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
      </div>

      {is_config_error && (
        <ErrorState
          title="Falha ao carregar configurações"
          description="Não foi possível carregar os dados do servidor."
          onAction={() => refetch_config()}
        />
      )}

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Prefixo dos comandos</div>
              <div className="mt-2">
                {is_config_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    maxLength={5}
                    placeholder="/"
                  />
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Prefixo usado para comandos do bot.</div>
            </div>

            <div>
              <div className="text-sm font-medium">Idioma</div>
              <div className="mt-2">
                {is_config_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={locale} onValueChange={setLocale}>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                  </Select>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Fuso horário</div>
              <div className="mt-2">
                {is_config_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={timezone} onValueChange={setTimezone}>
                    <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                    <option value="America/New_York">New York (EST)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </Select>
                )}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card className="border-accent/20">
        <CardContent className="p-6 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Nota:</span> Alterações podem levar alguns segundos para refletir no bot.
            </div>
            <div>
              <span className="font-semibold text-foreground">Dica:</span> Para obter IDs no Discord, ative o modo desenvolvedor e use “Copiar ID”.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
