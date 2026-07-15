import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import axios from 'axios'

import OwnerPanelAiPage from './OwnerPanelAi'
import { getApiUrl } from '../env'

vi.mock('axios')
vi.mock('../env', () => ({
  getApiUrl: () => 'http://localhost:3000',
}))

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, staleTime: 0, retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <OwnerPanelAiPage />
    </QueryClientProvider>,
  )
}

describe('OwnerPanelAiPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'mistral',
          customModel: 'opaque/test-model',
          customReasoningMode: 'omit',
          fallbackEnabled: false,
          sensitiveContextEnabled: false,
        },
        runtimes: {
          mistralPanelAgentConfigured: true,
          customProviderConfigured: true,
        },
        catalog: {
          models: [
            { id: 'opaque/test-model', group: 'opaque', label: 'test-model' },
            { id: 'opaque/model-2', group: 'opaque', label: 'model-2' },
          ],
          syncedAt: null,
          error: null,
          refreshing: false,
        },
      },
    })
  })

  test('renders page title and populates initial saved settings', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Ella no Painel')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Runtime principal' })).toHaveTextContent('Mistral Panel Agent')
    expect(screen.getByRole('switch', { name: 'Fallback de texto' })).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Modelo' })).not.toBeInTheDocument()
  })

  test('shows custom model and reasoning controls when custom is primary or fallback enabled', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'mistral',
          customModel: 'opaque/test-model',
          customReasoningMode: 'high',
          fallbackEnabled: true,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: true },
        catalog: {
          models: [{ id: 'opaque/test-model', group: 'opaque', label: 'test-model' }],
          syncedAt: null,
          error: null,
          refreshing: false,
        },
      },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Modelo' })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Configuração de raciocínio' })).toHaveTextContent('Alto')
  })

  test('reasoning selector contains exactly six exact values and accessible labels', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'custom',
          customModel: 'opaque/test-model',
          customReasoningMode: 'omit',
          fallbackEnabled: false,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: true },
        catalog: {
          models: [{ id: 'opaque/test-model', group: 'opaque', label: 'test-model' }],
          syncedAt: null,
          error: null,
          refreshing: false,
        },
      },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configuração de raciocínio' })).toBeInTheDocument()
    })

    const reasoningBtn = screen.getByRole('button', { name: 'Configuração de raciocínio' })
    fireEvent.click(reasoningBtn)

    const options = screen.getAllByRole('option')
    expect(options.length).toBe(6)
    expect(options.map((o) => o.textContent)).toEqual([
      'Padrão do modelo — não enviar parâmetro',
      'Desativado',
      'Mínimo',
      'Baixo',
      'Médio',
      'Alto',
    ])
  })

  test('save button sends exact payload fields and custom primary always sends fallbackEnabled false', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'custom',
          customModel: 'opaque/test-model',
          customReasoningMode: 'medium',
          fallbackEnabled: false,
          sensitiveContextEnabled: true,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: true },
        catalog: {
          models: [{ id: 'opaque/test-model', group: 'opaque', label: 'test-model' }],
          syncedAt: null,
          error: null,
          refreshing: false,
        },
      },
    })
    vi.mocked(axios.put).mockResolvedValue({ data: { success: true } })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Runtime principal' })).toHaveTextContent('Custom Provider')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }))

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(`${getApiUrl()}/api/owner/panel-ai`, {
        panelProvider: 'custom',
        customModel: 'opaque/test-model',
        customReasoningMode: 'medium',
        fallbackEnabled: false,
        sensitiveContextEnabled: true,
      })
    })
  })

  test('missing model disables save when custom controls are active', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'custom',
          customModel: '',
          customReasoningMode: 'omit',
          fallbackEnabled: false,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: true },
        catalog: { models: [], syncedAt: null, error: null, refreshing: false },
      },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Salvar configuração' })).toBeDisabled()
    })
  })

  test('fallback cannot be newly enabled while custom provider is unconfigured', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'mistral',
          customModel: null,
          customReasoningMode: 'omit',
          fallbackEnabled: false,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: false },
        catalog: { models: [], syncedAt: null, error: null, refreshing: false },
      },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Fallback de texto' })).toBeInTheDocument()
    })

    const fallbackSwitch = screen.getByRole('switch', { name: 'Fallback de texto' })
    expect(fallbackSwitch).toBeDisabled()
  })

  test('stale enabled fallback can be disabled while custom provider is unconfigured', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'mistral',
          customModel: 'opaque/test-model',
          customReasoningMode: 'omit',
          fallbackEnabled: true,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: false },
        catalog: { models: [], syncedAt: null, error: null, refreshing: false },
      },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Fallback de texto' })).not.toBeDisabled()
    })

    const fallbackSwitch = screen.getByRole('switch', { name: 'Fallback de texto' })
    expect(screen.getByText(/O Custom Provider não está configurado por ambiente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar configuração' })).toBeDisabled()

    fireEvent.click(fallbackSwitch)
    expect(fallbackSwitch).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Salvar configuração' })).not.toBeDisabled()
  })

  test('model change and reasoning mode change both reset local test status', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'custom',
          customModel: 'opaque/test-model',
          customReasoningMode: 'omit',
          fallbackEnabled: false,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: true },
        catalog: {
          models: [
            { id: 'opaque/test-model', group: 'opaque', label: 'test-model' },
            { id: 'opaque/model-2', group: 'opaque', label: 'model-2' },
          ],
          syncedAt: null,
          error: null,
          refreshing: false,
        },
      },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Status do teste local:')).toBeInTheDocument()
    })

    expect(screen.getByText('Não testado')).toBeInTheDocument()

    // Test reasoning change resets status
    const reasoningBtn = screen.getByRole('button', { name: 'Configuração de raciocínio' })
    fireEvent.click(reasoningBtn)
    const highOption = screen.getByRole('option', { name: 'Alto' })
    fireEvent.click(highOption)
    expect(screen.getByText('Não testado')).toBeInTheDocument()

    // Test model change resets status
    const modelBtn = screen.getByRole('button', { name: 'Modelo' })
    fireEvent.click(modelBtn)
    const model2Option = screen.getByRole('option', { name: 'opaque · model-2 — opaque/model-2' })
    fireEvent.click(model2Option)
    expect(screen.getByText('Não testado')).toBeInTheDocument()
  })

  test('provider change resets fallback state when switching to custom', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'mistral',
          customModel: 'opaque/test-model',
          customReasoningMode: 'omit',
          fallbackEnabled: true,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: true },
        catalog: {
          models: [{ id: 'opaque/test-model', group: 'opaque', label: 'test-model' }],
          syncedAt: null,
          error: null,
          refreshing: false,
        },
      },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Fallback de texto' })).toBeChecked()
    })

    const providerBtn = screen.getByRole('button', { name: 'Runtime principal' })
    fireEvent.click(providerBtn)
    const customOption = screen.getByRole('option', { name: 'Custom Provider' })
    fireEvent.click(customOption)

    expect(screen.queryByRole('switch', { name: 'Fallback de texto' })).not.toBeInTheDocument()
  })

  test('testPrimary triggers primary test request', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { success: true, result: { latencyMs: 42 } } })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Testar runtime principal' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Testar runtime principal' }))

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(`${getApiUrl()}/api/owner/panel-ai/test`, { target: 'primary' })
    })
  })

  test('testCustom triggers unsaved model test request and updates local test status labels', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        settings: {
          panelProvider: 'custom',
          customModel: 'opaque/test-model',
          customReasoningMode: 'high',
          fallbackEnabled: false,
          sensitiveContextEnabled: false,
        },
        runtimes: { mistralPanelAgentConfigured: true, customProviderConfigured: true },
        catalog: {
          models: [{ id: 'opaque/test-model', group: 'opaque', label: 'test-model' }],
          syncedAt: null,
          error: null,
          refreshing: false,
        },
      },
    })

    // Successful test
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { success: true, result: { target: 'custom', model: 'opaque/test-model', reasoningMode: 'high', latencyMs: 18 } },
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Testar modelo selecionado' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Testar modelo selecionado' }))

    await waitFor(() => {
      expect(screen.getByText('Testado com sucesso')).toBeInTheDocument()
    })

    expect(axios.post).toHaveBeenCalledWith(`${getApiUrl()}/api/owner/panel-ai/test`, {
      target: 'custom',
      customModel: 'opaque/test-model',
      customReasoningMode: 'high',
    })

    // Failed test
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Test error'))

    fireEvent.click(screen.getByRole('button', { name: 'Testar modelo selecionado' }))

    await waitFor(() => {
      expect(screen.getByText('Último teste falhou')).toBeInTheDocument()
    })
  })
})
