import axios from 'axios'

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
  /** URL do giveaway na GamerPower */
  giveaway_url: string
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

type http_get = <T>(url: string, options: { timeout: number; headers: { Accept: string } }) => Promise<{ data: T }>

/**
 * Serviço para interagir com a API da GamerPower.
 * Service to interact with the GamerPower API.
 */
export class GamerPowerService {
  private readonly http_get: http_get

  constructor(options?: { http_get?: http_get }) {
    this.http_get = options?.http_get ?? (axios.get as unknown as http_get)
  }

  /**
   * Obtém todos os giveaways ativos, com opções de filtro.
   * Fetch all active giveaways with optional filtering.
   *
   * @param options - Opções de filtro (platforms, types, sortBy)
   * @returns Array de giveaways ou array vazio em caso de erro
   */
  async getAllGiveaways(options?: GetAllGiveawaysOptions): Promise<GamerPowerGiveaway[]> {
    try {
      const primary_url = this.build_giveaways_url(options)
      const response = await this.http_get<GamerPowerGiveaway[]>(primary_url, {
        timeout: 15_000,
        headers: {
          Accept: 'application/json',
        },
      })

      return response.data ?? []
    } catch (error) {
      const maybe_status = this.get_http_status(error)

      if (maybe_status === 404) {
        const fallback_urls = this.build_giveaways_fallback_urls(options)

        for (const url of fallback_urls) {
          try {
            const response = await this.http_get<GamerPowerGiveaway[]>(url, {
              timeout: 15_000,
              headers: {
                Accept: 'application/json',
              },
            })
            return response.data ?? []
          } catch {
            continue
          }
        }
      }

      console.error('GamerPowerService.getAllGiveaways: erro na requisição', error)
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
    try {
      const response = await this.http_get<GamerPowerGiveaway>(`${GAMERPOWER_API_BASE}/giveaway?id=${id}`, {
        timeout: 15_000,
        headers: {
          Accept: 'application/json',
        },
      })

      return response.data ?? null
    } catch (error) {
      console.error(`GamerPowerService.getGiveawayById: erro ao buscar giveaway ${id}`, error)
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
    try {
      const response = await this.http_get<{ worth: string }>(`${GAMERPOWER_API_BASE}/worth`, {
        timeout: 15_000,
        headers: {
          Accept: 'application/json',
        },
      })

      return response.data?.worth ?? '$0'
    } catch (error) {
      console.error('GamerPowerService.getTotalWorth: erro na requisição', error)
      return '$0'
    }
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
    return null
  }
}

// Export singleton instance
export const gamerPowerService = new GamerPowerService()