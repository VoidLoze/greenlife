import { memo, type MouseEvent } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import type { ProductCard as Card } from '@/api/types'
import { useT } from '@/i18n'
import { discountPercent, money } from '@/lib/format'
import { isPlainClick, useOpenQuickView } from '@/lib/quickView'
import { useIsPartner } from '@/lib/useQuote'
import { useCartStore } from '@/store/cart'
import { toast } from '@/store/toast'
import { QuantityStepper } from './ui'

export function StockLine({ inStock, lowStock }: { inStock: boolean; lowStock: boolean }) {
  const { t } = useT()
  if (!inStock) return <span className="stock-line out">{t.outOfStock}</span>
  if (lowStock) return <span className="stock-line low">{t.lowStock}</span>
  return <span className="stock-line in">{t.inStock}</span>
}

/** Retail price stays plain; the partner price gets the gold plate. */
export function PricePair({ product, size = 'card' }: { product: Card; size?: 'card' | 'lg' }) {
  const { t } = useT()
  const isPartner = useIsPartner()
  if (product.price == null) {
    return (
      <div className={clsx('price-pair', `price-pair-${size}`)}>
        <div className="price-retail">
          <span>{t.price}</span>
          <b>{t.priceOnRequest}</b>
        </div>
      </div>
    )
  }
  const partner = product.partnerPrice
  const saving = partner != null ? discountPercent(partner, product.price) : null
  return (
    <div className={clsx('price-pair', `price-pair-${size}`, isPartner && 'is-partner')}>
      <div className="price-retail">
        <span>{t.retailPrice}</span>
        <b>{money(product.price)}</b>
        {product.oldPrice && !isPartner && <s>{money(product.oldPrice)}</s>}
      </div>
      {partner != null && (
        <div className="price-partner">
          <span className="price-partner-label">✦ {isPartner ? t.yourPrice : t.partnerPrice}</span>
          <span className="price-partner-value">
            <strong>{money(partner)}</strong>
            {saving && <span className="price-partner-off">−{saving}%</span>}
          </span>
          {size === 'lg' && !isPartner && (
            <Link to="/partner" className="price-partner-link">
              {t.becomePartner} →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function ProductCardComponent({ product }: { product: Card }) {
  const { t, pick } = useT()
  const quantity = useCartStore((s) => s.lines.find((l) => l.productId === product.id)?.quantity ?? 0)
  const add = useCartStore((s) => s.add)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const name = pick(product.nameRu, product.nameKk)
  const discount = discountPercent(product.price, product.oldPrice)
  const href = `/product/${product.slug}`
  const canBuy = product.inStock && product.price != null
  const openQuickView = useOpenQuickView()

  const onLinkClick = (e: MouseEvent) => {
    if (!isPlainClick(e)) return
    e.preventDefault()
    openQuickView(product.slug)
  }
  const onCardClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label')) return
    if (window.getSelection()?.toString()) return
    openQuickView(product.slug)
  }

  return (
    <article className="product-card" onClick={onCardClick}>
      <Link to={href} className="product-visual" aria-label={name} onClick={onLinkClick}>
        {product.thumbUrl || product.imageUrl ? (
          <img src={product.thumbUrl ?? product.imageUrl ?? ''} alt={name} loading="lazy" decoding="async" />
        ) : (
          <span className="no-image">GL</span>
        )}
        <span className="product-flags">
          {discount && <span className="badge badge-gold">−{discount}%</span>}
          {product.badge && <span className="badge badge-dark">{product.badge}</span>}
          {product.featured && !product.badge && <span className="badge badge-dark">★ Greenleaf</span>}
        </span>
      </Link>
      <div className="product-body">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="product-brand">{product.brand?.name ?? pick(product.category?.nameRu, product.category?.nameKk)}</span>
          {product.volume && <span className="muted small">{product.volume}</span>}
        </div>
        <Link to={href} className="product-name" onClick={onLinkClick}>
          {name}
        </Link>
        {product.summaryRu && <p className="product-summary">{pick(product.summaryRu, product.summaryKk)}</p>}
        <StockLine inStock={product.inStock} lowStock={product.lowStock} />
      </div>
      <PricePair product={product} />
      <div className="product-actions">
        {quantity > 0 ? (
          <>
            <QuantityStepper value={quantity} onChange={(q) => setQuantity(product.id, q)} />
            <Link to={href} className="btn btn-ghost btn-sm">
              {t.details}
            </Link>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canBuy}
            onClick={() => {
              add(product.id)
              toast.success(`«${name}» — ${t.inCart.toLowerCase()}`)
            }}
          >
            {product.inStock ? t.addToCart : t.outOfStock}
          </button>
        )}
      </div>
    </article>
  )
}

export const ProductCard = memo(ProductCardComponent)

export function ProductGrid({ products, loading, skeletons = 8 }: { products?: Card[]; loading?: boolean; skeletons?: number }) {
  if (loading && !products?.length) {
    return (
      <div className="product-grid">
        {Array.from({ length: skeletons }, (_, i) => (
          <div key={i} className="skeleton product-card-skeleton" />
        ))}
      </div>
    )
  }
  return (
    <div className="product-grid">
      {products?.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}

export function ProductRail({ products }: { products: Card[] }) {
  return (
    <div className="product-rail">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
