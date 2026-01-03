import crypto from 'node:crypto'

import axios from 'axios'

export type anilist_character = {
  id: number
  name: {
    full: string | null
    native: string | null
  }
  image: {
    large: string | null
  }
  gender: string | null
  favourites: number | null
}

export type anilist_anime = {
  id: number
  title: {
    romaji: string | null
    english: string | null
    native: string | null
  }
  coverImage: {
    extraLarge: string | null
    large: string | null
  }
  description: string | null
  siteUrl: string | null
  genres: string[]
  averageScore: number | null
  episodes: number | null
  status: string | null
  seasonYear: number | null
  format: string | null
}

type anilist_graphql_response<T> = {
  data?: T
  errors?: { message: string }[]
}

const ANILIST_ENDPOINT = 'https://graphql.anilist.co'

function random_int(min_inclusive: number, max_inclusive: number): number {
  if (max_inclusive < min_inclusive) return min_inclusive
  return crypto.randomInt(min_inclusive, max_inclusive + 1)
}

async function anilist_graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await axios.post<anilist_graphql_response<T>>(
    ANILIST_ENDPOINT,
    { query, variables },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 15_000,
    }
  )

  if (response.data?.errors?.length) {
    throw new Error(response.data.errors.map((e) => e.message).join('; '))
  }

  if (!response.data?.data) {
    throw new Error('AniList: resposta inválida (sem data)')
  }

  return response.data.data
}

export class AniListService {
  async search_anime_by_title(input: { title: string; perPage?: number }): Promise<anilist_anime[]> {
    const query = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            description
            siteUrl
            genres
            averageScore
            episodes
            status
            seasonYear
            format
          }
        }
      }
    `

    const per_page = Math.min(25, Math.max(1, input.perPage ?? 10))

    const data = await anilist_graphql<{ Page: { media: anilist_anime[] } }>(query, {
      search: input.title,
      page: 1,
      perPage: per_page,
    })

    return data.Page.media
  }

  async trending_anime(input: { perPage?: number }): Promise<anilist_anime[]> {
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: TRENDING_DESC) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            description
            siteUrl
            genres
            averageScore
            episodes
            status
            seasonYear
            format
          }
        }
      }
    `

    const per_page = Math.min(25, Math.max(1, input.perPage ?? 10))

    const data = await anilist_graphql<{ Page: { media: anilist_anime[] } }>(query, {
      page: 1,
      perPage: per_page,
    })

    return data.Page.media
  }

  async recommend_anime_by_genre(input: { genre: string; perPage?: number }): Promise<anilist_anime[]> {
    const query = `
      query ($page: Int, $perPage: Int, $genres: [String]) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, genre_in: $genres, sort: SCORE_DESC) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            description
            siteUrl
            genres
            averageScore
            episodes
            status
            seasonYear
            format
          }
        }
      }
    `

    const per_page = Math.min(25, Math.max(1, input.perPage ?? 10))
    const genre = input.genre.trim()

    const data = await anilist_graphql<{ Page: { media: anilist_anime[] } }>(query, {
      page: 1,
      perPage: per_page,
      genres: [genre],
    })

    return data.Page.media
  }

  async search_character_by_name(input: { name: string }): Promise<anilist_character[]> {
    const query = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          characters(search: $search, sort: FAVOURITES_DESC) {
            id
            name { full native }
            image { large }
            gender
            favourites
          }
        }
      }
    `

    const data = await anilist_graphql<{ Page: { characters: anilist_character[] } }>(query, {
      search: input.name,
      page: 1,
      perPage: 25,
    })

    return data.Page.characters
  }

  async roll_character(input: {
    desiredGender: 'female' | 'male' | 'any'
    maxAttempts?: number
  }): Promise<anilist_character> {
    const max_attempts = input.maxAttempts ?? 8

    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          characters(sort: FAVOURITES_DESC) {
            id
            name { full native }
            image { large }
            gender
            favourites
          }
        }
      }
    `

    for (let attempt = 0; attempt < max_attempts; attempt += 1) {
      const page = random_int(1, 200)
      const data = await anilist_graphql<{ Page: { characters: anilist_character[] } }>(query, {
        page,
        perPage: 50,
      })

      const candidates = data.Page.characters
        .filter((c) => !!c?.id && !!c?.name?.full && !!c?.image?.large)
        .filter((c) => {
          if (input.desiredGender === 'any') return true

          const g = (c.gender ?? '').toLowerCase()
          if (input.desiredGender === 'female') return g === 'female'
          if (input.desiredGender === 'male') return g === 'male'
          return true
        })

      if (candidates.length === 0) continue

      return candidates[random_int(0, candidates.length - 1)]
    }

    throw new Error('Falha ao rolar personagem (AniList): tente novamente.')
  }
}

export const aniListService = new AniListService()
