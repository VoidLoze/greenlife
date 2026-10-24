import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { ApiProblem, AuthResponse } from './types'

/**
 * The access token lives only in memory (never in localStorage), the refresh token is an httpOnly cookie
 * scoped to /api/auth. On a 401 the client refreshes once (shared by all parallel requests) and retries.
 */
let accessToken: string | null = null
let refreshInFlight: Promise<AuthResponse | null> | null = null
const listeners = new Set<(auth: AuthResponse | null) => void>()

/** Not a credential: only tells the app whether a refresh attempt on startup can succeed at all. */
const SESSION_HINT_KEY = 'gl-has-session'

export const sessionHint = {
  exists: () => localStorage.getItem(SESSION_HINT_KEY) === '1',
  set: (present: boolean) => {
    if (present) localStorage.setItem(SESSION_HINT_KEY, '1')
    else localStorage.removeItem(SESSION_HINT_KEY)
  },
}

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token
    sessionHint.set(token !== null)
  },
  onChange: (listener: (auth: AuthResponse | null) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30_000,
})

api.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true })
      .then((res) => {
        tokenStore.set(res.data.accessToken)
        listeners.forEach((l) => l(res.data))
        return res.data
      })
      .catch(() => {
        tokenStore.set(null)
        listeners.forEach((l) => l(null))
        return null
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiProblem>) => {
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const url = config?.url ?? ''
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/refresh') || url.startsWith('/auth/register')
    if (status === 401 && config && !config._retried && !isAuthCall && accessToken) {
      config._retried = true
      const refreshed = await refreshSession()
      if (refreshed) {
        config.headers.Authorization = `Bearer ${refreshed.accessToken}`
        return api.request(config as AxiosRequestConfig)
      }
    }
    return Promise.reject(error)
  },
)

export function problemOf(error: unknown): ApiProblem {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiProblem> | undefined
    if (data && typeof data === 'object' && 'code' in data) {
      return {
        status: error.response?.status ?? 0,
        code: data.code ?? 'error',
        detail: data.detail ?? 'Ошибка запроса',
        errors: data.errors,
        details: data.details,
      }
    }
    if (!error.response) {
      return { status: 0, code: 'network', detail: 'Нет связи с сервером. Проверьте интернет и повторите.' }
    }
    return { status: error.response.status, code: 'http_' + error.response.status, detail: 'Ошибка сервера' }
  }
  return { status: 0, code: 'unknown', detail: 'Что-то пошло не так' }
}

export function errorMessage(error: unknown): string {
  const problem = problemOf(error)
  if (problem.details?.length) {
    return `${problem.detail}: ${problem.details.join('; ')}`
  }
  return problem.detail
}
