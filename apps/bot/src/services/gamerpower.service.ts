import axios from 'axios'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

// ============================================
// Types - Interface definitions (PT-BR comments, English code)
// ============================================

/**
 * Interface que representa um giveaway da API GamerPower.
 * Representa um jogo/item gratuito disponível na plataforma GamerPower.
 */
export interface GamerPowerGiveaway {
  /** ID único do giveaway */
  id: number
  /** Título do jogo/item */
  title: string
  /** Valor estimado do jogo/item */
  worth: string
  /** URL da miniatura (thumbnail) */
  thumbnail: string
  /** URL da imagem principal */
  image: string
  /** Descrição do giveaway */
  description: string
  /** Instruções de como reivindicar o giveaway */
  instructions: string
  /** URL do giveaway na GamerPower (deprecated, use open_giveaway_url ou gamerpower_url) */
  giveaway_url?: string
  /** URL do giveaway na GamerPower (abre na página de detalhes) */
  open_giveaway_url?: string
  /** Plataformas onde o giveaway está disponível (array de strings) */
  platforms: string[]
  /** Tipo de giveaway (game, loot, beta) */
  type: string
  /** Data de término do giveaway */
  end_date: string
  /** Número de usuários que participaram */
  users: number
  /** Status do giveaway (active, ended) */
  status: string
  /** URL do giveaway no GamerPower */
  gamerpower_url: string
  /** Data de publicação do giveaway */
  published_at: string
}

/**
 * Opções para filtrar giveaways.
 * Opções de filtragem para a listagem de giveaways.
 */
export interface GetAllGiveawaysOptions {
  /** Filtro por plataformas (ex: "steam", "epic-games-store", "gog", etc) */
  platforms?: string[]
  /** Filtro por tipo (ex: "game", "loot", "beta") */
  types?: string[]
  /** Ordenação por: "date", "value", ou "popularity" */
  sortBy?: 'date' | 'value' | 'popularity'
}

// ============================================
// Constants - Platform and Type constants
// ============================================

/**
 * Constantes de plataformas disponíveis na GamerPower.
 * Plataformas suportadas pela API GamerPower.
 */
export const GAMERPOWER_PLATFORMS = [
  { id: 'steam', name: 'Steam', namePtBr: 'Steam' },
  { id: 'epic-games-store', name: 'Epic Games Store', namePtBr: 'Epic Games Store' },
  { id: 'gog', name: 'GOG', namePtBr: 'GOG' },
  { id: 'itch.io', name: 'Itch.io', namePtBr: 'Itch.io' },
  { id: 'xbox', name: 'Xbox', namePtBr: 'Xbox' },
  { id: 'xbox-series-xs', name: 'Xbox Series X|S', namePtBr: 'Xbox Series X|S' },
  { id: 'ps4', name: 'PS4', namePtBr: 'PS4' },
  { id: 'ps5', name: 'PS5', namePtBr: 'PS5' },
  { id: 'android', name: 'Android', namePtBr: 'Android' },
  { id: 'ios', name: 'iOS', namePtBr: 'iOS' },
  { id: 'switch', name: 'Nintendo Switch', namePtBr: 'Nintendo Switch' },
  { id: 'vr', name: 'VR', namePtBr: 'Realidade Virtual' },
  { id: 'ubisoft', name: 'Ubisoft', namePtBr: 'Ubisoft' },
  { id: 'battlenet', name: 'Battle.net', namePtBr: 'Battle.net' },
  { id: 'origin', name: 'Origin', namePtBr: 'Origin' },
  { id: 'drm-free', name: 'DRM-Free', namePtBr: 'Sem DRM' },
] as const

/**
 * Constantes de tipos de giveaway disponíveis na GamerPower.
 * Tipos de giveaways suportados pela API GamerPower.
 */
export const GAMERPOWER_TYPES = [
  { id: 'game', name: 'Game', namePtBr: 'Jogo' },
  { id: 'loot', name: 'Loot', namePtBr: 'Itens' },
  { id: 'beta', name: 'Beta', namePtBr: 'Beta' },
] as const

// ============================================
// Service - GamerPower API Service
// ============================================

