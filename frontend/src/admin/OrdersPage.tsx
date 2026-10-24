import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { errorMessage } from '@/api/client'
import type { OrderStatus } from '@/api/types'
import { statusBadge } from '@/components/OrderView'
import { EmptyState, Pagination, Spinner } from '@/components/ui'
import { dateTime, money } from '@/lib/format'
import { useDebounced, useDocumentTitle } from '@/lib/hooks'
import { AdminHead, orderStatusLabel } from './shared'

const STATUSES: OrderStatus[] = ['NEW', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED']

export default function OrdersPage() {
  useDocumentTitle('Заказы')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const debouncedQ = useDebounced(q, 300)

  const filter = {
    q: params.get('q') ?? '',
    status: (params.get('status') as OrderStatus) ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    page: Math.max(0, Number(params.get('page') ?? 1) - 1),
  }

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) setParam('q', debouncedQ || undefined)
  }, [debouncedQ])

  const list = useQuery({
    queryKey: ['admin', 'orders', filter],
    queryFn: () => adminApi.orders(filter),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const data = list.data

  return (
    <>
      <AdminHead eyebrow="Продажи" title={`Заказы${data ? ` · ${data.totalItems}` : ''}`}>
        {list.isFetching && <Spinner />}
      </AdminHead>

      <div className="filter-bar">
        <input className="input grow" placeholder="Номер, имя, телефон или email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" type="date" value={filter.from} onChange={(e) => setParam('from', e.target.value)} aria-label="С даты" />
        <input className="input" type="date" value={filter.to} onChange={(e) => setParam('to', e.target.value)} aria-label="По дату" />
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${!filter.status ? 'active' : ''}`} onClick={() => setParam('status')}>
          Все
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`chip ${filter.status === s ? 'active' : ''}`} onClick={() => setParam('status', s)}>
            {orderStatusLabel[s]}
          </button>
        ))}
      </div>

      {list.isError ? (
        <div className="notice error">{errorMessage(list.error)}</div>
      ) : data && data.items.length === 0 ? (
        <div className="panel">
          <EmptyState icon="📦" title="Заказов не найдено" />
        </div>
      ) : (
        <div className="table-wrap" style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Получение</th>
                <th>Статус</th>
                <th className="num">Позиций</th>
                <th className="num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                  <td>
                    <strong>{o.number}</strong>
                    {o.priceTier === 'PARTNER' && <span className="badge badge-gold" style={{ marginLeft: 6 }}>★</span>}
                  </td>
                  <td className="muted nowrap">{dateTime(o.createdAt)}</td>
                  <td>
                    {o.customerName}
                    <span className="muted small" style={{ display: 'block' }}>{o.phone}</span>
                  </td>
                  <td className="muted">{o.deliveryMethod === 'DELIVERY' ? 'Доставка' : 'Самовывоз'}</td>
                  <td>
                    <span className={`badge ${statusBadge[o.status]}`}>{o.statusLabel}</span>
                  </td>
                  <td className="num">{o.itemsCount}</td>
                  <td className="num">
                    <strong>{money(o.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={filter.page + 1} totalPages={data.totalPages} onChange={(p) => setParam('page', p > 1 ? String(p) : undefined)} />}
    </>
  )
}
