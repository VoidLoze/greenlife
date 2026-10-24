import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cartApi } from '@/api/endpoints'
import type { CartLine, Quote } from '@/api/types'

const MAX_QTY = 99

interface CartState {
  lines: CartLine[]
  drawerOpen: boolean
  add: (productId: number, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  clear: () => void
  replaceFromQuote: (quote: Quote) => void
  openDrawer: () => void
  closeDrawer: () => void
}

/**
 * The browser cart is the working copy for everyone; signed-in shoppers additionally mirror it to Redis on the
 * server (see useCartSync), so it follows them to other devices.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      drawerOpen: false,
      add: (productId, quantity = 1) => {
        const lines = [...get().lines]
        const existing = lines.find((l) => l.productId === productId)
        if (existing) {
          existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity)
        } else {
          lines.push({ productId, quantity: Math.min(MAX_QTY, quantity) })
        }
        set({ lines: lines.map((l) => ({ ...l })) })
      },
      setQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().remove(productId)
          return
        }
        set({
          lines: get().lines.map((l) =>
            l.productId === productId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l,
          ),
        })
      },
      remove: (productId) => set({ lines: get().lines.filter((l) => l.productId !== productId) }),
      clear: () => set({ lines: [] }),
      replaceFromQuote: (quote) => {
        const next = quote.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
        const same =
          next.length === get().lines.length &&
          next.every((l, idx) => l.productId === get().lines[idx]?.productId && l.quantity === get().lines[idx]?.quantity)
        if (!same) set({ lines: next })
      },
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    { name: 'gl-cart', partialize: (s) => ({ lines: s.lines }) },
  ),
)

export const useCartCount = () => useCartStore((s) => s.lines.reduce((sum, l) => sum + l.quantity, 0))

export async function mergeServerCart(): Promise<void> {
  const { lines, replaceFromQuote } = useCartStore.getState()
  const quote = await cartApi.merge(lines)
  replaceFromQuote(quote)
}
