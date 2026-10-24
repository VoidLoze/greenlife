import type { Order, OrderStatus } from '@/api/types'
import { useT } from '@/i18n'
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

export function OrderDetails({ order }: { order: Order }) {
  const { t } = useT()
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <span className="muted small">{dateTime(order.createdAt)}</span>
          <h3>№ {order.number}</h3>
        </div>
        <span className={`badge ${statusBadge[order.status]}`}>{order.statusLabel}</span>
      </div>

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
          <span className="muted">Получение</span>
          <span>{order.deliveryMethod === 'DELIVERY' ? [order.city, order.address].filter(Boolean).join(', ') || t.deliveryCourier : t.pickup}</span>
        </div>
        <div>
          <span className="muted">{t.payment}</span>
          <span>{paymentLabels[order.paymentMethod] ?? order.paymentMethod}</span>
        </div>
        {order.priceTier === 'PARTNER' && (
          <div>
            <span className="muted">Цены</span>
            <span>Партнёрские</span>
          </div>
        )}
      </div>

      {order.history.length > 0 && (
        <div>
          <h4 className="eyebrow" style={{ marginBottom: 12 }}>
            История
          </h4>
          <ol className="timeline">
            {order.history.map((h, i) => (
              <li key={i}>
                <strong>{h.label}</strong>
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
