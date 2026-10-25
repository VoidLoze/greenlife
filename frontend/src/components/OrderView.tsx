import type { Order, OrderStatus } from '@/api/types'
import { useT } from '@/i18n'
import clsx from 'clsx'
import { dateTime, money } from '@/lib/format'

export const statusBadge: Record<OrderStatus, string> = {
  NEW: 'badge-amber',
  CONFIRMED: 'badge-green',
  SHIPPED: 'badge-gold',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
}

export const paymentLabels: Record<string, string> = {
  CASH: 'Наличными при получении',
  KASPI: 'Kaspi',
  CARD_TRANSFER: 'Перевод на карту',
}

/** Принят → Подтверждён → Передан в доставку → Выполнен; pickup orders skip the delivery step. */
function StatusSteps({ order }: { order: Order }) {
  const { t } = useT()
  const reached = new Set<OrderStatus>(['NEW', ...order.history.map((h) => h.status), order.status])
  const flow: OrderStatus[] =
    order.deliveryMethod === 'DELIVERY' || reached.has('SHIPPED') ? ['NEW', 'CONFIRMED', 'SHIPPED', 'COMPLETED'] : ['NEW', 'CONFIRMED', 'COMPLETED']
  const cancelled = order.status === 'CANCELLED'
  const steps = cancelled ? [...flow.filter((s) => s !== 'COMPLETED' && reached.has(s)), 'CANCELLED' as const] : flow
  const current = steps.indexOf(order.status)
  const when = (status: OrderStatus) =>
    status === 'NEW' ? order.createdAt : order.history.find((h) => h.status === status)?.createdAt

  return (
    <ol className={clsx('status-steps', cancelled && 'is-cancelled')}>
      {steps.map((status, i) => {
        const at = i <= current ? when(status) : undefined
        return (
          <li key={status} className={clsx(i < current && 'done', i === current && 'current', status === 'CANCELLED' && 'cancelled')}>
            <span className="step-dot" aria-hidden="true">
              {status === 'CANCELLED' ? '×' : i <= current ? '✓' : ''}
            </span>
            <span className="step-label">{status === 'NEW' ? t.orderReceived : t.orderStatus[status]}</span>
            {at && <small>{dateTime(at)}</small>}
          </li>
        )
      })}
    </ol>
  )
}

export function OrderDetails({ order }: { order: Order }) {
  const { t } = useT()
  const payment: Record<string, string> = { CASH: t.payCash, KASPI: t.payKaspi, CARD_TRANSFER: t.payCard }
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <span className="muted small">{dateTime(order.createdAt)}</span>
          <h3>№ {order.number}</h3>
        </div>
        <span className={`badge ${statusBadge[order.status]}`}>{t.orderStatus[order.status] ?? order.statusLabel}</span>
      </div>

      <StatusSteps order={order} />

      <div className="order-items">
        {order.items.map((item, i) => (
          <div key={`${item.sku}-${i}`} className="order-item">
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="thumb-ph" style={{ width: 52, height: 52 }} />}
            <div>
              <div className="name">{item.productName}</div>
              <div className="muted small">
                {item.sku} · {money(item.unitPrice)} × {item.quantity}
              </div>
            </div>
            <div className="sum">{money(item.lineTotal)}</div>
          </div>
        ))}
      </div>

      <div className="summary-rows">
        {order.savingsTotal > 0 && (
          <div className="savings">
            <span>{t.savings}</span>
            <span>−{money(order.savingsTotal)}</span>
          </div>
        )}
        <div>
          <span className="muted">{t.subtotal}</span>
          <span>{money(order.itemsTotal)}</span>
        </div>
        {order.deliveryMethod === 'DELIVERY' && (
          <div>
            <span className="muted">{t.delivery}</span>
            <span>{order.deliveryFee > 0 ? money(order.deliveryFee) : t.free}</span>
          </div>
        )}
        <div className="total">
          <span>{t.total}</span>
          <span>{money(order.total)}</span>
        </div>
      </div>

      <div className="summary-rows small">
        <div>
          <span className="muted">{t.receiving}</span>
          <span>{order.deliveryMethod === 'DELIVERY' ? [order.city, order.address].filter(Boolean).join(', ') || t.deliveryCourier : t.pickup}</span>
        </div>
        <div>
          <span className="muted">{t.payment}</span>
          <span>{payment[order.paymentMethod] ?? order.paymentMethod}</span>
        </div>
        {order.priceTier === 'PARTNER' && (
          <div>
            <span className="muted">{t.prices}</span>
            <span>{t.partnerPrices}</span>
          </div>
        )}
      </div>

      {order.history.length > 0 && (
        <div>
          <h4 className="eyebrow" style={{ marginBottom: 12 }}>
            {t.history}
          </h4>
          <ol className="timeline">
            {order.history.map((h, i) => (
              <li key={i}>
                <strong>{t.orderStatus[h.status] ?? h.label}</strong>
                <small>{dateTime(h.createdAt)}</small>
                {h.note && <div className="muted small">{h.note}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
