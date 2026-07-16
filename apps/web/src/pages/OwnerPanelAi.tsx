import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, Select, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type model = { id: string; group: string; label: string }
export type custom_provider_reasoning_mode = 'omit' | 'none' | 'minimal' | 'low' | 'medium' | 'high'
type local_test_status = 'Não testado' | 'Testando' | 'Testado com sucesso' | 'Último teste falhou'

type panel_ai_response = {
  settings: {
    panelProvider: 'mistral' | 'custom'
    customModel: string | null
    customReasoningMode: custom_provider_reasoning_mode
    fallbackEnabled: boolean
    discordTextFallbackEnabled: boolean
    sensitiveContextEnabled: boolean
  }
  runtimes: { mistralPanelAgentConfigured: boolean; customProviderConfigured: boolean }
  catalog: { models: model[]; syncedAt: string | null; error: string | null; refreshing: boolean }
}

export default function OwnerPanelAiPage() {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<'mistral' | 'custom'>('mistral')
  const [model, setModel] = useState('')
  const [reasoningMode, setReasoningMode] = useState<custom_provider_reasoning_mode>('omit')
  const [fallbackEnabled, setFallbackEnabled] = useState(false)
  const [discordTextFallbackEnabled, setDiscordTextFallbackEnabled] = useState(false)
  const [sensitive, setSensitive] = useState(false)
  const [testStatus, setTestStatus] = useState<local_test_status>('Não testado')

  const settingsQuery = useQuery({
    queryKey: ['owner', 'panel-ai'],
    queryFn: async () => (await axios.get(`${API_URL}/api/owner/panel-ai`)).data as panel_ai_response,
    refetchInterval: (query) => (query.state.data?.catalog.refreshing ? 3_000 : false),
  })

  useEffect(() => {
    const settings = settingsQuery.data?.settings
    if (!settings) return
    setProvider(settings.panelProvider)
    setModel(settings.customModel ?? '')
    setReasoningMode(settings.customReasoningMode ?? 'omit')
    setFallbackEnabled(settings.fallbackEnabled ?? false)
    setDiscordTextFallbackEnabled(settings.discordTextFallbackEnabled ?? false)
    setSensitive(settings.sensitiveContextEnabled)
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: async () =>
      axios.put(`${API_URL}/api/owner/panel-ai`, {
        panelProvider: provider,
        customModel: model || null,
        customReasoningMode: reasoningMode,
        fallbackEnabled: provider === 'custom' ? false : fallbackEnabled,
        discordTextFallbackEnabled,
        sensitiveContextEnabled: sensitive,
      }),
    onSuccess: () => {
      toast_success('Configuração da Ella atualizada.', 'Owner')
      queryClient.invalidateQueries({ queryKey: ['owner', 'panel-ai'] })
    },
    onError: (error: any) => toast_error(error.response?.data?.error || 'Não foi possível salvar.', 'Owner'),
  })

  const refresh = useMutation({
    mutationFn: async () => axios.post(`${API_URL}/api/owner/panel-ai/catalog/refresh`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner', 'panel-ai'] }),
    onError: (error: any) => toast_error(error.response?.data?.error || 'Não foi possível atualizar a lista.', 'Owner'),
  })

  const testPrimary = useMutation({
    mutationFn: async () => axios.post(`${API_URL}/api/owner/panel-ai/test`, { target: 'primary' }),
    onSuccess: (response) => {
      toast_success(`Teste principal concluído em ${response.data.result.latencyMs} ms.`, 'Owner')
    },
    onError: (error: any) => toast_error(error.response?.data?.error || 'Teste falhou.', 'Owner'),
  })

  const testCustom = useMutation({
    mutationFn: async () => {
      setTestStatus('Testando')
      return axios.post(`${API_URL}/api/owner/panel-ai/test`, {
        target: 'custom',
        customModel: model,
        customReasoningMode: reasoningMode,
      })
    },
    onSuccess: (response) => {
      setTestStatus('Testado com sucesso')
      toast_success(`Teste do modelo concluído em ${response.data.result.latencyMs} ms.`, 'Owner')
    },
    onError: (error: any) => {
      setTestStatus('Último teste falhou')
      toast_error(error.response?.data?.error || 'Teste falhou.', 'Owner')
    },
  })

  const data = settingsQuery.data
  const customConfigured = data?.runtimes.customProviderConfigured ?? false
  const showCustomControls = provider === 'custom' || (provider === 'mistral' && (fallbackEnabled || discordTextFallbackEnabled))

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ella no Painel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Runtime global, exclusivo do Owner. Alterações reiniciam as conversas ativas.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Mistral Panel Agent</div>
              <div className="text-sm text-muted-foreground">
                {data?.runtimes.mistralPanelAgentConfigured ? 'Configurado' : 'Não configurado'}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Custom Provider</div>
              <div className="text-sm text-muted-foreground">
                {customConfigured ? 'Configurado por ambiente' : 'Não configurado'}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => refresh.mutate()}
              isLoading={refresh.isPending}
              disabled={!customConfigured}
            >
              Atualizar modelos
            </Button>
          </div>

          {data?.catalog.error && (
            <p className="text-sm text-destructive">A lista anterior foi mantida: {data.catalog.error}</p>
          )}

          <div className="space-y-2">
            <label htmlFor="select-primary-runtime" className="text-sm font-medium">
              Runtime Principal
            </label>
            <Select
              id="select-primary-runtime"
              aria-label="Runtime principal"
              value={provider}
              onValueChange={(value) => {
                const next = value as 'mistral' | 'custom'
                setProvider(next)
                if (next === 'custom') {
                  setFallbackEnabled(false)
                }
              }}
            >
              <option value="mistral">Mistral Panel Agent</option>
              <option value="custom" disabled={!customConfigured}>
                Custom Provider
              </option>
            </Select>
          </div>

          {provider === 'mistral' && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">Fallback de texto</div>
                    <div className="text-sm text-muted-foreground">
                      Usado quando o Agent principal estiver indisponível ou em limite de cota. Usa o modelo selecionado do Custom Provider. A Ella continua sendo uma assistente de texto. Os administradores do servidor não veem detalhes de infraestrutura.
                    </div>
                  </div>
                  <Switch
                    label="Fallback de texto"
                    checked={fallbackEnabled}
                    onCheckedChange={setFallbackEnabled}
                    disabled={!customConfigured && !fallbackEnabled}
                  />
                </div>
                {fallbackEnabled && !customConfigured && (
                  <p className="text-xs text-amber-500 font-medium">
                    O Custom Provider não está configurado por ambiente. O fallback está desativado na prática até que as variáveis de ambiente sejam definidas.
                  </p>
                )}
              </div>
          )}

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">Yue no Discord</div>
                    <div className="text-sm text-muted-foreground">
                      Quando a Mistral não estiver disponível, a Yue poderá responder somente em texto pelo Custom Provider. Pesquisa, geração de imagens, ferramentas, anexos e fontes não são executados nesse modo.
                    </div>
                  </div>
                  <Switch
                    label="Fallback de texto da Yue"
                    checked={discordTextFallbackEnabled}
                    onCheckedChange={setDiscordTextFallbackEnabled}
                    disabled={!customConfigured && !discordTextFallbackEnabled}
                  />
                </div>
                {discordTextFallbackEnabled && !customConfigured && (
                  <p className="text-xs text-amber-500 font-medium">
                    O Custom Provider não está configurado por ambiente. O fallback está desativado na prática até que as variáveis de ambiente sejam definidas.
                  </p>
                )}
              </div>

          {showCustomControls && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label htmlFor="select-custom-model" className="text-sm font-medium">
                  Modelo
                </label>
                <Select
                  id="select-custom-model"
                  aria-label="Modelo"
                  value={model}
                  onValueChange={(val) => {
                    setModel(val)
                    setTestStatus('Não testado')
                  }}
                  placeholder="Selecione um modelo"
                >
                  <option value="" disabled>
                    Selecione um modelo
                  </option>
                  {(data?.catalog.models ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.group} · {item.label} — {item.id}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">O seletor tem busca. O ID é enviado sem alteração.</span>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="select-reasoning-mode" className="text-sm font-medium">
                  Configuração de raciocínio
                </label>
                <Select
                  id="select-reasoning-mode"
                  aria-label="Configuração de raciocínio"
                  value={reasoningMode}
                  onValueChange={(val) => {
                    setReasoningMode(val as custom_provider_reasoning_mode)
                    setTestStatus('Não testado')
                  }}
                >
                  <option value="omit">Padrão do modelo — não enviar parâmetro</option>
                  <option value="none">Desativado</option>
                  <option value="minimal">Mínimo</option>
                  <option value="low">Baixo</option>
                  <option value="medium">Médio</option>
                  <option value="high">Alto</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A compatibilidade depende do modelo selecionado. &quot;Padrão do modelo&quot; não envia o parâmetro de raciocínio. Use o botão de teste antes de salvar uma combinação desconhecida.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div>
              <div className="font-semibold">Contexto sensível</div>
              <div className="text-sm text-muted-foreground">
                Desativado por padrão. Qualquer envio ainda exige confirmação explícita do usuário.
              </div>
            </div>
            <Switch label="Contexto sensível" checked={sensitive} onCheckedChange={setSensitive} />
          </div>

          {showCustomControls && (
            <div className="text-xs text-muted-foreground">
              Status do teste local: <span className="font-medium text-foreground">{testStatus}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => save.mutate()}
              isLoading={save.isPending}
              disabled={(provider === 'custom' || fallbackEnabled || discordTextFallbackEnabled) && (!model || !customConfigured)}
            >
              Salvar configuração
            </Button>
            <Button
              variant="outline"
              onClick={() => testPrimary.mutate()}
              isLoading={testPrimary.isPending}
            >
              Testar runtime principal
            </Button>
            {showCustomControls && (
              <Button
                variant="outline"
                onClick={() => testCustom.mutate()}
                isLoading={testCustom.isPending}
                disabled={!model || !customConfigured}
              >
                Testar modelo selecionado
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
