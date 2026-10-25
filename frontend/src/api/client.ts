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

/**
 * Resolves to null only when the server says the session is over (401/403). A dropped connection or a server error
 * rejects instead and leaves the session alone — a flaky network must not sign the shopper out and empty the cart.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true, timeout: 20_000 })
      .then((res) => {
        tokenStore.set(res.data.accessToken)
        listeners.forEach((l) => l(res.data))
        return res.data
      })
      .catch((error: unknown) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        if (status !== 401 && status !== 403) throw error
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

/** Placing an order must never be silently repeated as a guest: that would change who pays and at which prices. */
const isCheckout = (config: InternalAxiosRequestConfig) => config.method === 'post' && config.url === '/orders'

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiProblem>) => {
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const url = config?.url ?? ''
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/refresh') || url.startsWith('/auth/register')
    const sentToken = Boolean(config?.headers?.Authorization)
    if (status === 401 && config && !config._retried && !isAuthCall && (accessToken || sentToken)) {
      config._retried = true
      let refreshed: AuthResponse | null
      try {
        refreshed = await refreshSession()
      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
      if (refreshed) {
        config.headers.Authorization = `Bearer ${refreshed.accessToken}`
        return api.request(config as AxiosRequestConfig)
      }
      if (!isCheckout(config)) {
        delete config.headers.Authorization
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
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return { status: 0, code: 'timeout', detail: 'Сервер не ответил вовремя. Проверьте интернет и повторите.' }
      }
      return { status: 0, code: 'network', detail: 'Нет связи с сервером. Проверьте интернет и повторите.' }
    }
    const status = error.response.status
    // nginx answers these itself, without the JSON body the backend would send.
    const detail =
      status === 413
        ? 'Файл слишком большой: фото и документы — до 25 МБ, видео — до 200 МБ'
        : status === 429
          ? 'Слишком много запросов. Подождите минуту и повторите.'
          : status === 502 || status === 503 || status === 504
            ? 'Сервер перезапускается или перегружен. Повторите через минуту.'
            : 'Ошибка сервера'
    return { status, code: 'http_' + status, detail }
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
