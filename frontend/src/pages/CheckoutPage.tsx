import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { problemOf } from '@/api/client'
import { ordersApi } from '@/api/endpoints'
import type { DeliveryMethod, PaymentMethod } from '@/api/types'
import { DeliveryProgress, QuoteSummary, QuoteWarnings } from '@/components/CartDrawer'
import { BagIcon } from '@/components/Icons'
import { EmptyState, Field, PageLoader, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { formatPhone, isValidPhone, money } from '@/lib/format'
import { useDocumentTitle, useSettings } from '@/lib/hooks'
import { useQuote } from '@/lib/useQuote'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'

const CONTACT_KEY = 'gl-checkout-contact'

interface Form {
  customerName: string
  phone: string
  email: string
  city: string
  address: string
  comment: string
  deliveryMethod: DeliveryMethod
  paymentMethod: PaymentMethod
  website: string
}

function initialForm(user: ReturnType<typeof useAuthStore.getState>['user'], defaultCity?: string): Form {
  let saved: Partial<Form> = {}
  try {
    saved = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? '{}')
  } catch {
    saved = {}
  }
  return {
    customerName: saved.customerName || user?.fullName || '',
    phone: saved.phone || (user?.phone ? formatPhone(user.phone) : ''),
    email: saved.email || user?.email || '',
    city: saved.city || defaultCity || '',
    address: saved.address || '',
    comment: '',
    deliveryMethod: saved.deliveryMethod ?? 'PICKUP',
    paymentMethod: saved.paymentMethod ?? 'KASPI',
    website: '',
  }
}

