import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, Select, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type model = { id: string; group: string; label: string }
type panel_ai_response = {
  settings: { panelProvider: 'mistral' | 'custom'; customModel: string | null; sensitiveContextEnabled: boolean }
  runtimes: { mistralPanelAgentConfigured: boolean; customProviderConfigured: boolean }
  catalog: { models: model[]; syncedAt: string | null; error: string | null; refreshing: boolean }
}

export default function OwnerPanelAiPage() {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<'mistral' | 'custom'>('mistral')
  const [model, setModel] = useState('')
  const [sensitive, setSensitive] = useState(false)
  const settingsQuery = useQuery({
    queryKey: ['owner', 'panel-ai'],
    queryFn: async () => (await axios.get(`${API_URL}/api/owner/panel-ai`)).data as panel_ai_response,
    refetchInterval: (query) => query.state.data?.catalog.refreshing ? 3_000 : false,
  })

  useEffect(() => {
    const settings = settingsQuery.data?.settings
    if (!settings) return
    setProvider(settings.panelProvider)
    setModel(settings.customModel ?? '')
    setSensitive(settings.sensitiveContextEnabled)
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: async () => axios.put(`${API_URL}/api/owner/panel-ai`, { panelProvider: provider, customModel: model || null, sensitiveContextEnabled: sensitive }),
    onSuccess: () => { toast_success('Configuração da Ella atualizada.', 'Owner'); queryClient.invalidateQueries({ queryKey: ['owner', 'panel-ai'] }) },
    onError: (error: any) => toast_error(error.response?.data?.error || 'Não foi possível salvar.', 'Owner'),
  })
  const refresh = useMutation({
    mutationFn: async () => axios.post(`${API_URL}/api/owner/panel-ai/catalog/refresh`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner', 'panel-ai'] }),
    onError: (error: any) => toast_error(error.response?.data?.error || 'Não foi possível atualizar a lista.', 'Owner'),
  })
  const test = useMutation({
    mutationFn: async () => axios.post(`${API_URL}/api/owner/panel-ai/test`),
    onSuccess: (response) => toast_success(`Teste concluído em ${response.data.result.latencyMs} ms.`, 'Owner'),
    onError: (error: any) => toast_error(error.response?.data?.error || 'Teste falhou.', 'Owner'),
  })
  const data = settingsQuery.data

  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-bold">Ella no Painel</h1><p className="mt-1 text-sm text-muted-foreground">Runtime global, exclusivo do Owner. Alterações reiniciam as conversas ativas.</p></div>
    <Card><CardContent className="space-y-5 p-6">
      <div className="flex items-center justify-between"><div><div className="font-semibold">Mistral Panel Agent</div><div className="text-sm text-muted-foreground">{data?.runtimes.mistralPanelAgentConfigured ? 'Configurado' : 'Não configurado'}</div></div></div>
      <div className="flex items-center justify-between"><div><div className="font-semibold">Custom Provider</div><div className="text-sm text-muted-foreground">{data?.runtimes.customProviderConfigured ? 'Configurado por ambiente' : 'Não configurado'}</div></div><Button variant="outline" onClick={() => refresh.mutate()} isLoading={refresh.isPending} disabled={!data?.runtimes.customProviderConfigured}>Atualizar modelos</Button></div>
      {data?.catalog.error && <p className="text-sm text-destructive">A lista anterior foi mantida: {data.catalog.error}</p>}
      <Select value={provider} onValueChange={(value) => setProvider(value as 'mistral' | 'custom')}><option value="mistral">Mistral Panel Agent</option><option value="custom" disabled={!data?.runtimes.customProviderConfigured}>Custom Provider</option></Select>
      {provider === 'custom' && <div className="space-y-2"><Select value={model} onValueChange={setModel} placeholder="Selecione um modelo"><option value="" disabled>Selecione um modelo</option>{(data?.catalog.models ?? []).map((item) => <option key={item.id} value={item.id}>{item.group} · {item.label} — {item.id}</option>)}</Select><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">O seletor tem busca. O ID é enviado sem alteração.</span></div></div>}
      <div className="flex items-center justify-between gap-4 border-t border-border pt-4"><div><div className="font-semibold">Contexto sensível</div><div className="text-sm text-muted-foreground">Desativado por padrão. Qualquer envio ainda exige confirmação explícita do usuário.</div></div><Switch checked={sensitive} onCheckedChange={setSensitive} /></div>
      <div className="flex gap-2"><Button onClick={() => save.mutate()} isLoading={save.isPending} disabled={provider === 'custom' && !model}>Salvar runtime global</Button><Button variant="outline" onClick={() => test.mutate()} isLoading={test.isPending} disabled={provider === 'custom' && !model}>Testar runtime ativo</Button></div>
    </CardContent></Card>
  </div>
}
