import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Plus, Trash2, Shield, AlertTriangle, Link as LinkIcon, BrainCircuit } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, ErrorState, Input, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { use_unsaved_changes_warning } from '../lib/use_unsaved_changes_warning'
import { Ban, FileWarning, MicOff, Trash2 as TrashIcon } from 'lucide-react'

const ActionIcon = ({ action }: { action: string }) => {
  if (action === 'delete') return <TrashIcon className="w-3 h-3" />
  if (action === 'warn') return <FileWarning className="w-3 h-3" />
  if (action === 'mute') return <MicOff className="w-3 h-3" />
  if (action === 'ban') return <Ban className="w-3 h-3" />
  return <AlertTriangle className="w-3 h-3" />
}

const API_URL = getApiUrl()

type automod_action = 'delete' | 'warn' | 'mute' | 'kick' | 'ban'

const action_label: Record<automod_action, string> = {
  delete: 'Deletar',
  warn: 'Avisar',
  mute: 'Silenciar',
  kick: 'Expulsar',
  ban: 'Banir',
}

const action_description: Record<automod_action, string> = {
  delete: 'Remove a mensagem. Não aplica punição ao usuário.',
  warn: 'Remove a mensagem e registra 1 warn no usuário (pode contar para thresholds).',
  mute: 'Remove a mensagem e aplica timeout de 5 minutos no usuário.',
  kick: 'Remove a mensagem e expulsa o usuário do servidor.',
  ban: 'Remove a mensagem e bane o usuário do servidor.',
}

function describe_action(value: unknown) {
  const key = value as automod_action
  if (!key || !(key in action_description)) return ''
  return action_description[key]
}

interface BannedWord {
  word: string
  action: string
}

type ai_moderation_level = 'permissivo' | 'brando' | 'medio' | 'rigoroso' | 'maximo'

const ai_level_label: Record<ai_moderation_level, string> = {
  permissivo: 'Permissivo',
  brando: 'Brando',
  medio: 'Médio',
  rigoroso: 'Rigoroso',
  maximo: 'Máximo',
}

const ai_level_description: Record<ai_moderation_level, string> = {
  permissivo: 'Quase tudo passa. Só conteúdo bem explícito será punido.',
  brando: 'Mais permissivo que o padrão, mas ainda barra casos evidentes.',
  medio: 'Equilíbrio (recomendado).',
  rigoroso: 'Mais restritivo. Penaliza com mais frequência.',
  maximo: 'Quase nada passa. Use apenas se você quiser tolerância mínima.',
}

interface GuildConfig {
  id: string
  guildId: string
  wordFilterEnabled: boolean
  bannedWords: BannedWord[]
  capsEnabled: boolean
  capsThreshold: number
  capsMinLength: number
  capsAction: string
  linkFilterEnabled: boolean
  linkBlockAll: boolean
  bannedDomains: string[]
  allowedDomains: string[]
  linkAction: string
  aiModerationEnabled: boolean
  aiModerationAction: string
  aiModerationLevel: ai_moderation_level
}

