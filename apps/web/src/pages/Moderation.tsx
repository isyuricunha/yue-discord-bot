import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { X, Plus } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Input, Select, Switch, Tabs } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { use_unsaved_changes_warning } from '../lib/use_unsaved_changes_warning'
import { getModerationCategoryTranslation, getThresholdForLevel, type OpenAiModerationCategory, type AiModerationLevel } from '@yuebot/shared'
import { 
  getAutomodActionLabel, 
  getAiLevelLabel, 
  getAiLevelDescription,
  type AutomodAction 
} from '@yuebot/shared'
import { PageLayout, PageSection, SkeletonLine } from '../components/design'
import { AutoModSections, type GuildConfig } from './AutoMod'

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
    wordFilterEnabled?: boolean
    bannedWords?: { word: string; action: string }[]
    capsEnabled?: boolean
    capsThreshold?: number
    capsMinLength?: number
    capsAction?: string
    linkFilterEnabled?: boolean
    linkBlockAll?: boolean
    bannedDomains?: string[]
    allowedDomains?: string[]
    linkAction?: string

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

  const [filters_config, set_filters_config] = useState<Partial<GuildConfig>>({})
  const [mute_role_ids, set_mute_role_ids] = useState<string[]>([])
  const [mute_role_picker, set_mute_role_picker] = useState('')
  const [ai_enabled, set_ai_enabled] = useState(false)
  const [ai_action, set_ai_action] = useState<automod_action>('delete')
  const [ai_level, set_ai_level] = useState<ai_moderation_level>('medio')
  const [ai_thresholds, set_ai_thresholds] = useState<Record<string, number>>({})
  const [active_tab, set_active_tab] = useState<'filters' | 'actions'>('filters')
  const initial_state_ref = useRef<{
    filters: Partial<GuildConfig>
    muteRoleIds: string[]
    aiEnabled: boolean
    aiAction: automod_action
    aiLevel: ai_moderation_level
    aiThresholds: Record<string, number>
  } | null>(null)

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
  const has_initialized = useRef(false)

  const has_changes = useMemo(() => {
    const initial = initial_state_ref.current
    if (!initial) return false

    const same_filters = JSON.stringify(initial.filters) === JSON.stringify(filters_config)
    const same_roles = JSON.stringify(initial.muteRoleIds.slice().sort()) === JSON.stringify(mute_role_ids.slice().sort())
    const same_thresholds = JSON.stringify(initial.aiThresholds) === JSON.stringify(ai_thresholds)

    return !(
      same_filters &&
      same_roles &&
      initial.aiEnabled === ai_enabled &&
      initial.aiAction === ai_action &&
      initial.aiLevel === ai_level &&
      same_thresholds
    )
  }, [
    mute_role_ids,
    ai_enabled,
    ai_action,
    ai_level,
    ai_thresholds,
    filters_config,
  ])

  use_unsaved_changes_warning({
    enabled: has_changes,
    message: 'Você tem alterações pendentes. Deseja realmente sair desta página?',
  })

  useEffect(() => {
    const config = (config_data?.config as guild_config | undefined) ?? undefined
    if (!config) return
    if (has_initialized.current) return
    has_initialized.current = true

    const config_any = config as unknown as Partial<GuildConfig>

    const initial_filters: Partial<GuildConfig> = {
      wordFilterEnabled: Boolean(config_any.wordFilterEnabled),
      bannedWords: config_any.bannedWords ?? [],
      capsEnabled: Boolean(config_any.capsEnabled),
      capsThreshold: config_any.capsThreshold ?? 70,
      capsMinLength: config_any.capsMinLength ?? 10,
      capsAction: config_any.capsAction ?? 'warn',
      linkFilterEnabled: Boolean(config_any.linkFilterEnabled),
      linkBlockAll: Boolean(config_any.linkBlockAll),
      bannedDomains: config_any.bannedDomains ?? [],
      allowedDomains: config_any.allowedDomains ?? [],
      linkAction: config_any.linkAction ?? 'delete',
      aiModerationEnabled: Boolean(config_any.aiModerationEnabled),
      aiModerationAction: config_any.aiModerationAction ?? 'delete',
      aiModerationLevel: (config_any.aiModerationLevel as AiModerationLevel | undefined) ?? 'medio',
    }
    set_filters_config(initial_filters)

    const initial_ids = (config.muteRoleIds ?? []).filter(Boolean)
    const legacy_mute_role_id = config.muteRoleId ?? ''
    const initial_mute_role_ids = initial_ids.length > 0 ? initial_ids : legacy_mute_role_id ? [legacy_mute_role_id] : []

    if (initial_ids.length > 0) {
      set_mute_role_ids(initial_ids)
    } else {
      set_mute_role_ids(initial_mute_role_ids)
    }

    set_ai_enabled(Boolean(config.aiModerationEnabled))
    set_ai_action((config.aiModerationAction as automod_action) ?? 'delete')
    set_ai_level((config.aiModerationLevel as ai_moderation_level) ?? 'medio')
    set_ai_thresholds(config.aiModerationThresholds ?? {})

    initial_state_ref.current = {
      filters: initial_filters,
      muteRoleIds: initial_mute_role_ids,
      aiEnabled: Boolean(config.aiModerationEnabled),
      aiAction: (config.aiModerationAction as automod_action) ?? 'delete',
      aiLevel: (config.aiModerationLevel as ai_moderation_level) ?? 'medio',
      aiThresholds: config.aiModerationThresholds ?? {},
    }
  }, [config_data])

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
      initial_state_ref.current = {
        filters: filters_config,
        muteRoleIds: mute_role_ids,
        aiEnabled: ai_enabled,
        aiAction: ai_action,
        aiLevel: ai_level,
        aiThresholds: ai_thresholds,
      }
      queryClient.invalidateQueries({ queryKey: ['automod-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      ...filters_config,
      muteRoleIds: mute_role_ids,
      muteRoleId: null,
      aiModerationEnabled: ai_enabled,
      aiModerationAction: ai_action,
      aiModerationLevel: ai_level,
      aiModerationThresholds: ai_thresholds,
    })
  }

  const is_page_loading = is_config_loading || is_roles_loading
  const is_disabled = is_page_loading || is_config_error || saveMutation.isPending

  return (
    <PageLayout
      title="Moderação"
      description="Configurações de punição e automação por IA"
      hasChanges={has_changes}
      isSaving={saveMutation.isPending}
      onSave={handleSave}
      saveDisabled={is_disabled || !has_changes}
      loading={is_page_loading}
    >
      <Tabs
        value={active_tab}
        onValueChange={(value) => set_active_tab(value as 'filters' | 'actions')}
        items={[
          {
            value: 'filters',
            label: 'Filtros',
            content: (
              <AutoModSections
                config={filters_config}
                setConfig={set_filters_config}
                isLoading={is_page_loading || saveMutation.isPending}
                showAiSection={false}
              />
            ),
          },
          {
            value: 'actions',
            label: 'Ações',
            content: (
              <>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Moderação por IA</div>
                        <div className="text-xs text-muted-foreground">Analisa texto e imagens automaticamente</div>
                      </div>
                      <Switch
                        checked={ai_enabled}
                        onCheckedChange={(checked) => set_ai_enabled(checked)}
                        label={ai_enabled ? 'Ativado' : 'Desativado'}
                        disabled={is_disabled}
                      />
                    </div>

                    {ai_enabled && (
                      <>
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
                            <div className="mt-2 text-xs text-muted-foreground">{getAiLevelDescription(ai_level)}</div>
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
                                disabled={Object.keys(ai_thresholds).length === 0 || is_disabled}
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
                                    hasOverride ? 'border-accent/50 bg-accent/5' : 'border-border/70 bg-surface/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-medium text-muted-foreground">
                                      {getModerationCategoryTranslation(category)}
                                    </div>
                                    {hasOverride && <div className="text-xs text-accent font-medium">Override</div>}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground font-mono opacity-60">{category}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">Padrão: {defaultValue.toFixed(2)}</div>
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
                                      disabled={is_disabled}
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
                                      disabled={!hasOverride || is_disabled}
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
                      </>
                    )}
                  </div>
                </PageSection>
              </>
            ),
          },
        ]}
      />
    </PageLayout>
  )
}
