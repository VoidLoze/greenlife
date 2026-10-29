import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sessionHint } from '@/api/client'
import type { SavedLists } from '@/api/endpoints'

const MAX_FAVORITES = 60
const MAX_VIEWED = 12

interface FavoritesState {
  /** Product ids, most recently added first. */
  favorites: number[]
  /** Recently opened product ids, newest first. */
  viewed: number[]
  /** The account these lists were filled under (null = a guest's). */
  ownerId: number | null
  toggle: (productId: number) => boolean
  addViewed: (productId: number) => void
  replace: (lists: SavedLists) => void
  clear: () => void
  claim: (userId: number | null) => void
}

/**
 * A guest's lists stay in the browser; a signed-in shopper's are mirrored to the server (see FavoritesSync), leave
 * the browser on sign-out and come back on the next sign-in.
 */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      viewed: [],
      ownerId: null,
      toggle: (productId) => {
        const current = get().favorites
        const adding = !current.includes(productId)
        set({
          favorites: adding
            ? [productId, ...current].slice(0, MAX_FAVORITES)
            : current.filter((id) => id !== productId),
        })
        return adding
      },
      addViewed: (productId) => {
        const current = get().viewed
        if (current[0] === productId) return
        set({ viewed: [productId, ...current.filter((id) => id !== productId)].slice(0, MAX_VIEWED) })
      },
      replace: ({ favorites, viewed }) => {
        const same = (a: number[], b: number[]) => a.length === b.length && a.every((id, idx) => id === b[idx])
        const state = get()
        if (same(favorites, state.favorites) && same(viewed, state.viewed)) return
        set({ favorites: favorites.slice(0, MAX_FAVORITES), viewed: viewed.slice(0, MAX_VIEWED) })
      },
      clear: () => set({ favorites: [], viewed: [] }),
      /** Same rule as the cart: lists left behind by an ended session belong to that account, a guest's are kept. */
      claim: (userId) => {
        const { ownerId } = get()
        if (ownerId === userId) return
        if (ownerId != null) set({ favorites: [], viewed: [], ownerId: userId })
        else set({ ownerId: userId })
      },
    }),
    {
      name: 'gl-favorites',
      version: 1,
      partialize: (s) => ({ favorites: s.favorites, viewed: s.viewed, ownerId: s.ownerId }),
      /**
       * Version 0 did not record the owner, so lists left after a sign-out could be anyone's. With a session in this
       * browser they go to that account on sign-in; without one they are dropped.
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<Pick<FavoritesState, 'favorites' | 'viewed'>>
        if (version === 0 && !sessionHint.exists()) return { favorites: [], viewed: [], ownerId: null }
        return { favorites: state.favorites ?? [], viewed: state.viewed ?? [], ownerId: null }
      },
    },
  ),
)

export const useIsFavorite = (productId: number) => useFavoritesStore((s) => s.favorites.includes(productId))
