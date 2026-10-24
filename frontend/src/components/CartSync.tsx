import { useEffect, useRef } from 'react'
import { cartApi } from '@/api/endpoints'
import { useAuthStore } from '@/store/auth'
import { mergeServerCart, useCartStore } from '@/store/cart'

/**
 * Mirrors the browser cart to the server for signed-in shoppers: on login the guest cart is merged into the saved
 * one, afterwards every change is pushed (debounced) so the cart follows the user across devices.
 */
export function CartSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const synced = useRef<number | null>(null)

  useEffect(() => {
    if (userId == null) {
      synced.current = null
      return
    }
    if (synced.current === userId) return
    let cancelled = false
    mergeServerCart()
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
    const unsubscribe = useCartStore.subscribe((state, previous) => {
      if (state.lines === previous.lines || synced.current !== userId) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        cartApi.replace(useCartStore.getState().lines).catch(() => undefined)
      }, 600)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [userId])

  return null
}
