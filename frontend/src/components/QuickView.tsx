import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/endpoints'
import type { ProductDetail } from '@/api/types'
import { useT } from '@/i18n'
import { useScrollLock } from '@/lib/hooks'
import { QUICK_VIEW_PARAM, type QuickViewState } from '@/lib/quickView'
import { BuyBox } from './BuyBox'
import { CloseIcon } from './Icons'
import { MediaCarousel, productSlides } from './MediaCarousel'
import { PageLoader } from './ui'

/** Product window opened from catalog cards (`?product=slug`). Mounted once in the store layout. */
export function ProductQuickView() {
  const [params] = useSearchParams()
  const slug = params.get(QUICK_VIEW_PARAM)
  const navigate = useNavigate()
  const location = useLocation()
  const openedInApp = (location.state as QuickViewState | null)?.quickView === true

  const close = useCallback(() => {
    if (openedInApp) {
      navigate(-1)
      return
    }
    const next = new URLSearchParams(location.search)
    next.delete(QUICK_VIEW_PARAM)
    const search = next.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true, preventScrollReset: true })
  }, [openedInApp, navigate, location.pathname, location.search])

  if (!slug) return null
  return <QuickViewDialog key={slug} slug={slug} onClose={close} />
}

function QuickViewDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { t } = useT()
  const dialog = useRef<HTMLDivElement>(null)
  const product = useQuery({ queryKey: ['product', slug], queryFn: () => catalogApi.product(slug) })
  const viewed = useRef(false)
  useScrollLock(true)

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (product.data && !viewed.current) {
      viewed.current = true
      void catalogApi.view(slug)
    }
  }, [product.data, slug])

  return (
    <>
      <div className="overlay quickview-overlay" onClick={onClose} />
      <div className="quickview" role="dialog" aria-modal="true" aria-label={product.data?.card.nameRu ?? t.details} tabIndex={-1} ref={dialog}>
        <button type="button" className="close-btn quickview-close" onClick={onClose} aria-label="Закрыть">
          <CloseIcon size={18} />
        </button>
        {product.isLoading ? (
          <PageLoader />
        ) : product.data ? (
          <QuickViewBody product={product.data} onClose={onClose} />
        ) : (
          <div className="center-box stack" style={{ textAlign: 'center' }}>
            <h3>Не удалось открыть товар</h3>
            <p className="muted">Возможно, он снят с продажи или ссылка устарела.</p>
          </div>
        )}
      </div>
    </>
  )
}

function QuickViewBody({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const { t, pick } = useT()
  const card = product.card
  const name = pick(card.nameRu, card.nameKk)
  const slides = useMemo(() => productSlides(product), [product])
  const summary = pick(card.summaryRu, card.summaryKk)

  return (
    <div className="quickview-grid">
      <MediaCarousel slides={slides} alt={name} keyboard />
      <div className="quickview-info">
        <div className="row wrap">
          {card.brand && <span className="product-brand">{card.brand.name}</span>}
          {card.category && <span className="muted small">{pick(card.category.nameRu, card.category.nameKk)}</span>}
          {card.badge && <span className="badge badge-gold">{card.badge}</span>}
        </div>
        <h2>{name}</h2>
        <div className="product-meta">
          <span>
            {t.sku}: <b>{card.sku}</b>
          </span>
          {card.volume && (
            <span>
              {t.volume}: <b>{card.volume}</b>
            </span>
          )}
        </div>
        {summary && <p className="quickview-summary">{summary}</p>}
        <BuyBox product={product} onCheckout={onClose} />
        {product.benefits.length > 0 && (
          <ul className="benefit-list">
            {product.benefits.slice(0, 4).map((b, i) => (
              <li key={i}>{pick(b.textRu, b.textKk)}</li>
            ))}
          </ul>
        )}
        <Link to={`/product/${card.slug}`} className="btn btn-ghost">
          {t.fullProductCard} →
        </Link>
      </div>
    </div>
  )
}
