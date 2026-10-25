import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_FAVORITES = 60
const MAX_VIEWED = 12

interface FavoritesState {
  /** Product ids, most recently added first. */
  favorites: number[]
  /** Recently opened product ids, newest first. */
  viewed: number[]
  toggle: (productId: number) => boolean
  addViewed: (productId: number) => void
}

/** Kept in the browser only, so it works without an account. */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      viewed: [],
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
    }),
    { name: 'gl-favorites', partialize: (s) => ({ favorites: s.favorites, viewed: s.viewed }) },
  ),
)

export const useIsFavorite = (productId: number) => useFavoritesStore((s) => s.favorites.includes(productId))
