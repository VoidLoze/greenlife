import { useState } from 'react'
import type { ProductDetail } from '@/api/types'
import { useT } from '@/i18n'
import { flyToCart } from '@/lib/flyToCart'
import { money, whatsappLink } from '@/lib/format'
import { useSettings } from '@/lib/hooks'
import { useIsPartner } from '@/lib/useQuote'
import { useCartCount, useCartStore } from '@/store/cart'
import { toast } from '@/store/toast'
import { BagIcon, WhatsappIcon } from './Icons'
import { FavoriteButton, ShareButton } from './ProductActions'
import { PricePair, StockLine } from './ProductCard'
import { QuantityStepper } from './ui'

/** Phone-only bar pinned to the bottom of the product page, so buying never needs a scroll back up. */
export function MobileBuyBar({ product }: { product: ProductDetail }) {
  const { t, pick } = useT()
  const card = product.card
  const { data: settings } = useSettings()
  const count = useCartCount()
  const isPartner = useIsPartner()
  const inCart = useCartStore((s) => s.lines.find((l) => l.productId === card.id)?.quantity ?? 0)
  const add = useCartStore((s) => s.add)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const openDrawer = useCartStore((s) => s.openDrawer)
  const max = Math.min(settings?.maxQuantityPerItem ?? 99, product.stockQuantity ?? 99)
  const canBuy = card.inStock && card.price != null

  return (
    <div className="m-buy-bar">
      <button type="button" className="m-buy-cart" onClick={openDrawer} aria-label={count ? `${t.cart}: ${count}` : t.cart}>
        <BagIcon size={22} />
        {count > 0 && <span className="cart-count">{count}</span>}
      </button>
      {inCart > 0 ? (
        <>
          <QuantityStepper value={inCart} max={max} onChange={(q) => setQuantity(card.id, q)} />
          <button type="button" className="btn btn-gold m-buy-main" onClick={openDrawer}>
            {t.checkout}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-primary m-buy-main"
          disabled={!canBuy}
          onClick={(e) => {
            add(card.id, 1)
            flyToCart(e.currentTarget)
            toast.success(`«${pick(card.nameRu, card.nameKk)}» — ${t.inCart.toLowerCase()}`)
          }}
        >
          {card.inStock ? t.addToCart : t.outOfStock}
          {canBuy && <span className="m-buy-price">{money(isPartner && card.partnerPrice != null ? card.partnerPrice : card.price)}</span>}
        </button>
      )}
    </div>
  )
}

export function BuyBox({ product, onCheckout }: { product: ProductDetail; onCheckout?: () => void }) {
  const { t, pick } = useT()
  const card = product.card
  const { data: settings } = useSettings()
  const inCart = useCartStore((s) => s.lines.find((l) => l.productId === card.id)?.quantity ?? 0)
  const add = useCartStore((s) => s.add)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const openDrawer = useCartStore((s) => s.openDrawer)
  const [qty, setQty] = useState(1)
  const max = Math.min(settings?.maxQuantityPerItem ?? 99, product.stockQuantity ?? 99)
  const canBuy = card.inStock && card.price != null
  const name = pick(card.nameRu, card.nameKk)

  const productUrl = `${window.location.origin}/product/${card.slug}`
  const whatsapp = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, `Здравствуйте! Интересует товар «${card.nameRu}» (${card.sku}). ${productUrl}`)
    : null

  return (
    <div className="panel buy-box">
      <PricePair product={card} size="lg" />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <StockLine inStock={card.inStock} lowStock={card.lowStock} />
        {card.lowStock && product.stockQuantity != null && <span className="muted small">≤ {product.stockQuantity} {t.pcs}</span>}
      </div>

      {inCart > 0 ? (
        <div className="buy-row">
          <QuantityStepper large value={inCart} max={max} onChange={(q) => setQuantity(card.id, q)} />
          <button
            type="button"
            className="btn btn-gold btn-lg"
            style={{ flex: 1 }}
            onClick={() => {
              onCheckout?.()
              openDrawer()
            }}
          >
            {t.inCart} · {t.checkout}
          </button>
        </div>
      ) : (
        <div className="buy-row">
          <QuantityStepper large value={qty} max={max} onChange={(q) => setQty(Math.max(1, q))} />
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!canBuy}
            onClick={(e) => {
              add(card.id, qty)
              flyToCart(e.currentTarget)
              toast.success(`«${name}» — ${t.inCart.toLowerCase()}`)
            }}
          >
            {card.inStock ? t.addToCart : t.outOfStock}
          </button>
        </div>
      )}

      {whatsapp && (
        <a className="btn btn-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">
          <WhatsappIcon size={18} /> {t.askWhatsapp}
        </a>
      )}

      <div className="buy-extra">
        <FavoriteButton productId={card.id} variant="full" />
        <ShareButton title={name} url={productUrl} />
      </div>
    </div>
  )
}
