import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { errorMessage } from '@/api/client'
import type { Order, OrderStatus } from '@/api/types'
import { OrderDetails, paymentLabels } from '@/components/OrderView'
import { EmptyState, Field, PageLoader, Spinner } from '@/components/ui'
import { formatPhone, money, whatsappLink } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { toast } from '@/store/toast'
import { AdminHead, orderStatusLabel } from './shared'

const actionStyle: Record<OrderStatus, string> = {
  NEW: 'btn-ghost',
  CONFIRMED: 'btn-primary',
  SHIPPED: 'btn-gold',
  COMPLETED: 'btn-primary',
  CANCELLED: 'btn-danger',
}

const actionLabel: Record<OrderStatus, string> = {
  NEW: 'Вернуть в новые',
  CONFIRMED: 'Подтвердить',
  SHIPPED: 'Отправлен',
  COMPLETED: 'Выполнен',
  CANCELLED: 'Отменить',
}

export default function OrderPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const queryClient = useQueryClient()
  const { data: order, isLoading, isError, error } = useQuery({ queryKey: ['admin', 'order', orderId], queryFn: () => adminApi.order(orderId) })
  const [note, setNote] = useState('')
  const [statusNote, setStatusNote] = useState('')
  useDocumentTitle(order ? `Заказ ${order.number}` : 'Заказ')

  useEffect(() => {
    if (order) setNote(order.adminNote ?? '')
  }, [order?.adminNote])

  const apply = (o: Order) => {
    queryClient.setQueryData(['admin', 'order', orderId], o)
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }

  const changeStatus = useMutation({
    mutationFn: (status: OrderStatus) => adminApi.setOrderStatus(orderId, status, statusNote.trim() || undefined),
    onSuccess: (o) => {
      apply(o)
      setStatusNote('')
      toast.success(`Статус: ${o.statusLabel}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const saveNote = useMutation({
    mutationFn: () => adminApi.setOrderNote(orderId, note),
    onSuccess: (o) => {
      apply(o)
      toast.success('Заметка сохранена')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading) return <PageLoader />
  if (isError || !order) return <EmptyState icon="⚠" title="Заказ не найден" text={errorMessage(error)} action={<Link to="/admin/orders" className="btn btn-primary">К заказам</Link>} />

  const customerWa = whatsappLink(order.phone, `Здравствуйте, ${order.customerName}! Ваш заказ ${order.number} на сумму ${money(order.total)}.`)

  return (
    <>
      <AdminHead eyebrow="Заказ" title={order.number}>
        <Link to="/admin/orders" className="btn btn-ghost btn-sm">
          ← К заказам
        </Link>
      </AdminHead>

      <div className="order-admin-layout">
        <section className="panel panel-pad">
          <OrderDetails order={order} />
        </section>

        <aside className="stack" style={{ gap: 14 }}>
          <section className="panel editor-section">
            <h3>Статус</h3>
            <span className="muted small">Сейчас: {orderStatusLabel[order.status]}</span>
            {order.nextStatuses.length > 0 ? (
              <>
                <Field label="Комментарий к смене статуса (необязательно)">
                  <input className="input" value={statusNote} maxLength={500} onChange={(e) => setStatusNote(e.target.value)} placeholder="Например: трек-номер, причина отмены" />
                </Field>
                <div className="stack" style={{ gap: 8 }}>
                  {order.nextStatuses.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn ${actionStyle[s]}`}
                      disabled={changeStatus.isPending}
                      onClick={() => {
                        if (s === 'CANCELLED' && !window.confirm('Отменить заказ? Товары вернутся на склад.')) return
                        changeStatus.mutate(s)
                      }}
                    >
                      {changeStatus.isPending && changeStatus.variables === s ? <Spinner /> : actionLabel[s]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted small">Заказ закрыт — статус больше не меняется.</p>
            )}
          </section>

          <section className="panel editor-section">
            <h3>Клиент</h3>
            <dl className="kv">
              <dt>Имя</dt>
              <dd>{order.customerName}</dd>
              <dt>Телефон</dt>
              <dd>
                <a href={`tel:+${order.phone.replace(/\D/g, '')}`}>{formatPhone(order.phone)}</a>
              </dd>
              {order.email && (
                <>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${order.email}`}>{order.email}</a>
                  </dd>
                </>
              )}
              <dt>Оплата</dt>
              <dd>{paymentLabels[order.paymentMethod]}</dd>
              {order.comment && (
                <>
                  <dt>Комментарий</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{order.comment}</dd>
                </>
              )}
              <dt>Аккаунт</dt>
              <dd>{order.userId ? `#${order.userId}` : 'гость'}</dd>
            </dl>
            <a className="btn btn-whatsapp btn-sm" href={customerWa} target="_blank" rel="noreferrer">
              Написать клиенту в WhatsApp
            </a>
          </section>

          <section className="panel editor-section">
            <h3>Заметка менеджера</h3>
            <textarea className="textarea" rows={4} value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} placeholder="Видна только администраторам" />
            <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} disabled={saveNote.isPending || note === (order.adminNote ?? '')} onClick={() => saveNote.mutate()}>
              {saveNote.isPending ? <Spinner /> : 'Сохранить заметку'}
            </button>
          </section>
        </aside>
      </div>
    </>
  )
}
