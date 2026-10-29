import { useEffect, useRef } from 'react'
import { favoritesApi } from '@/api/endpoints'
import { useAuthStore } from '@/store/auth'
import { useFavoritesStore } from '@/store/favorites'

const lists = () => {
  const { favorites, viewed } = useFavoritesStore.getState()
  return { favorites, viewed }
}

/**
 * Mirrors favourites and recently viewed to the server for signed-in shoppers, like CartSync does for the cart: on
 * login the guest's lists are merged into the saved ones, afterwards every change is pushed (debounced).
 */
export function FavoritesSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const synced = useRef<number | null>(null)

  useEffect(() => {
    if (userId == null) {
      synced.current = null
      return
    }
    if (synced.current === userId) return
    let cancelled = false
    favoritesApi
      .merge(lists())
      .then((saved) => {
        if (!cancelled && useAuthStore.getState().user?.id === userId) useFavoritesStore.getState().replace(saved)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) synced.current = userId
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (userId == null) return
    let timer: number | undefined
    // The lists are emptied right at sign-out, before this effect is torn down — that must not reach the server.
    const stillSignedIn = () => useAuthStore.getState().user?.id === userId
    const unsubscribe = useFavoritesStore.subscribe((state, previous) => {
      if (state.favorites === previous.favorites && state.viewed === previous.viewed) return
      if (synced.current !== userId || !stillSignedIn()) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (stillSignedIn()) favoritesApi.replace(lists()).catch(() => undefined)
      }, 600)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [userId])

  return null
}
