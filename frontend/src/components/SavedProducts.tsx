import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/endpoints'
import { useT } from '@/i18n'
import { useFavoritesStore } from '@/store/favorites'
import { ProductRail } from './ProductCard'

/** Cards for ids kept in the browser; hidden and unpublished products simply drop out. */
export function useSavedCards(ids: number[]) {
  return useQuery({
    queryKey: ['cards', ids],
    queryFn: () => catalogApi.cards(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  })
}

export function RecentlyViewed({ excludeId }: { excludeId?: number }) {
  const { t } = useT()
  const viewed = useFavoritesStore((s) => s.viewed)
  const { data } = useSavedCards(viewed)
  const products = (data ?? []).filter((p) => p.id !== excludeId && viewed.includes(p.id))
  if (!products.length) return null
  return (
    <section className="section">
      <div className="section-head">
        <h2>{t.recentlyViewed}</h2>
      </div>
      <ProductRail products={products} />
    </section>
  )
}
