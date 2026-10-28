import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/endpoints'
import { useT } from '@/i18n'
import { flyToCart } from '@/lib/flyToCart'
import { isPlainClick, useOpenQuickView } from '@/lib/quickView'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'
import { toast } from '@/store/toast'
import { GiftIcon } from './Icons'
import { PricePair } from './ProductCard'

/** «Сделай подарок»: the discount-card call plus one product — from the shopper's purchases, or a random gift idea. */
export function GiftPick() {
  const { t, pick } = useT()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const { data, isLoading } = useQuery({
    queryKey: ['gift-pick', userId],
    queryFn: catalogApi.giftPick,
    staleTime: 5 * 60_000,
  })
  const add = useCartStore((s) => s.add)
  const openQuickView = useOpenQuickView()
  const product = data?.product

  const open = (e: MouseEvent) => {
    if (!product || !isPlainClick(e)) return
    e.preventDefault()
    openQuickView(product.slug)
  }

  return (
    <section className="gift-pick">
      <div className="gift-pick-call">
        <span className="gift-pick-icon">
          <GiftIcon size={24} />
        </span>
        <h2>{t.giftTitle}</h2>
        <Link to="/partner" className="btn btn-gold">
          {t.giftCardCta} →
        </Link>
      </div>

      {isLoading ? (
        <div className="gift-pick-product skeleton" />
      ) : (
        product && (
          <div className="gift-pick-product">
            <Link to={`/product/${product.slug}`} className="gift-pick-visual" onClick={open} aria-label={pick(product.nameRu, product.nameKk)}>
              {product.thumbUrl || product.imageUrl ? <img src={product.thumbUrl ?? product.imageUrl ?? ''} alt="" loading="lazy" decoding="async" /> : null}
            </Link>
            <div className="gift-pick-info">
              <span className="eyebrow">{data.personal ? t.giftPersonal : t.giftIdea}</span>
              <Link to={`/product/${product.slug}`} className="gift-pick-name" onClick={open}>
                {pick(product.nameRu, product.nameKk)}
              </Link>
              <PricePair product={product} />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(e) => {
                  add(product.id)
                  flyToCart(e.currentTarget)
                  toast.success(`«${pick(product.nameRu, product.nameKk)}» — ${t.inCart.toLowerCase()}`)
                }}
              >
                {t.addToCart}
              </button>
            </div>
          </div>
        )
      )}
    </section>
  )
}
