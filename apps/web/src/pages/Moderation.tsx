import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { X, Plus } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Input, Select } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { use_unsaved_changes_warning } from '../lib/use_unsaved_changes_warning'
import { getModerationCategoryTranslation, getThresholdForLevel, type OpenAiModerationCategory, type AiModerationLevel } from '@yuebot/shared'
import { 
  getAutomodActionLabel, 
  getAiLevelLabel, 
  getAiLevelDescription,
  type AutomodAction 
} from '@yuebot/shared'
import { PageLayout, PageSection, useAutoBreadcrumbs, SkeletonLine } from '../components/design'

const API_URL = getApiUrl()

type api_role = {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

type guild_config = {
  muteRoleId?: string | null
  muteRoleIds?: string[]

  aiModerationEnabled?: boolean
  aiModerationAction?: string
  aiModerationLevel?: string
  aiModerationThresholds?: Record<string, number>
}

type automod_config_response = {
  success: boolean
  config: {
    muteRoleId: string | null
    muteRoleIds?: string[]

    aiModerationEnabled?: boolean
    aiModerationAction?: string
    aiModerationLevel?: string
    aiModerationThresholds?: Record<string, number>
  }
}

type automod_action = AutomodAction
type ai_moderation_level = AiModerationLevel

const openai_categories: OpenAiModerationCategory[] = [
  'harassment',
  'harassment/threatening',
  'hate',
  'hate/threatening',
  'illicit',
  'illicit/violent',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
]

export default function ModerationPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const {
    data: config_data,
    isLoading: is_config_loading,
    isError: is_config_error,
  } = useQuery({
    queryKey: ['automod-config', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/automod-config`)
      return response.data as automod_config_response
    },
  })

  const config = (config_data?.config as guild_config | undefined) ?? undefined

  const { data: roles_data, isLoading: is_roles_loading } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`)
      return response.data as { success: boolean; roles: api_role[] }
    },
  })

  const available_roles = useMemo(() => {
    const roles = roles_data?.roles ?? []
    return roles
      .filter((r) => !r.managed)
      .slice()
      .sort((a, b) => b.position - a.position)
  }, [roles_data])

  const [mute_role_ids, set_mute_role_ids] = useState<string[]>([])
  const [mute_role_picker, set_mute_role_picker] = useState('')
  const [ai_enabled, set_ai_enabled] = useState(false)
  const [ai_action, set_ai_action] = useState<automod_action>('delete')
  const [ai_level, set_ai_level] = useState<ai_moderation_level>('medio')
  const [ai_thresholds, set_ai_thresholds] = useState<Record<string, number>>({})
  const has_initialized = useRef(false)

  const has_changes = useMemo(() => {
    if (!config) return false

    const initial_ids = (config.muteRoleIds ?? []).filter(Boolean)
    const initial_mute_role_ids = initial_ids.length > 0 ? initial_ids : config.muteRoleId ? [config.muteRoleId] : []
    const same_roles = JSON.stringify(initial_mute_role_ids.slice().sort()) === JSON.stringify(mute_role_ids.slice().sort())

    const initial_ai_enabled = Boolean(config.aiModerationEnabled)
    const initial_ai_action = (config.aiModerationAction as automod_action) ?? 'delete'
    const initial_ai_level = (config.aiModerationLevel as ai_moderation_level) ?? 'medio'
    const initial_thresholds = config.aiModerationThresholds ?? {}
    const same_thresholds = JSON.stringify(initial_thresholds) === JSON.stringify(ai_thresholds)

    return !(
      same_roles &&
      initial_ai_enabled === ai_enabled &&
      initial_ai_action === ai_action &&
      initial_ai_level === ai_level &&
      same_thresholds
    )
  }, [
    config,
    mute_role_ids,
    ai_enabled,
    ai_action,
    ai_level,
    ai_thresholds,
  ])

  use_unsaved_changes_warning({
    enabled: has_changes,
    message: 'Você tem alterações pendentes. Deseja realmente sair desta página?',
  })

  useEffect(() => {
    if (!config) return
    if (has_initialized.current) return
    has_initialized.current = true

    const initial_ids = (config.muteRoleIds ?? []).filter(Boolean)
    if (initial_ids.length > 0) {
      set_mute_role_ids(initial_ids)
    } else {
      const legacy = config.muteRoleId ?? ''
      set_mute_role_ids(legacy ? [legacy] : [])
    }

    set_ai_enabled(Boolean(config.aiModerationEnabled))
    set_ai_action((config.aiModerationAction as automod_action) ?? 'delete')
    set_ai_level((config.aiModerationLevel as ai_moderation_level) ?? 'medio')
    set_ai_thresholds(config.aiModerationThresholds ?? {})
  }, [config])

  const mute_roles = useMemo(() => {
    const by_id = new Map(available_roles.map((r) => [r.id, r]))
    return mute_role_ids
      .map((id) => by_id.get(id))
      .filter((r): r is api_role => Boolean(r))
  }, [available_roles, mute_role_ids])

  const add_mute_role = (role_id: string) => {
    const trimmed = role_id.trim()
    if (!trimmed) return
    set_mute_role_ids((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    set_mute_role_picker('')
  }

  const remove_mute_role = (role_id: string) => {
    set_mute_role_ids((prev) => prev.filter((id) => id !== role_id))
  }

  const reset_thresholds_to_level = () => {
    set_ai_thresholds({})
    toast_success('Valores redefinidos para o nível selecionado')
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<guild_config>) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/automod-config`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automod-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      muteRoleIds: mute_role_ids,
      aiModerationEnabled: ai_enabled,
      aiModerationAction: ai_action,
      aiModerationLevel: ai_level,
      aiModerationThresholds: ai_thresholds,
    })
  }

  const breadcrumbs = useAutoBreadcrumbs()

  return (
    <PageLayout
      title="Moderação"
      description="Configurações de punição e automação por IA"
      breadcrumbs={breadcrumbs}
      hasChanges={has_changes}
      isSaving={saveMutation.isPending}
      onSave={handleSave}
      saveDisabled={is_config_loading || is_config_error || is_roles_loading || !has_changes}
      loading={is_config_loading || is_roles_loading}
    >
      <PageSection title="Cargos">
        <div className="space-y-4">
          <div className="text-sm font-medium">Cargos de mute</div>
          <div className="mt-2">
            {is_roles_loading ? (
              <SkeletonLine className="h-11 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {mute_role_ids.length === 0 ? (
                    <Badge>Desativado</Badge>
                  ) : (
                    mute_roles.map((role) => (
                      <Badge key={role.id} className="flex items-center gap-2">
                        <span>{role.name}</span>
                        <button
                          type="button"
                          onClick={() => remove_mute_role(role.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Remover ${role.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Select value={mute_role_picker} onValueChange={(value) => set_mute_role_picker(value)}>
                    <option value="">Selecionar cargo</option>
                    {available_roles
                      .filter((r) => !mute_role_ids.includes(r.id))
                      .map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!mute_role_picker}
                    onClick={() => add_mute_role(mute_role_picker)}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Se configurado, o bot sincroniza automaticamente estes cargos com o estado de timeout do usuário.
          </div>
        </div>
      </PageSection>

      <PageSection title="Moderação por IA">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Ação</div>
              <div className="mt-2">
                <Select value={ai_action} onValueChange={(value) => set_ai_action(value as AutomodAction)}>
                  <option value="delete">Deletar</option>
                  <option value="warn">Avisar</option>
                  <option value="mute">Silenciar</option>
                  <option value="kick">Expulsar</option>
                  <option value="ban">Banir</option>
                </Select>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{getAutomodActionLabel(ai_action)}</div>
            </div>

            <div>
              <div className="text-sm font-medium">Nível</div>
              <div className="mt-2">
                <Select value={ai_level} onValueChange={(value) => set_ai_level(value as AiModerationLevel)}>
                  <option value="permissivo">{getAiLevelLabel('permissivo')}</option>
                  <option value="brando">{getAiLevelLabel('brando')}</option>
                  <option value="medio">{getAiLevelLabel('medio')}</option>
                  <option value="rigoroso">{getAiLevelLabel('rigoroso')}</option>
                  <option value="maximo">{getAiLevelLabel('maximo')}</option>
                </Select>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {getAiLevelDescription(ai_level)}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Overrides por categoria (0.00–1.00)</div>
              <div className="flex items-center gap-2">
                <Badge className={Object.keys(ai_thresholds).length === 0 ? 'bg-muted text-muted-foreground' : ''}>
                  {Object.keys(ai_thresholds).length} personalizados
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reset_thresholds_to_level}
                  disabled={Object.keys(ai_thresholds).length === 0}
                  className="text-xs"
                >
                  Redefinir para nível
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Deixe em branco para usar o valor padrão do nível. Valores são "score" do OpenAI: quanto menor, mais rígido.
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {openai_categories.map((category) => {
                const value = ai_thresholds[category]
                const defaultValue = getThresholdForLevel(ai_level)
                const hasOverride = value !== undefined
                
                return (
                  <div 
                    key={category} 
                    className={`rounded-xl border px-4 py-3 ${
                      hasOverride 
                        ? 'border-accent/50 bg-accent/5' 
                        : 'border-border/70 bg-surface/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground">
                        {getModerationCategoryTranslation(category)}
                      </div>
                      {hasOverride && (
                        <div className="text-xs text-accent font-medium">Override</div>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground font-mono opacity-60">{category}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Padrão: {defaultValue.toFixed(2)}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={value === undefined ? '' : String(value)}
                        placeholder={String(defaultValue)}
                        onChange={(e) => {
                          const raw = e.target.value
                          set_ai_thresholds((prev) => {
                            const next = { ...prev }
                            if (!raw.trim()) {
                              delete next[category]
                              return next
                            }
                            const parsed = Number.parseFloat(raw)
                            if (Number.isNaN(parsed)) return next
                            next[category] = parsed
                            return next
                          })
                        }}
                        className={hasOverride && (value! < 0.1 || value! > 0.9) ? 'border-orange-500 focus:border-orange-500' : ''}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          set_ai_thresholds((prev) => {
                            const next = { ...prev }
                            delete next[category]
                            return next
                          })
                        }
                        disabled={!hasOverride}
                        className="text-xs px-2"
                        aria-label={`Limpar override de ${getModerationCategoryTranslation(category)}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {hasOverride && (value! < 0.1 || value! > 0.9) && (
                      <div className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                        ⚠️ Valor extremo pode gerar muitos falsos {value! < 0.1 ? 'negativos' : 'positivos'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </PageSection>
    </PageLayout>
  )
}
