import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Quote } from '@/api/types'
import { useT } from '@/i18n'
import { money } from '@/lib/format'
import { useScrollLock } from '@/lib/hooks'
import { useQuote } from '@/lib/useQuote'
import { useCartStore } from '@/store/cart'
import { BagIcon, CloseIcon } from './Icons'
import { EmptyState, QuantityStepper, Spinner } from './ui'

export function QuoteWarnings({ quote }: { quote: Quote }) {
  if (!quote.warnings.length) return null
  return (
    <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
      {quote.warnings.map((w) => (
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
  const { data: quote, isFetching, isError } = useQuote('PICKUP', open)

  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (quote?.warnings.length) replaceFromQuote(quote)
  }, [quote, replaceFromQuote])

  if (!open) return null
  const empty = lines.length === 0

  return (
    <>
      <div className="overlay" onClick={close} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t.cart}>
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
            <div className="notice error">Не удалось пересчитать корзину. Попробуйте ещё раз.</div>
          ) : !quote ? (
            <div className="center-box">
              <Spinner />
            </div>
          ) : (
            <>
              {quote.tier === 'PARTNER' && <div className="notice success" style={{ marginBottom: 12 }}>★ {t.partnerPricesApplied}</div>}
              <QuoteWarnings quote={quote} />
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
                      {item.volume ? ` · ${item.volume}` : ''} · {money(item.unitPrice)} / шт.
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
            </>
          )}
        </div>
        {!empty && quote && (
          <div className="drawer-foot">
            <DeliveryProgress quote={quote} />
            <QuoteSummary quote={quote} showDelivery={false} />
            <p className="muted small" style={{ marginTop: 8 }}>
              Способ получения и доставку выберете при оформлении
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
