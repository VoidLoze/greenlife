import { create } from 'zustand'
import { refreshSession, sessionHint, tokenStore } from '@/api/client'
import { authApi } from '@/api/endpoints'
import type { AuthResponse, User } from '@/api/types'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  status: Status
  user: User | null
  init: () => Promise<void>
  apply: (auth: AuthResponse) => void
  setUser: (user: User) => void
  login: (email: string, password: string) => Promise<User>
  register: (body: { email: string; password: string; fullName: string; phone?: string }) => Promise<User>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  init: async () => {
    if (!sessionHint.exists()) {
      set({ status: 'anonymous', user: null })
      return
    }
    const auth = await refreshSession()
    if (!auth) set({ status: 'anonymous', user: null })
  },
  apply: (auth) => {
    tokenStore.set(auth.accessToken)
    set({ status: 'authenticated', user: auth.user })
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
      tokenStore.set(null)
      set({ status: 'anonymous', user: null })
    }
  },
}))

tokenStore.onChange((auth) => {
  if (auth) {
    useAuthStore.setState({ status: 'authenticated', user: auth.user })
  } else {
    useAuthStore.setState({ status: 'anonymous', user: null })
  }
})

export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'ADMIN')
