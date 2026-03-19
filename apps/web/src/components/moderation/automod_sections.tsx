import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, Link as LinkIcon, BrainCircuit } from 'lucide-react'

import { Button, Input, Select, Skeleton, Switch } from '../ui'
import {
  getAiLevelDescription,
  getAiLevelLabel,
  getAutomodActionDescription,
  getAutomodActionLabel,
  type AiModerationLevel,
  type AutomodAction,
} from '@yuebot/shared'
import { PageSection } from '../design'

interface BannedWord {
  word: string
  action: string
}

export interface GuildConfig {
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
  aiModerationLevel: AiModerationLevel
}

type automod_sections_props = {
  config: Partial<GuildConfig>
  setConfig: (next: Partial<GuildConfig> | ((prev: Partial<GuildConfig>) => Partial<GuildConfig>)) => void
  isLoading: boolean
  showAiSection?: boolean
}

export function AutoModSections({ config, setConfig, isLoading, showAiSection = true }: automod_sections_props) {
  const [newWord, setNewWord] = useState('')
  const [newWordAction, setNewWordAction] = useState<AutomodAction>('warn')
  const [newDomain, setNewDomain] = useState('')

  const caps_action = String(config.capsAction ?? 'warn') as AutomodAction
  const link_action = String(config.linkAction ?? 'delete') as AutomodAction
  const ai_action = String(config.aiModerationAction ?? 'delete') as AutomodAction
  const ai_level = (config.aiModerationLevel ?? 'medio') as AiModerationLevel

  const addWord = () => {
    const trimmed = newWord.trim()
    if (!trimmed) return

    setConfig((prev) => ({
      ...prev,
      bannedWords: [...(prev.bannedWords || []), { word: trimmed, action: newWordAction }],
    }))
    setNewWord('')
    setNewWordAction('warn')
  }

  const removeWord = (index: number) => {
    const bannedWords = [...(config.bannedWords || [])]
    bannedWords.splice(index, 1)
    setConfig({ ...config, bannedWords })
  }

  const addDomain = () => {
    const trimmed = newDomain.trim()
    if (!trimmed) return
    const bannedDomains = [...(config.bannedDomains || []), trimmed]
    setConfig({ ...config, bannedDomains })
    setNewDomain('')
  }

  const removeDomain = (index: number) => {
    const bannedDomains = [...(config.bannedDomains || [])]
    bannedDomains.splice(index, 1)
    setConfig({ ...config, bannedDomains })
  }

  return (
    <>
      <PageSection title="O que significa cada ação?">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Em todas as ações abaixo, o bot <span className="font-semibold text-foreground">sempre deleta a mensagem</span> primeiro. Depois, ele
            aplica a punição escolhida.
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(Object.keys(getAutomodActionLabel) as AutomodAction[]).map((key) => (
              <div key={key} className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                <div className="text-sm font-medium">{getAutomodActionLabel(key)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{getAutomodActionDescription(key)}</div>
              </div>
            ))}
          </div>
        </div>
      </PageSection>

      <PageSection title="Filtro de palavras">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              label={config.wordFilterEnabled ? 'Ativado' : 'Desativado'}
              disabled={isLoading}
            />
          </div>

          {config.wordFilterEnabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_44px]">
                <Input
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Digite uma palavra..."
                  onKeyDown={(e) => e.key === 'Enter' && addWord()}
                />
                <Select value={newWordAction} onValueChange={(value) => setNewWordAction(value as AutomodAction)}>
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

              <div className="text-xs text-muted-foreground">{getAutomodActionDescription(newWordAction)}</div>

              <div className="space-y-2">
                {(config.bannedWords || []).map((item, index) => (
                  <div key={index} className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="truncate font-mono text-sm">{item.word}</span>
                      <span className="rounded-full border border-border/70 bg-surface/70 px-2.5 py-1 text-xs text-muted-foreground">
                        {getAutomodActionLabel((item.action as AutomodAction) ?? 'warn') ?? item.action}
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
        </div>
      </PageSection>

      <PageSection title="Anti-CAPS">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              label={config.capsEnabled ? 'Ativado' : 'Desativado'}
              disabled={isLoading}
            />
          </div>

          {config.capsEnabled && (
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
                  <Select value={caps_action} onValueChange={(value) => setConfig({ ...config, capsAction: value })}>
                    <option value="delete">Deletar</option>
                    <option value="warn">Avisar</option>
                    <option value="mute">Silenciar</option>
                    <option value="kick">Expulsar</option>
                    <option value="ban">Banir</option>
                  </Select>
                  <div className="mt-2 text-xs text-muted-foreground">{getAutomodActionDescription(caps_action)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageSection>

      <PageSection title="Filtro de links">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <LinkIcon className="h-5 w-5 text-accent" />
              <div>
                <div className="text-sm font-semibold">Filtro de links</div>
                <div className="text-xs text-muted-foreground">Controlar o compartilhamento de links no servidor</div>
              </div>
            </div>

            <Switch
              checked={Boolean(config.linkFilterEnabled)}
              onCheckedChange={(checked) => setConfig({ ...config, linkFilterEnabled: checked })}
              label={config.linkFilterEnabled ? 'Ativado' : 'Desativado'}
              disabled={isLoading}
            />
          </div>

          {config.linkFilterEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium">Ação</div>
                  <div className="mt-2">
                    <Select value={link_action} onValueChange={(value) => setConfig({ ...config, linkAction: value })}>
                      <option value="delete">Deletar</option>
                      <option value="warn">Avisar</option>
                      <option value="mute">Silenciar</option>
                      <option value="kick">Expulsar</option>
                      <option value="ban">Banir</option>
                    </Select>
                    <div className="mt-2 text-xs text-muted-foreground">{getAutomodActionDescription(link_action)}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Bloquear todos os links?</div>
                  <div className="mt-2">
                    <Switch
                      checked={config.linkBlockAll ?? false}
                      onCheckedChange={(checked) => setConfig({ ...config, linkBlockAll: checked })}
                      label="Bloquear todos os links"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {!config.linkBlockAll && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Domínios bloqueados</div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_44px]">
                    <Input
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="Digite um domínio..."
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
                        Nenhum domínio adicionado
                      </div>
                    )}

                    {isLoading && <Skeleton className="h-12 w-full" />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PageSection>

      {showAiSection && (
        <PageSection title="Moderação por IA">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <BrainCircuit className="h-5 w-5 text-accent" />
                <div>
                  <div className="text-sm font-semibold">Moderação por IA</div>
                  <div className="text-xs text-muted-foreground">Analisa texto e imagens automaticamente</div>
                </div>
              </div>

              <Switch
                checked={Boolean(config.aiModerationEnabled)}
                onCheckedChange={(checked) => setConfig({ ...config, aiModerationEnabled: checked })}
                label={config.aiModerationEnabled ? 'Ativado' : 'Desativado'}
                disabled={isLoading}
              />
            </div>

            {config.aiModerationEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">Ação</div>
                    <div className="mt-2">
                      <Select value={ai_action} onValueChange={(value) => setConfig({ ...config, aiModerationAction: value })}>
                        <option value="delete">Deletar</option>
                        <option value="warn">Avisar</option>
                        <option value="mute">Silenciar</option>
                        <option value="kick">Expulsar</option>
                        <option value="ban">Banir</option>
                      </Select>
                      <div className="mt-2 text-xs text-muted-foreground">{getAutomodActionDescription(ai_action)}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Nível de detecção</div>
                    <div className="mt-2">
                      <Select
                        value={ai_level}
                        onValueChange={(value) => setConfig({ ...config, aiModerationLevel: value as AiModerationLevel })}
                      >
                        <option value="permissivo">{getAiLevelLabel('permissivo')}</option>
                        <option value="brando">{getAiLevelLabel('brando')}</option>
                        <option value="medio">{getAiLevelLabel('medio')}</option>
                        <option value="rigoroso">{getAiLevelLabel('rigoroso')}</option>
                        <option value="maximo">{getAiLevelLabel('maximo')}</option>
                      </Select>
                      <div className="mt-2 text-xs text-muted-foreground">{getAiLevelDescription(ai_level, true)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PageSection>
      )}
    </>
  )
}