const GAMERPOWER_API_BASE = 'https://gamerpower.com/api'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000
const DEFAULT_MAX_ATTEMPTS = 2
const DEFAULT_RETRY_DELAY_MS = 750

type http_get = <T>(url: string, options: { timeout: number; headers: { Accept: string } }) => Promise<{ data: T }>

type cache_entry<T> = {
  expires_at: number
  data: T
}

function parse_int_env(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Serviço para interagir com a API da GamerPower.
 * Service to interact with the GamerPower API.
 */
export class GamerPowerService {
  private readonly http_get: http_get
  private readonly cache_ttl_ms: number
  private readonly max_attempts: number
  private readonly retry_delay_ms: number
  private readonly cache = new Map<string, cache_entry<unknown>>()

  constructor(options?: {
    http_get?: http_get
    cache_ttl_ms?: number
    max_attempts?: number
    retry_delay_ms?: number
  }) {
    this.http_get = options?.http_get ?? (axios.get as unknown as http_get)
    this.cache_ttl_ms = Math.max(
      0,
      options?.cache_ttl_ms ?? parse_int_env(process.env.GAMERPOWER_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS)
    )
    this.max_attempts = Math.max(1, options?.max_attempts ?? DEFAULT_MAX_ATTEMPTS)
    this.retry_delay_ms = Math.max(0, options?.retry_delay_ms ?? DEFAULT_RETRY_DELAY_MS)
  }

  /**
   * Obtém todos os giveaways ativos, com opções de filtro.
   * Fetch all active giveaways with optional filtering.
   *
   * @param options - Opções de filtro (platforms, types, sortBy)
   * @returns Array de giveaways ou array vazio em caso de erro
   */
  async getAllGiveaways(options?: GetAllGiveawaysOptions): Promise<GamerPowerGiveaway[]> {
    const primary_url = this.build_giveaways_url(options)

    try {
      const data = await this.fetch_json<GamerPowerGiveaway[]>(primary_url, 'GamerPower giveaways')
      const giveaways = data ?? []
      this.set_cache(primary_url, giveaways)
      return giveaways
    } catch (error) {
      const maybe_status = this.get_http_status(error)

      if (maybe_status === 404) {
        const fallback_urls = this.build_giveaways_fallback_urls(options)

        for (const url of fallback_urls) {
          try {
            const data = await this.fetch_json<GamerPowerGiveaway[]>(url, 'GamerPower giveaways fallback')
            const giveaways = data ?? []
            this.set_cache(primary_url, giveaways)
            this.set_cache(url, giveaways)
            return giveaways
          } catch {
            continue
          }
        }
      }

      const cached = this.get_cache<GamerPowerGiveaway[]>(primary_url)
      if (cached) {
        logger.warn(
          { err: safe_error_details(error), url: primary_url },
          'GamerPower giveaways request failed; using cached response'
        )
        return cached
      }

      logger.warn(
        { err: safe_error_details(error), url: primary_url },
        'GamerPower giveaways request failed'
      )
      return []
    }
  }

  /**
   * Obtém um giveaway específico pelo ID.
   * Fetch a specific giveaway by ID.
   *
   * @param id - ID do giveaway
   * @returns Giveaway ou null se não encontrado ou em caso de erro
   */
  async getGiveawayById(id: number): Promise<GamerPowerGiveaway | null> {
    const url = `${GAMERPOWER_API_BASE}/giveaway?id=${id}`
    try {
      return (await this.fetch_json<GamerPowerGiveaway>(url, 'GamerPower giveaway')) ?? null
    } catch (error) {
      logger.warn(
        { err: safe_error_details(error), giveawayId: id, url },
        'GamerPower giveaway request failed'
      )
      return null
    }
  }

  /**
   * Obtém o valor total de todos os giveaways ativos.
   * Get total worth of all active giveaways.
   *
   * @returns Valor total em string ou "$0" em caso de erro
   */
  async getTotalWorth(): Promise<string> {
    const url = `${GAMERPOWER_API_BASE}/worth`
    try {
      const response = await this.fetch_json<{ worth: string }>(url, 'GamerPower worth')
      return response?.worth ?? '$0'
    } catch (error) {
      logger.warn({ err: safe_error_details(error), url }, 'GamerPower worth request failed')
      return '$0'
    }
  }

  private async fetch_json<T>(url: string, label: string): Promise<T | null> {
    let last_error: unknown = null

    for (let attempt = 1; attempt <= this.max_attempts; attempt += 1) {
      try {
        const response = await this.http_get<T>(url, {
          timeout: DEFAULT_TIMEOUT_MS,
          headers: {
            Accept: 'application/json',
          },
        })
        return response.data ?? null
      } catch (error) {
        last_error = error
        if (!this.is_retryable_error(error) || attempt >= this.max_attempts) {
          throw error
        }

        logger.debug(
          { err: safe_error_details(error), url, attempt, maxAttempts: this.max_attempts },
          `${label} request failed; retrying`
        )
        if (this.retry_delay_ms > 0) {
          await sleep(this.retry_delay_ms)
        }
      }
    }

    throw last_error
  }

  private get_cache<T>(key: string): T | null {
    const entry = this.cache.get(key) as cache_entry<T> | undefined
    if (!entry) return null
    if (entry.expires_at <= Date.now()) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  private set_cache<T>(key: string, data: T): void {
    if (this.cache_ttl_ms <= 0) return
    this.cache.set(key, {
      expires_at: Date.now() + this.cache_ttl_ms,
      data,
    })
  }

  private build_giveaways_url(options?: GetAllGiveawaysOptions): string {
    const params = new URLSearchParams()

    // Add platform filters
    if (options?.platforms && options.platforms.length > 0) {
      params.append('platform', options.platforms.join(','))
    }

    // Add type filters
    // GamerPower API expects a single type value. Passing multiple values may return 404.
    if (options?.types && options.types.length === 1 && options.types[0]) {
      params.append('type', options.types[0])
    }

    // Add sortBy
    if (options?.sortBy) {
      params.append('sort-by', options.sortBy)
    }

    const query_string = params.toString()
    return query_string ? `${GAMERPOWER_API_BASE}/giveaways?${query_string}` : `${GAMERPOWER_API_BASE}/giveaways`
  }

  private build_giveaways_fallback_urls(options?: GetAllGiveawaysOptions): string[] {
    const urls: string[] = []

    // Retry without type (in case API doesn't accept our type filter)
    if (options?.types && options.types.length > 0) {
      urls.push(this.build_giveaways_url({ ...options, types: undefined }))
    }

    // Retry without platform
    if (options?.platforms && options.platforms.length > 0) {
      urls.push(this.build_giveaways_url({ ...options, platforms: undefined }))
    }

    // Retry without any filters (but keep sortBy)
    urls.push(this.build_giveaways_url({ sortBy: options?.sortBy }))

    // Retry plain endpoint
    urls.push(`${GAMERPOWER_API_BASE}/giveaways`)

    return Array.from(new Set(urls))
  }

  private get_http_status(error: unknown): number | null {
    if (axios.isAxiosError(error)) {
      return (error.response?.status ?? null) as number | null
    }
    const status = (error as { response?: { status?: unknown }; status?: unknown } | null)?.response?.status
    if (typeof status === 'number') return status
    const direct_status = (error as { status?: unknown } | null)?.status
    if (typeof direct_status === 'number') return direct_status
    return null
  }

  private is_retryable_error(error: unknown): boolean {
    const status = this.get_http_status(error)
    if (typeof status === 'number') {
      return status === 408 || status === 425 || status === 429 || status >= 500
    }

    const code = (error as { code?: unknown } | null)?.code
    if (typeof code !== 'string') return true

    return [
      'ECONNABORTED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'ENOTFOUND',
      'ENETUNREACH',
      'EHOSTUNREACH',
    ].includes(code)
  }
}

// Export singleton instance
export const gamerPowerService = new GamerPowerService()

/**
 * Obtém a URL do giveaway com fallback para campos alternativos.
 * Prioriza: open_giveaway_url > gamerpower_url > giveaway_url
 * @param giveaway - Giveaway da GamerPower
 * @returns URL do giveaway ou string vazia se não disponível
 */
export function getGiveawayUrl(giveaway: GamerPowerGiveaway): string {
  return giveaway.open_giveaway_url ?? giveaway.gamerpower_url ?? giveaway.giveaway_url ?? ''
}
