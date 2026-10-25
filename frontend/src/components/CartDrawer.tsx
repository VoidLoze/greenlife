import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Quote, CartWarning } from '@/api/types'
import { useT } from '@/i18n'
import { money } from '@/lib/format'
import { useScrollLock } from '@/lib/hooks'
import { useQuote } from '@/lib/useQuote'
import { useCartStore } from '@/store/cart'
import { BagIcon, CloseIcon } from './Icons'
import { DeliveryNote } from './Promo'
import { EmptyState, QuantityStepper, Spinner, useFocusTrap } from './ui'

export function QuoteWarnings({ quote, warnings = quote.warnings }: { quote: Quote; warnings?: CartWarning[] }) {
  if (!warnings.length) return null
  return (
    <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
      {warnings.map((w) => (
        <div key={`${w.productId}-${w.code}`} className="notice error">
          {w.message}
        </div>
      ))}
    </div>
  )
}

export function DeliveryProgress({ quote }: { quote: Quote }) {
  const { t } = useT()
  if (!quote.freeDeliveryThreshold) return null
  const pct = Math.min(100, (quote.itemsTotal / quote.freeDeliveryThreshold) * 100)
  return (
    <div className="delivery-progress">
      <small>
        {quote.amountToFreeDelivery > 0
          ? `${t.toFreeDelivery}: ${money(quote.amountToFreeDelivery)}`
          : `✓ ${t.freeDeliveryReached}`}
      </small>
      <div className="bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function QuoteSummary({ quote, showDelivery = true }: { quote: Quote; showDelivery?: boolean }) {
  const { t } = useT()
  return (
    <div className="summary-rows">
      <div>
        <span className="muted">
          {t.subtotal} ({quote.itemsCount})
        </span>
        <span>{money(quote.retailTotal)}</span>
      </div>
      {quote.savings > 0 && (
        <div className="savings">
          <span>{t.savings}</span>
          <span>−{money(quote.savings)}</span>
        </div>
      )}
      {showDelivery && quote.deliveryMethod === 'DELIVERY' && (
        <div>
          <span className="muted">{t.delivery}</span>
          <span>{quote.deliveryFee > 0 ? money(quote.deliveryFee) : t.free}</span>
        </div>
      )}
      <div className="total">
        <span>{t.total}</span>
        <span>{money(quote.total)}</span>
      </div>
    </div>
  )
}

export function CartDrawer() {
  const { t, pick } = useT()
  const navigate = useNavigate()
  const open = useCartStore((s) => s.drawerOpen)
  const close = useCartStore((s) => s.closeDrawer)
  const lines = useCartStore((s) => s.lines)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const replaceFromQuote = useCartStore((s) => s.replaceFromQuote)
  const { data: quote, isFetching, isError, refetch } = useQuote('PICKUP', open)
  const drawer = useRef<HTMLElement>(null)
  // The cart is corrected right away, which makes the next quote clean: keep the explanation until the drawer closes.
  const [notices, setNotices] = useState<CartWarning[]>([])

  useScrollLock(open)
  useFocusTrap(drawer, open, close)

  useEffect(() => {
    if (!open) setNotices([])
  }, [open])

  useEffect(() => {
    if (!quote?.warnings.length) return
    setNotices((prev) => [...prev.filter((p) => !quote.warnings.some((w) => w.productId === p.productId && w.code === p.code)), ...quote.warnings])
    replaceFromQuote(quote)
  }, [quote, replaceFromQuote])

  if (!open) return null
  const empty = lines.length === 0

  return (
    <>
      <div className="overlay" onClick={close} />
      <aside ref={drawer} className="drawer" role="dialog" aria-modal="true" aria-label={t.cart} tabIndex={-1}>
        <div className="drawer-head">
          <div className="row">
            <h3>{t.cart}</h3>
            {isFetching && <Spinner />}
          </div>
          <button type="button" className="close-btn" onClick={close} aria-label="Закрыть">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="drawer-body">
          {empty ? (
            <EmptyState
              icon={<BagIcon size={30} />}
              title={t.emptyCart}
              text={t.emptyCartHint}
              action={
                <Link to="/catalog" className="btn btn-primary" onClick={close}>
                  {t.goToCatalog}
                </Link>
              }
            />
          ) : isError ? (
            <div className="notice error row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{t.cartQuoteFailed}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? <Spinner /> : t.retry}
              </button>
            </div>
          ) : !quote ? (
            <div className="center-box">
              <Spinner />
            </div>
          ) : (
            <>
              {quote.tier === 'PARTNER' && <div className="notice success" style={{ marginBottom: 12 }}>★ {t.partnerPricesApplied}</div>}
              <QuoteWarnings quote={quote} warnings={notices} />
              {quote.items.map((item) => (
                <div key={item.productId} className="cart-line">
                  <Link to={`/product/${item.slug}`} onClick={close}>
                    {item.thumbUrl ? <img src={item.thumbUrl} alt="" /> : <span className="thumb-ph" />}
                  </Link>
                  <div>
                    <Link to={`/product/${item.slug}`} onClick={close} className="cart-line-name">
                      {pick(item.nameRu, item.nameKk)}
                    </Link>
                    <div className="cart-line-meta">
                      {item.sku}
                      {item.volume ? ` · ${item.volume}` : ''} · {money(item.unitPrice)} / {t.pcs}
                    </div>
                    <div className="cart-line-bottom">
                      <QuantityStepper
                        value={item.quantity}
                        max={item.maxQuantity}
                        onChange={(q) => setQuantity(item.productId, q)}
                      />
                      <div className="cart-line-price">
                        <strong>{money(item.lineTotal)}</strong>
                        {item.lineSavings > 0 && <s>{money(item.lineTotal + item.lineSavings)}</s>}
                      </div>
                    </div>
                    <button type="button" className="btn-link small" style={{ marginTop: 6 }} onClick={() => remove(item.productId)}>
                      {t.remove}
                    </button>
                  </div>
                </div>
              ))}
              <DeliveryNote variant="compact" />
            </>
          )}
        </div>
        {!empty && quote && (
          <div className="drawer-foot">
            <DeliveryProgress quote={quote} />
            <QuoteSummary quote={quote} showDelivery={false} />
            <p className="muted small" style={{ marginTop: 8 }}>
              {t.chooseDeliveryLater}
            </p>
            <button
              type="button"
              className="btn btn-gold btn-block btn-lg"
              style={{ marginTop: 16 }}
              disabled={quote.items.length === 0}
              onClick={() => {
                close()
                navigate('/checkout')
              }}
            >
              {t.checkout}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