export default function CheckoutPage() {
  const { t, pick } = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const authStatus = useAuthStore((s) => s.status)
  const { data: settings } = useSettings()
  const lines = useCartStore((s) => s.lines)
  const clearCart = useCartStore((s) => s.clear)
  const replaceFromQuote = useCartStore((s) => s.replaceFromQuote)
  const [form, setForm] = useState<Form>(() => initialForm(user, settings?.city))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const quote = useQuote(form.deliveryMethod)
  useDocumentTitle(t.checkout)

  useEffect(() => {
    if (!user) return
    setForm((f) => ({
      ...f,
      customerName: f.customerName || user.fullName,
      email: f.email || user.email,
      phone: f.phone || (user.phone ? formatPhone(user.phone) : ''),
    }))
  }, [user])

  useEffect(() => {
    if (settings?.city) setForm((f) => (f.city ? f : { ...f, city: settings.city }))
  }, [settings?.city])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.customerName.trim().length < 2) e.customerName = 'Укажите имя'
    if (!isValidPhone(form.phone)) e.phone = 'Введите номер полностью: +7 7XX XXX XX XX'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Некорректный email'
    if (form.deliveryMethod === 'DELIVERY' && form.address.trim().length < 5) e.address = 'Укажите адрес доставки'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const checkout = useMutation({
    mutationFn: () =>
      ordersApi.checkout({
        customerName: form.customerName.trim(),
        phone: form.phone,
        email: form.email.trim() || undefined,
        city: form.city.trim() || undefined,
        address: form.deliveryMethod === 'DELIVERY' ? form.address.trim() : undefined,
        comment: form.comment.trim() || undefined,
        deliveryMethod: form.deliveryMethod,
        paymentMethod: form.paymentMethod,
        items: lines,
        expectedTotal: quote.data?.total,
        website: form.website || undefined,
      }),
    onSuccess: (res) => {
      const { comment: _comment, website: _website, ...contact } = form
      localStorage.setItem(CONTACT_KEY, JSON.stringify(contact))
      sessionStorage.setItem(`gl-order-${res.order.number}`, JSON.stringify(res))
      clearCart()
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: ['product'] })
      navigate(`/order/${res.order.number}`, { replace: true, state: res })
    },
    onError: async (error) => {
      const problem = problemOf(error)
      if (problem.code === 'cart_changed' || problem.code === 'price_changed' || problem.code === 'out_of_stock') {
        const fresh = await quote.refetch()
        if (fresh.data) replaceFromQuote(fresh.data)
        setBanner(
          problem.code === 'price_changed'
            ? 'Цены обновились, пока вы оформляли заказ. Проверьте новую сумму и подтвердите ещё раз.'
            : `${problem.detail}${problem.details?.length ? ': ' + problem.details.join('; ') : ''}. Корзина обновлена — проверьте и подтвердите ещё раз.`,
        )
      } else if (problem.errors) {
        setErrors(problem.errors)
        setBanner(problem.detail)
      } else {
        setBanner(problem.detail)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  if (lines.length === 0 && !checkout.isPending) {
    return (
      <div className="panel">
        <EmptyState
          icon={<BagIcon size={30} />}
          title={t.emptyCart}
          text={t.emptyCartHint}
          action={
            <Link to="/catalog" className="btn btn-primary">
              {t.goToCatalog}
            </Link>
          }
        />
      </div>
    )
  }

  if (!quote.data) return quote.isError ? <div className="notice error">Не удалось рассчитать заказ. Обновите страницу.</div> : <PageLoader />
  const q = quote.data

  return (
    <>
      <div className="catalog-head">
        <div>
          <span className="eyebrow">Greenleaf</span>
          <h1>{t.checkout}</h1>
        </div>
        {authStatus === 'anonymous' && (
          <p className="muted small">
            <Link to="/login?next=/checkout" className="btn-link">
              {t.login}
            </Link>{' '}
            — заказы сохранятся в кабинете, партнёры увидят свои цены.
          </p>
        )}
      </div>

      {banner && (
        <div className="notice error" style={{ marginBottom: 16 }}>
          {banner}
        </div>
      )}

      <form
        className="checkout-layout"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setBanner(null)
          if (quote.isPlaceholderData || checkout.isPending) return
          if (validate()) checkout.mutate()
        }}
      >
        <div className="stack" style={{ gap: 18 }}>
          <section className="panel form-section">
            <h3>Контакты</h3>
            <div className="form-grid">
              <Field label={t.name} error={errors.customerName}>
                <input className={clsx('input', errors.customerName && 'invalid')} value={form.customerName} onChange={(e) => set('customerName', e.target.value)} autoComplete="name" maxLength={150} />
              </Field>
              <Field label={t.phone} error={errors.phone}>
                <input
                  className={clsx('input', errors.phone && 'invalid')}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value ? formatPhone(e.target.value) : '')}
                  placeholder="+7 7__ ___ __ __"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <Field label={`${t.email} (необязательно)`} error={errors.email} className="full">
                <input className={clsx('input', errors.email && 'invalid')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
              </Field>
            </div>
            <input type="text" name="website" value={form.website} onChange={(e) => set('website', e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -9999, opacity: 0 }} aria-hidden="true" />
          </section>

          <section className="panel form-section">
            <h3>Получение</h3>
            <div className="choice-grid">
              {(
                [
                  ['PICKUP', t.pickup, settings ? [settings.city, settings.address].filter(Boolean).join(', ') : ''],
                  [
                    'DELIVERY',
                    t.deliveryCourier,
                    settings?.freeDeliveryThreshold
                      ? `${money(settings.deliveryFee)}, бесплатно от ${money(settings.freeDeliveryThreshold)}`
                      : '',
                  ],
                ] as [DeliveryMethod, string, string][]
              ).map(([value, label, hint]) => (
                <label key={value} className={clsx('choice', form.deliveryMethod === value && 'active')}>
                  <input type="radio" name="delivery" checked={form.deliveryMethod === value} onChange={() => set('deliveryMethod', value)} />
                  <strong>{label}</strong>
                  {hint && <small>{hint}</small>}
                </label>
              ))}
            </div>
            {form.deliveryMethod === 'DELIVERY' && (
              <div className="form-grid">
                <Field label={t.city} error={errors.city}>
                  <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" />
                </Field>
                <Field label={t.address} error={errors.address}>
                  <input className={clsx('input', errors.address && 'invalid')} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Улица, дом, квартира" autoComplete="street-address" />
                </Field>
              </div>
            )}
          </section>

          <section className="panel form-section">
            <h3>{t.payment}</h3>
            <div className="choice-grid">
              {(
                [
                  ['KASPI', t.payKaspi, 'Счёт или перевод Kaspi'],
                  ['CARD_TRANSFER', t.payCard, 'Реквизиты пришлём в WhatsApp'],
                  ['CASH', t.payCash, ''],
                ] as [PaymentMethod, string, string][]
              ).map(([value, label, hint]) => (
                <label key={value} className={clsx('choice', form.paymentMethod === value && 'active')}>
                  <input type="radio" name="payment" checked={form.paymentMethod === value} onChange={() => set('paymentMethod', value)} />
                  <strong>{label}</strong>
                  {hint && <small>{hint}</small>}
                </label>
              ))}
            </div>
            <Field label={t.comment}>
              <textarea className="textarea" value={form.comment} onChange={(e) => set('comment', e.target.value)} maxLength={1000} placeholder="Удобное время звонка, пожелания…" />
            </Field>
          </section>
        </div>

        <aside className="panel panel-pad checkout-summary">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h3>Ваш заказ</h3>
            {quote.isFetching && <Spinner />}
          </div>
          {q.tier === 'PARTNER' && <div className="notice success" style={{ marginBottom: 12 }}>★ {t.partnerPricesApplied}</div>}
          <QuoteWarnings quote={q} />
          <div className="mini-lines">
            {q.items.map((i) => (
              <div key={i.productId} className="mini-line">
                {i.thumbUrl ? <img src={i.thumbUrl} alt="" /> : <span className="thumb-ph" style={{ width: 44, height: 44 }} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  {pick(i.nameRu, i.nameKk)} <span className="qty">× {i.quantity}</span>
                </span>
                <strong>{money(i.lineTotal)}</strong>
              </div>
            ))}
          </div>
          {form.deliveryMethod === 'DELIVERY' && <DeliveryProgress quote={q} />}
          <QuoteSummary quote={q} />
          <button type="submit" className="btn btn-gold btn-block btn-lg" style={{ marginTop: 18 }} disabled={checkout.isPending || quote.isPlaceholderData || q.items.length === 0}>
            {checkout.isPending ? <Spinner /> : quote.isPlaceholderData ? 'Пересчитываем…' : `${t.placeOrder} · ${money(q.total)}`}
          </button>
          <p className="muted small" style={{ marginTop: 10, textAlign: 'center' }}>
            Оплата после подтверждения заказа менеджером
          </p>
        </aside>
      </form>
    </>
  )
}
