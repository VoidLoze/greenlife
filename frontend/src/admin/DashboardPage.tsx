import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { adminApi, type Dashboard, type ProductStat } from '@/api/admin'
import { statusBadge } from '@/components/OrderView'
import { PageLoader } from '@/components/ui'
import { dateTime, money, shortDate } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { AdminHead } from './shared'

function delta(current: number, previous: number) {
  if (!previous) return current > 0 ? { text: 'новые', up: true } : null
  const pct = Math.round(((current - previous) / previous) * 100)
  return { text: `${pct >= 0 ? '+' : ''}${pct}% к прошлым 30 дням`, up: pct >= 0 }
}

function RevenueChart({ daily }: { daily: Dashboard['daily'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 760
  const height = 220
  const pad = { top: 16, bottom: 26, left: 8, right: 8 }
  const max = Math.max(1, ...daily.map((d) => Number(d.revenue)))
  const bw = (width - pad.left - pad.right) / Math.max(1, daily.length)
  const point = hover != null ? daily[hover] : null

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6, minHeight: 22 }}>
        <span className="muted small">Выручка по дням</span>
        {point && (
          <span className="small">
            <strong>{shortDate(point.date)}</strong> · {money(point.revenue)} · {point.orders} зак.
          </span>
        )}
      </div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="bar-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e7d5af" />
            <stop offset="100%" stopColor="#0d6d4e" />
          </linearGradient>
        </defs>
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} />
        {daily.map((d, i) => {
          const h = ((height - pad.top - pad.bottom) * Number(d.revenue)) / max
          const x = pad.left + i * bw
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={pad.top} width={bw} height={height - pad.top - pad.bottom} fill="transparent" />
              <rect className="bar" x={x + bw * 0.15} y={height - pad.bottom - h} width={bw * 0.7} height={Math.max(h, d.orders ? 2 : 0)} rx={3} opacity={hover == null || hover === i ? 1 : 0.5} />
              {i % 5 === 0 && (
                <text x={x + bw / 2} y={height - 8} textAnchor="middle">
                  {shortDate(d.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Rank({ title, items, format, empty }: { title: string; items: ProductStat[]; format: (p: ProductStat) => string; empty: string }) {
  return (
    <section className="panel panel-pad">
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {items.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul className="rank-list">
          {items.map((p) => (
            <li key={p.id}>
              <Link to={`/admin/products/${p.id}`}>
                {p.thumbUrl ? <img src={p.thumbUrl} alt="" /> : <span className="thumb-ph" />}
                <span className="name">{p.nameRu}</span>
                <span className="value">{format(p)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function DashboardPage() {
  useDocumentTitle('Админка')
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard, refetchInterval: 60_000 })
  const revenueDelta = useMemo(() => (data ? delta(Number(data.last30Days.revenue), Number(data.last30Days.previousRevenue)) : null), [data])
  const ordersDelta = useMemo(() => (data ? delta(data.last30Days.orders, data.last30Days.previousOrders) : null), [data])

  if (isLoading || !data) return <PageLoader />
  const c = data.counters

  return (
    <>
      <AdminHead eyebrow="Обзор" title="Дашборд">
        <Link to="/admin/products/new" className="btn btn-gold">
          + Новый товар
        </Link>
      </AdminHead>

      <div className="stat-grid">
        <div className="panel stat-card">
          <small>Выручка, 30 дней</small>
          <strong>{money(data.last30Days.revenue)}</strong>
          {revenueDelta && <span className={`delta ${revenueDelta.up ? 'up' : 'down'}`}>{revenueDelta.text}</span>}
        </div>
        <div className="panel stat-card">
          <small>Заказы, 30 дней</small>
          <strong>{data.last30Days.orders}</strong>
          {ordersDelta && <span className={`delta ${ordersDelta.up ? 'up' : 'down'}`}>{ordersDelta.text}</span>}
        </div>
        <div className="panel stat-card">
          <small>Средний чек</small>
          <strong>{money(data.last30Days.averageCheck)}</strong>
        </div>
        <Link to="/admin/orders?status=NEW" className="panel stat-card">
          <small>Новые заказы</small>
          <strong style={{ color: c.ordersNew ? 'var(--gold-soft)' : undefined }}>{c.ordersNew}</strong>
          <span className="muted small">в работе: {c.ordersInProgress}</span>
        </Link>
        <Link to="/admin/products?status=PUBLISHED" className="panel stat-card">
          <small>Товары на витрине</small>
          <strong>{c.productsPublished}</strong>
          <span className="muted small">
            черновики: {c.productsDraft} · архив: {c.productsArchived}
          </span>
        </Link>
        <Link to="/admin/products?noPhoto=true" className="panel stat-card">
          <small>Без фото</small>
          <strong style={{ color: c.productsWithoutPhoto ? 'var(--warning)' : undefined }}>{c.productsWithoutPhoto}</strong>
        </Link>
        <Link to="/admin/users" className="panel stat-card">
          <small>Покупатели</small>
          <strong>{c.users}</strong>
          <span className="muted small">партнёров: {c.partners}</span>
        </Link>
      </div>

      <div className="dash-grid">
        <section className="panel panel-pad wide">
          <RevenueChart daily={data.daily} />
        </section>

        <section className="panel panel-pad">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h3>Последние заказы</h3>
            <Link to="/admin/orders" className="btn-link small">
              Все →
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="muted small">Заказов пока нет</p>
          ) : (
            <ul className="rank-list">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`}>
                    <span className="name">
                      {o.number} · {o.customerName}
                      <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                        {dateTime(o.createdAt)}
                      </span>
                    </span>
                    <span className={`badge ${statusBadge[o.status]}`}>{o.statusLabel}</span>
                    <span className="value">{money(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Rank title="Заканчиваются" items={data.lowStock} format={(p) => `${p.stockQuantity ?? 0} шт.`} empty="Остатки в порядке" />
        <Rank title="Хиты продаж" items={data.topSold} format={(p) => `${p.value} шт.`} empty="Продаж пока нет" />
        <Rank title="Самые просматриваемые" items={data.topViewed} format={(p) => `${p.value} 👁`} empty="Просмотров пока нет" />

        <section className="panel panel-pad wide">
          <h3 style={{ marginBottom: 12 }}>Что ищут покупатели</h3>
          {data.popularSearches.length === 0 ? (
            <p className="muted small">Пока нет поисковых запросов</p>
          ) : (
            <div className="row wrap">
              {data.popularSearches.map((q) => (
                <Link key={q} to={`/catalog?q=${encodeURIComponent(q)}`} className="chip" target="_blank">
                  {q}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
