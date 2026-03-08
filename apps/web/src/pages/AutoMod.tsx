import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Plus, Trash2, Shield, AlertTriangle, Link as LinkIcon, BrainCircuit } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

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

/** Categories surfaced in the OpenAI omni-moderation-latest model. */
const AI_MOD_CATEGORIES: { key: string; label: string; description: string }[] = [
  { key: 'harassment', label: 'Assédio', description: 'Conteúdo que assedia, ameaça ou hostiliza indivíduos.' },
  { key: 'hate', label: 'Ódio', description: 'Discurso de ódio baseado em identidade, raça, religião, etc.' },
  { key: 'illicit', label: 'Ilícito', description: 'Conteúdo sobre atividades ilegais (drogas, armas, etc.).' },
  { key: 'self-harm', label: 'Autolesão', description: 'Conteúdo sobre automutilação ou suicídio.' },
  { key: 'sexual', label: 'Sexual', description: 'Conteúdo sexual explícito ou inadequado.' },
  { key: 'violence', label: 'Violência', description: 'Conteúdo que promove ou descreve violência.' },
]

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
  aiModerationCategoryThresholds: Record<string, number>
}

export default function AutoModPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const [newWord, setNewWord] = useState('')
  const [newWordAction, setNewWordAction] = useState('warn')
  const [newDomain, setNewDomain] = useState('')
  const [config, setConfig] = useState<Partial<GuildConfig>>({})

  const caps_action = String(config.capsAction ?? 'warn')
  const link_action = String(config.linkAction ?? 'delete')
  const ai_action = String(config.aiModerationAction ?? 'delete')
  const ai_thresholds = (config.aiModerationCategoryThresholds ?? {}) as Record<string, number>

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
        aiModerationCategoryThresholds: {},
      }
      setConfig(initialConfig)
      return response.data
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: Partial<GuildConfig>) => {
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
    mutation.mutate(config)
  }

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

  const setAiThreshold = (category: string, value: number) => {
    const updated = { ...ai_thresholds, [category]: value }
    setConfig({ ...config, aiModerationCategoryThresholds: updated })
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

        <Button onClick={handleSave} isLoading={mutation.isPending} className="shrink-0">
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
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
                      <span className="rounded-full border border-border/70 bg-surface/70 px-2.5 py-1 text-xs text-muted-foreground">
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
                <div className="text-sm font-semibold">Moderação por IA (OpenAI)</div>
                <div className="text-xs text-muted-foreground">
                  Analisa texto e imagens com <code className="rounded bg-surface px-1 text-[11px]">omni-moderation-latest</code>.
                  Requer <code className="rounded bg-surface px-1 text-[11px]">OPENAI_API_KEY</code> configurada no servidor.
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
                <div className="mb-3 text-sm font-medium">Threshold por categoria (0.00 – 1.00)</div>
                <div className="mb-3 text-xs text-muted-foreground">
                  Score acima do threshold aciona o AutoMod. Padrão: <strong>0.80</strong> quando não configurado.
                  Valores mais baixos são mais restritivos.
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {AI_MOD_CATEGORIES.map(({ key, label, description }) => {
                    const currentValue = ai_thresholds[key] ?? 0.8
                    return (
                      <div key={key} className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3 space-y-2">
                        <div>
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">{description}</div>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={String(currentValue)}
                          onChange={(e) => {
                            const parsed = Number.parseFloat(e.target.value)
                            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                              setAiThreshold(key, parsed)
                            }
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