export default function AutoModPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const [newWord, setNewWord] = useState('')
  const [newWordAction, setNewWordAction] = useState('warn')
  const [newDomain, setNewDomain] = useState('')
  const [config, setConfig] = useState<Partial<GuildConfig>>({})
  const initial_config_ref = useRef<Partial<GuildConfig> | null>(null)

  const caps_action = String(config.capsAction ?? 'warn')
  const link_action = String(config.linkAction ?? 'delete')
  const ai_action = String(config.aiModerationAction ?? 'delete')
  const ai_level = (config.aiModerationLevel ?? 'medio') as ai_moderation_level

  const {
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['automod-config', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/automod-config`)
      const initialConfig = response.data.config || {
        wordFilterEnabled: false,
        bannedWords: [],
        capsEnabled: false,
        capsThreshold: 70,
        capsMinLength: 10,
        capsAction: 'warn',
        linkFilterEnabled: false,
        linkBlockAll: false,
        bannedDomains: [],
        allowedDomains: [],
        linkAction: 'delete',
        aiModerationEnabled: false,
        aiModerationAction: 'delete',
        aiModerationLevel: 'medio',
      }

      if (!initial_config_ref.current) {
        initial_config_ref.current = initialConfig
      }
      setConfig(initialConfig)
      return response.data
    },
  })

  const has_changes = useMemo(() => {
    const initial = initial_config_ref.current
    if (!initial) return false

    return JSON.stringify(initial) !== JSON.stringify(config)
  }, [config])

  use_unsaved_changes_warning({
    enabled: has_changes,
    message: 'Você tem alterações pendentes. Deseja realmente sair desta página?',
  })

  const mutation = useMutation({
    mutationFn: async (data: Partial<GuildConfig>) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/automod-config`, data)
    },
    onSuccess: (_data, variables) => {
      initial_config_ref.current = variables
      setConfig(variables)
      queryClient.invalidateQueries({ queryKey: ['automod-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const handleSave = () => {
    mutation.mutate(config)
  }

  const is_disabled = isLoading || isError || mutation.isPending

  const addWord = () => {
    if (!newWord.trim()) return
    const bannedWords = [...(config.bannedWords || []), { word: newWord, action: newWordAction }]
    setConfig({ ...config, bannedWords })
    setNewWord('')
  }

  const removeWord = (index: number) => {
    const bannedWords = [...(config.bannedWords || [])]
    bannedWords.splice(index, 1)
    setConfig({ ...config, bannedWords })
  }

  const addDomain = () => {
    if (!newDomain.trim()) return
    const bannedDomains = [...(config.bannedDomains || []), newDomain]
    setConfig({ ...config, bannedDomains })
    setNewDomain('')
  }

  const removeDomain = (index: number) => {
    const bannedDomains = [...(config.bannedDomains || [])]
    bannedDomains.splice(index, 1)
    setConfig({ ...config, bannedDomains })
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">AutoMod</div>
            <div className="text-sm text-muted-foreground">Moderação automática</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {has_changes && <Badge>Alterações pendentes</Badge>}
          <Button
            onClick={handleSave}
            isLoading={mutation.isPending}
            disabled={is_disabled || !has_changes}
            className="shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>Salvar</span>
          </Button>
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Falha ao carregar AutoMod"
          description="Não foi possível carregar as configurações da guild."
          onAction={() => refetch()}
        />
      )}

      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="text-sm font-semibold">O que significa cada ação?</div>
          <div className="text-sm text-muted-foreground">
            Em todas as ações abaixo, o AutoMod <span className="font-semibold text-foreground">sempre deleta a mensagem</span> primeiro.
            Depois, ele aplica a punição escolhida.
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(Object.keys(action_label) as automod_action[]).map((key) => (
              <div key={key} className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                <div className="text-sm font-medium">{action_label[key]}</div>
                <div className="mt-1 text-xs text-muted-foreground">{action_description[key]}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-accent" />
              <div>
                <div className="text-sm font-semibold">Filtro de palavras</div>
                <div className="text-xs text-muted-foreground">Punir mensagens contendo palavras proibidas</div>
              </div>
            </div>

            <Switch
              checked={Boolean(config.wordFilterEnabled)}
              onCheckedChange={(checked) => setConfig({ ...config, wordFilterEnabled: checked })}
              label="Habilitar filtro de palavras"
              disabled={isLoading}
            />
          </div>

          {Boolean(config.wordFilterEnabled) && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_44px]">
                <Input
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Digite uma palavra..."
                  onKeyDown={(e) => e.key === 'Enter' && addWord()}
                />
                <Select value={newWordAction} onValueChange={(value) => setNewWordAction(value)}>
                  <option value="delete">Deletar</option>
                  <option value="warn">Avisar</option>
                  <option value="mute">Silenciar</option>
                  <option value="kick">Expulsar</option>
                  <option value="ban">Banir</option>
                </Select>
                <Button variant="outline" onClick={addWord} className="px-0" aria-label="Adicionar palavra">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">{describe_action(newWordAction)}</div>

              <div className="space-y-2">
                {(config.bannedWords || []).map((item, index) => (
                  <div key={index} className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="truncate font-mono text-sm">{item.word}</span>
                      <span className="flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/70 px-2.5 py-1.5 text-xs text-muted-foreground font-medium">
                        <ActionIcon action={item.action} />
                        {action_label[(item.action as automod_action) ?? 'warn'] ?? item.action}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeWord(index)} aria-label="Remover palavra">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {!isLoading && (config.bannedWords || []).length === 0 && (
                  <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-sm text-muted-foreground">
                    Nenhuma palavra adicionada
                  </div>
                )}

                {isLoading && <Skeleton className="h-12 w-full" />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">🔠</span>
              <div>
                <div className="text-sm font-semibold">Anti-CAPS</div>
                <div className="text-xs text-muted-foreground">Punir mensagens com excesso de letras maiúsculas</div>
              </div>
            </div>

            <Switch
              checked={Boolean(config.capsEnabled)}
              onCheckedChange={(checked) => setConfig({ ...config, capsEnabled: checked })}
              label="Habilitar Anti-CAPS"
              disabled={isLoading}
            />
          </div>

          {Boolean(config.capsEnabled) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium">Limite de CAPS (%)</div>
                <div className="mt-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={String(config.capsThreshold ?? 70)}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10)
                      setConfig({ ...config, capsThreshold: Number.isNaN(parsed) ? 70 : parsed })
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Tamanho mínimo</div>
                <div className="mt-2">
                  <Input
                    type="number"
                    min={1}
                    value={String(config.capsMinLength ?? 10)}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10)
                      setConfig({ ...config, capsMinLength: Number.isNaN(parsed) ? 10 : parsed })
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Ação</div>
                <div className="mt-2">
                  <Select
                    value={caps_action}
                    onValueChange={(value) => setConfig({ ...config, capsAction: value })}
                  >
                    <option value="delete">Deletar</option>
                    <option value="warn">Avisar</option>
                    <option value="mute">Silenciar</option>
                    <option value="kick">Expulsar</option>
                    <option value="ban">Banir</option>
                  </Select>
                  <div className="mt-2 text-xs text-muted-foreground">{describe_action(caps_action)}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LinkIcon className="h-5 w-5 text-accent" />
              <div>
                <div className="text-sm font-semibold">Filtro de links</div>
                <div className="text-xs text-muted-foreground">Bloquear ou punir mensagens com links</div>
              </div>
            </div>

            <Switch
              checked={Boolean(config.linkFilterEnabled)}
              onCheckedChange={(checked) => setConfig({ ...config, linkFilterEnabled: checked })}
              label="Habilitar filtro de links"
              disabled={isLoading}
            />
          </div>

          {Boolean(config.linkFilterEnabled) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                <div className="text-sm">
                  <div className="font-medium">Bloquear todos os links</div>
                  <div className="text-xs text-muted-foreground">Exceto domínios permitidos</div>
                </div>
                <Switch
                  checked={Boolean(config.linkBlockAll)}
                  onCheckedChange={(checked) => setConfig({ ...config, linkBlockAll: checked })}
                  label="Bloquear todos os links"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium">Ação ao detectar link</div>
                  <div className="mt-2">
                    <Select
                      value={link_action}
                      onValueChange={(value) => setConfig({ ...config, linkAction: value })}
                    >
                      <option value="delete">Deletar</option>
                      <option value="warn">Avisar</option>
                      <option value="mute">Silenciar</option>
                      <option value="kick">Expulsar</option>
                      <option value="ban">Banir</option>
                    </Select>
                    <div className="mt-2 text-xs text-muted-foreground">{describe_action(link_action)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium">Domínios bloqueados</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_44px]">
                  <Input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="exemplo.com"
                    onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                  />
                  <Button variant="outline" onClick={addDomain} className="px-0" aria-label="Adicionar domínio">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {(config.bannedDomains || []).map((domain, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                      <span className="truncate font-mono text-sm">{domain}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeDomain(index)} aria-label="Remover domínio">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {!isLoading && (config.bannedDomains || []).length === 0 && (
                    <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-sm text-muted-foreground">
                      Nenhum domínio bloqueado
                    </div>
                  )}

                  {isLoading && <Skeleton className="h-12 w-full" />}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── OpenAI AI Moderation ── */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-5 w-5 text-accent" />
              <div>
                <div className="text-sm font-semibold">Moderação por IA</div>
                <div className="text-xs text-muted-foreground">
                  Analisa texto e imagens automaticamente e remove conteúdo impróprio.
                </div>
              </div>
            </div>

            <Switch
              checked={Boolean(config.aiModerationEnabled)}
              onCheckedChange={(checked) => setConfig({ ...config, aiModerationEnabled: checked })}
              label="Habilitar moderação por IA"
              disabled={isLoading}
            />
          </div>

          {Boolean(config.aiModerationEnabled) && (
            <div className="space-y-5">
              {/* Action */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium">Ação ao detectar conteúdo impróprio</div>
                  <div className="mt-2">
                    <Select
                      value={ai_action}
                      onValueChange={(value) => setConfig({ ...config, aiModerationAction: value })}
                    >
                      <option value="delete">Deletar</option>
                      <option value="warn">Avisar</option>
                      <option value="mute">Silenciar</option>
                      <option value="kick">Expulsar</option>
                      <option value="ban">Banir</option>
                    </Select>
                    <div className="mt-2 text-xs text-muted-foreground">{describe_action(ai_action as automod_action)}</div>
                  </div>
                </div>
              </div>

              {/* Per-category thresholds */}
              <div>
                <div className="mb-3 text-sm font-medium">Nível de detecção</div>
                <div className="mb-3 text-xs text-muted-foreground">
                  Quanto mais alto o nível, mais restritivo (mais conteúdo será punido).
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Select
                      value={ai_level}
                      onValueChange={(value) => setConfig({ ...config, aiModerationLevel: value as ai_moderation_level })}
                    >
                      <option value="permissivo">{ai_level_label.permissivo}</option>
                      <option value="brando">{ai_level_label.brando}</option>
                      <option value="medio">{ai_level_label.medio}</option>
                      <option value="rigoroso">{ai_level_label.rigoroso}</option>
                      <option value="maximo">{ai_level_label.maximo}</option>
                    </Select>
                    <div className="mt-2 text-xs text-muted-foreground">{ai_level_description[ai_level]}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
