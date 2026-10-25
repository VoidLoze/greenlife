import { create } from 'zustand'
import { refreshSession, sessionHint, tokenStore } from '@/api/client'
import { authApi } from '@/api/endpoints'
import type { AuthResponse, User } from '@/api/types'
import { onAccountChange } from '@/lib/session'
import { useCartStore } from './cart'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  status: Status
  user: User | null
  init: () => Promise<void>
  apply: (auth: AuthResponse) => void
  setUser: (user: User) => void
  login: (email: string, password: string) => Promise<User>
  register: (body: { email: string; password: string; fullName: string; phone?: string; consent: boolean }) => Promise<User>
  logout: () => Promise<void>
  /** Forget the session in this browser without calling the server (used after "log out everywhere"). */
  signOutLocally: () => void
}

/** `known` is false when the server could not be reached: whoever owns the saved cart may still be signed in. */
function setSession(status: Status, user: User | null, known = true) {
  const previous = useAuthStore.getState().user?.id ?? null
  useAuthStore.setState({ status, user })
  onAccountChange(previous, user?.id ?? null)
  if (known) useCartStore.getState().claim(user?.id ?? null)
}

const RETRY_DELAYS = [3_000, 10_000, 30_000]

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  init: async () => {
    if (!sessionHint.exists()) {
      setSession('anonymous', null)
      return
    }
    for (let attempt = 0; ; attempt++) {
      try {
        const auth = await refreshSession()
        if (!auth) setSession('anonymous', null)
        return
      } catch {
        // Offline or the server restarts: browse as a guest meanwhile, keep the saved cart, try again shortly.
        if (get().status === 'loading') setSession('anonymous', null, false)
        if (attempt >= RETRY_DELAYS.length || get().user) return
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]))
        if (get().user || !sessionHint.exists()) return
      }
    }
  },
  apply: (auth) => {
    tokenStore.set(auth.accessToken)
    setSession('authenticated', auth.user)
  },
  setUser: (user) => set({ user }),
  login: async (email, password) => {
    const auth = await authApi.login(email, password)
    get().apply(auth)
    return auth.user
  },
  register: async (body) => {
    const auth = await authApi.register(body)
    get().apply(auth)
    return auth.user
  },
  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      get().signOutLocally()
    }
  },
  signOutLocally: () => {
    tokenStore.set(null)
    setSession('anonymous', null)
  },
}))

tokenStore.onChange((auth) => {
  if (auth) setSession('authenticated', auth.user)
  else setSession('anonymous', null)
})

export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'ADMIN')
