import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cartApi } from '@/api/endpoints'
import type { CartLine, Quote } from '@/api/types'

const MAX_QTY = 99

interface CartState {
  lines: CartLine[]
  /** The account this cart was filled under (null = a guest's cart). */
  ownerId: number | null
  drawerOpen: boolean
  add: (productId: number, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  clear: () => void
  replaceFromQuote: (quote: Quote) => void
  claim: (userId: number | null) => void
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
      ownerId: null,
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
      /**
       * A cart left behind by an account whose session ended (expired while the tab was closed) belongs to that
       * account — it is still saved on the server — and must not become the next visitor's or merge into another
       * account. A guest's cart is kept and merged on login.
       */
      claim: (userId) => {
        const { ownerId } = get()
        if (ownerId === userId) return
        if (ownerId != null) set({ lines: [], ownerId: userId })
        else set({ ownerId: userId })
      },
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    { name: 'gl-cart', partialize: (s) => ({ lines: s.lines, ownerId: s.ownerId }) },
  ),
)

export const useCartCount = () => useCartStore((s) => s.lines.reduce((sum, l) => sum + l.quantity, 0))

export async function mergeServerCart(): Promise<void> {
  const { lines, replaceFromQuote } = useCartStore.getState()
  const quote = await cartApi.merge(lines)
  replaceFromQuote(quote)
}
