import { Link } from 'react-router'
import { ProductGrid } from '@/components/ProductCard'
import { RecentlyViewed, useSavedCards } from '@/components/SavedProducts'
import { EmptyState } from '@/components/ui'
import { useT } from '@/i18n'
import { useDocumentTitle, useNoIndex } from '@/lib/hooks'
import { useFavoritesStore } from '@/store/favorites'

export default function FavoritesPage() {
  const { t } = useT()
  const favorites = useFavoritesStore((s) => s.favorites)
  const { data, isLoading } = useSavedCards(favorites)
  const products = (data ?? []).filter((p) => favorites.includes(p.id))
  useDocumentTitle(t.favorites)
  useNoIndex(true)

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <span className="eyebrow">Greenleaf</span>
        <h1>{t.favorites}</h1>
      </div>
      {favorites.length === 0 || (!isLoading && products.length === 0) ? (
        <EmptyState
          icon="♡"
          title={t.favoritesEmpty}
          text={t.favoritesEmptyHint}
          action={
            <Link to="/catalog" className="btn btn-primary">
              {t.goToCatalog}
            </Link>
          }
        />
      ) : (
        <ProductGrid products={products} loading={isLoading} skeletons={Math.min(favorites.length, 8)} />
      )}
      <RecentlyViewed />
    </>
  )
}
