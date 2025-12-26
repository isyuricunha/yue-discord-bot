import { create } from 'zustand'
import axios from 'axios'
import { getApiUrl } from '../env'

const API_URL = getApiUrl()
const STORAGE_KEY = 'yuebot-token'

const is_dev = import.meta.env.DEV
const allow_token_storage = import.meta.env.DEV

axios.defaults.withCredentials = true

interface User {
  userId: string
  username: string
  discriminator: string
  avatar: string | null
  guilds: string[]
  isOwner: boolean
}

interface AuthStore {
  token: string | null
  user: User | null
  isLoading: boolean
  isRefreshing: boolean
  setToken: (token: string | null) => void
  loadUser: () => Promise<void>
  refreshToken: () => Promise<boolean>
  logout: () => void
  initialize: () => void
}

// Configurar interceptor axios para refresh automático
let isRefreshingToken = false
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshingToken) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          if (token) {
            originalRequest.headers['Authorization'] = 'Bearer ' + token
          }
          return axios(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshingToken = true

      const store = useAuthStore.getState()
      const success = await store.refreshToken()

      if (success) {
        const newToken = useAuthStore.getState().token
        processQueue(null, newToken)

        if (newToken) {
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken
        }

        return axios(originalRequest)
      } else {
        processQueue(error, null)
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isRefreshing: false,

  initialize: () => {
    if (allow_token_storage) {
      const savedToken = localStorage.getItem(STORAGE_KEY)
      if (savedToken) {
        if (is_dev) console.log('[AuthStore] Token encontrado no localStorage')
        set({ token: savedToken })
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
      }
    }

    // Sempre tentar carregar usuário (cookie-based session pode existir)
    get().loadUser()
  },

  setToken: (token) => {
    set({ token })
    
    if (token) {
      if (allow_token_storage) localStorage.setItem(STORAGE_KEY, token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      void get().loadUser()
    } else {
      if (allow_token_storage) localStorage.removeItem(STORAGE_KEY)
      delete axios.defaults.headers.common['Authorization']
    }
  },

  loadUser: async () => {
    set({ isLoading: true })
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`)
      set({ user: response.data, isLoading: false })
    } catch (error) {
      if (is_dev) console.error('[AuthStore] Erro ao carregar usuário:', error)
      set({ token: null, user: null, isLoading: false })
      if (allow_token_storage) localStorage.removeItem(STORAGE_KEY)
      delete axios.defaults.headers.common['Authorization']
    }
  },

  refreshToken: async () => {
    const { token } = get()
    set({ isRefreshing: true })
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/refresh`,
        {},
        token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : undefined
      )
      
      const newToken = response.data.token

      // Se o backend estiver em cookie-mode, ainda pode retornar token por compatibilidade.
      // Só persistimos localmente se ele veio de uma sessão token-based.
      if (token && newToken) {
        get().setToken(newToken)
      } else {
        await get().loadUser()
      }

      set({ isRefreshing: false })
      isRefreshingToken = false
      return true
    } catch (error) {
      if (is_dev) console.error('[AuthStore] Erro ao renovar token:', error)
      set({ isRefreshing: false })
      get().logout()
      isRefreshingToken = false
      return false
    }
  },

  logout: () => {
    void axios.post(`${API_URL}/api/auth/logout`).catch(() => undefined)
    set({ token: null, user: null })
    if (allow_token_storage) localStorage.removeItem(STORAGE_KEY)
    delete axios.defaults.headers.common['Authorization']
  },
}))
