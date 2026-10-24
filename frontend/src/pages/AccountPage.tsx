import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { errorMessage } from '@/api/client'
import { authApi, ordersApi } from '@/api/endpoints'
import { OrderDetails, statusBadge } from '@/components/OrderView'
import { EmptyState, Field, Modal, Pagination, PageLoader, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { dateTime, formatPhone, isValidPhone, money } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { passwordProblem } from '@/lib/validation'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/store/toast'
import { tokenStore } from '@/api/client'

type Tab = 'orders' | 'profile' | 'security'

function OrdersTab() {
  const { t } = useT()
  const [page, setPage] = useState(1)
  const [openNumber, setOpenNumber] = useState<string | null>(null)
  const orders = useQuery({ queryKey: ['my-orders', page], queryFn: () => ordersApi.mine(page - 1) })
  const detail = useQuery({
    queryKey: ['my-order', openNumber],
    queryFn: () => ordersApi.myOrder(openNumber!),
    enabled: !!openNumber,
  })
  const whatsapp = useMutation({
    mutationFn: (number: string) => ordersApi.whatsapp(number),
    onSuccess: (res) => window.open(res.url, '_blank', 'noopener'),
  })

  if (orders.isLoading) return <PageLoader />
  if (!orders.data?.items.length) {
    return (
      <EmptyState
        icon="📦"
        title="Заказов пока нет"
        text="Здесь появится история ваших покупок."
        action={
          <Link to="/catalog" className="btn btn-primary">
            {t.goToCatalog}
          </Link>
        }
      />
    )
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {orders.data.items.map((o) => (
        <button key={o.id} type="button" className="order-row" onClick={() => setOpenNumber(o.number)}>
          <span>
            <strong>№ {o.number}</strong>
            <span className="muted small" style={{ display: 'block' }}>
              {dateTime(o.createdAt)}
            </span>
          </span>
          <span className="muted small">{o.itemsCount} шт. · {o.deliveryMethod === 'DELIVERY' ? t.deliveryCourier : t.pickup}</span>
          <strong>{money(o.total)}</strong>
          <span className={`badge ${statusBadge[o.status]}`}>{o.statusLabel}</span>
        </button>
      ))}
      <Pagination page={page} totalPages={orders.data.totalPages} onChange={setPage} />
      <Modal open={!!openNumber} title={`Заказ ${openNumber ?? ''}`} onClose={() => setOpenNumber(null)}>
        {detail.data ? (
          <div className="stack" style={{ gap: 18 }}>
            <OrderDetails order={detail.data} />
            {detail.data.status !== 'CANCELLED' && detail.data.status !== 'COMPLETED' && (
              <button type="button" className="btn btn-whatsapp" onClick={() => whatsapp.mutate(detail.data.number)} disabled={whatsapp.isPending}>
                {t.sendToWhatsapp}
              </button>
            )}
          </div>
        ) : (
          <PageLoader />
        )}
      </Modal>
    </div>
  )
}

function ProfileTab() {
  const { t } = useT()
  const user = useAuthStore((s) => s.user)!
  const setUser = useAuthStore((s) => s.setUser)
  const [fullName, setFullName] = useState(user.fullName)
  const [phone, setPhone] = useState(user.phone ? formatPhone(user.phone) : '')
  const save = useMutation({
    mutationFn: () => authApi.updateProfile({ fullName: fullName.trim(), phone: phone || undefined }),
    onSuccess: (u) => {
      setUser(u)
      toast.success('Профиль сохранён')
    },
  })
  const phoneInvalid = !!phone && !isValidPhone(phone)

  return (
    <form
      className="stack"
      style={{ gap: 16, maxWidth: 520 }}
      onSubmit={(e) => {
        e.preventDefault()
        if (!phoneInvalid && fullName.trim().length >= 2) save.mutate()
      }}
    >
      <Field label={t.email} hint="Email используется для входа и не меняется">
        <input className="input" value={user.email} disabled />
      </Field>
      <Field label={t.fullName}>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label={t.phone} error={phoneInvalid ? 'Введите номер полностью' : undefined}>
        <input className={clsx('input', phoneInvalid && 'invalid')} value={phone} onChange={(e) => setPhone(e.target.value ? formatPhone(e.target.value) : '')} inputMode="tel" />
      </Field>
      {save.isError && <div className="notice error">{errorMessage(save.error)}</div>}
      <button type="submit" className="btn btn-primary" disabled={save.isPending} style={{ alignSelf: 'flex-start' }}>
        {save.isPending ? <Spinner /> : t.save}
      </button>
    </form>
  )
}

function SecurityTab() {
  const navigate = useNavigate()
  const apply = useAuthStore((s) => s.apply)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const problem = next ? passwordProblem(next) : null
  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: (auth) => {
      apply(auth)
      setCurrent('')
      setNext('')
      toast.success('Пароль изменён. Остальные сеансы завершены.')
    },
  })
  const logoutAll = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      tokenStore.set(null)
      useAuthStore.setState({ status: 'anonymous', user: null })
      toast.info('Вы вышли на всех устройствах')
      navigate('/login')
    },
  })

  return (
    <div className="stack" style={{ gap: 28, maxWidth: 520 }}>
      <form
        className="stack"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (current && next && !problem) change.mutate()
        }}
      >
        <h3>Смена пароля</h3>
        <Field label="Текущий пароль">
          <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="Новый пароль" error={problem ?? undefined}>
          <input className={clsx('input', problem && 'invalid')} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        {change.isError && <div className="notice error">{errorMessage(change.error)}</div>}
        <button type="submit" className="btn btn-primary" disabled={change.isPending || !current || !next || !!problem} style={{ alignSelf: 'flex-start' }}>
          {change.isPending ? <Spinner /> : 'Изменить пароль'}
        </button>
      </form>
      <div className="stack" style={{ gap: 10 }}>
        <h3>Сеансы</h3>
        <p className="muted">Если вы входили с чужого устройства — завершите все сеансы.</p>
        <button type="button" className="btn btn-danger" onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending} style={{ alignSelf: 'flex-start' }}>
          Выйти на всех устройствах
        </button>
      </div>
    </div>
  )
}

export default function AccountPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const tab = (params.get('tab') as Tab) || 'orders'
  useDocumentTitle(t.account)

  if (!user) return <PageLoader />

  const tabs: [Tab, string][] = [
    ['orders', t.myOrders],
    ['profile', t.profile],
    ['security', 'Безопасность'],
  ]

  return (
    <>
      <div className="catalog-head">
        <div>
          <span className="eyebrow">{t.account}</span>
          <h1>{user.fullName}</h1>
          <div className="row wrap" style={{ marginTop: 10 }}>
            {user.partner && <span className="badge badge-gold">★ Партнёр</span>}
            {user.role === 'ADMIN' && <span className="badge badge-green">Администратор</span>}
            <span className="muted small">{user.email}</span>
          </div>
        </div>
        {!user.partner && (
          <Link to="/partner" className="btn btn-gold">
            {t.becomePartner}
          </Link>
        )}
      </div>
      <div className="account-layout">
        <nav className="panel account-nav">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" className={clsx(tab === id && 'active')} onClick={() => setParams({ tab: id })}>
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              await logout()
              navigate('/')
            }}
          >
            {t.logout}
          </button>
        </nav>
        <section className="panel panel-pad">
          {tab === 'orders' && <OrdersTab />}
          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}
        </section>
      </div>
    </>
  )
}
