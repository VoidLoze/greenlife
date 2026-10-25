import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { problemOf } from '@/api/client'
import { ordersApi } from '@/api/endpoints'
import type { DeliveryMethod, PaymentMethod } from '@/api/types'
import { DeliveryProgress, QuoteSummary, QuoteWarnings } from '@/components/CartDrawer'
import { BagIcon } from '@/components/Icons'
import { DeliveryNote } from '@/components/Promo'
import { EmptyState, Field, PageLoader, PhoneInput, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { formatPhone, isValidPhone, money } from '@/lib/format'
import { useDocumentTitle, useSettings } from '@/lib/hooks'
import { loadGuestContact, saveGuestContact, saveOrderReceipt } from '@/lib/session'
import { useQuote } from '@/lib/useQuote'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'

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
  consent: boolean
}

function newIdempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function initialForm(user: ReturnType<typeof useAuthStore.getState>['user'], defaultCity?: string): Form {
  const saved = user ? {} : loadGuestContact()
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
    consent: false,
  }
}

/** On a phone the invalid field is usually off-screen: bring it into view and put the cursor there. */
function focusFirstError() {
  window.setTimeout(() => {
    const field = document.querySelector<HTMLElement>('.checkout-layout .invalid input, .checkout-layout input.invalid, .checkout-layout .invalid')
    if (!field) return
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field.focus({ preventScroll: true })
  }, 0)
}

export default function CheckoutPage() {
  const authStatus = useAuthStore((s) => s.status)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  if (authStatus === 'loading') return <PageLoader />
  // Remount per account so one person's details never carry over to the next after a sign-out.
  return <CheckoutForm key={userId ?? 'guest'} />
}

function CheckoutForm() {
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

  // Signed-in shoppers get the details of their previous order from the server — nothing is kept in the browser.
  const touched = useRef(false)
  const lastOrder = useQuery({
    queryKey: ['my-order', 'last-contact', user?.id],
    queryFn: async () => {
      const number = (await ordersApi.mine(0)).items[0]?.number
      return number ? ordersApi.myOrder(number) : null
    },
    enabled: !!user,
    staleTime: 0,
  })
  useEffect(() => {
    const o = lastOrder.data
    if (!o || touched.current) return
    setForm((f) => ({
      ...f,
      customerName: o.customerName || f.customerName,
      phone: o.phone ? formatPhone(o.phone) : f.phone,
      email: o.email || f.email,
      city: o.city || f.city,
      address: o.address || f.address,
      deliveryMethod: o.deliveryMethod,
      paymentMethod: o.paymentMethod,
    }))
  }, [lastOrder.data])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    touched.current = true
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
    if (form.customerName.trim().length < 2) e.customerName = t.errName
    if (!isValidPhone(form.phone)) e.phone = t.errPhoneFull
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = t.errEmail
    if (form.deliveryMethod === 'DELIVERY' && form.city.trim().length < 2) e.city = t.errCity
    if (form.deliveryMethod === 'DELIVERY' && form.address.trim().length < 5) e.address = t.errAddress
    if (!form.consent) e.consent = t.errConsent
    setErrors(e)
    if (Object.keys(e).length > 0) focusFirstError()
    return Object.keys(e).length === 0
  }

  // One key per distinct order: a retry after a timeout returns the order already placed instead of a second one.
  const orderSignature = JSON.stringify([lines, form.deliveryMethod, quote.data?.total])
  const idempotency = useRef({ signature: '', key: '' })
  if (idempotency.current.signature !== orderSignature) {
    idempotency.current = { signature: orderSignature, key: newIdempotencyKey() }
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
        expectedTotal: quote.data!.total,
        website: form.website || undefined,
        consent: form.consent,
        idempotencyKey: idempotency.current.key,
      }),
    onSuccess: (res) => {
      const { comment: _comment, website: _website, ...contact } = form
      if (!user) saveGuestContact(contact)
      saveOrderReceipt(res.order.number, res)
      clearCart()
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: ['product'] })
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      queryClient.invalidateQueries({ queryKey: ['my-order'] })
      navigate(`/order/${res.order.number}`, { replace: true })
    },
    onError: async (error) => {
      const problem = problemOf(error)
      if (problem.code === 'cart_changed' || problem.code === 'price_changed' || problem.code === 'out_of_stock') {
        const fresh = await quote.refetch()
        if (fresh.data) replaceFromQuote(fresh.data)
        setBanner(
          problem.code === 'price_changed'
            ? t.pricesChanged
            : `${problem.detail}${problem.details?.length ? ': ' + problem.details.join('; ') : ''}. ${t.cartUpdatedConfirm}`,
        )
      } else if (problem.errors) {
        setErrors(problem.errors)
        setBanner(problem.detail)
        focusFirstError()
        return
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

  if (!quote.data) {
    if (!quote.isError) return <PageLoader />
    return (
      <div className="notice error row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>{t.quoteFailed} {problemOf(quote.error).detail}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => quote.refetch()} disabled={quote.isFetching}>
          {quote.isFetching ? <Spinner /> : t.retry}
        </button>
      </div>
    )
  }
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
            — {t.loginBenefit}
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
            <h3>{t.contactsTitle}</h3>
            <div className="form-grid">
              <Field label={t.name} error={errors.customerName}>
                <input className={clsx('input', errors.customerName && 'invalid')} value={form.customerName} onChange={(e) => set('customerName', e.target.value)} autoComplete="name" maxLength={150} />
              </Field>
              <Field label={t.phone} error={errors.phone}>
                <PhoneInput className={clsx('input', errors.phone && 'invalid')} value={form.phone} onChange={(v) => set('phone', v)} />
              </Field>
              <Field label={`${t.email} (${t.optional})`} error={errors.email} className="full">
                <input className={clsx('input', errors.email && 'invalid')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
              </Field>
            </div>
            <input type="text" name="website" value={form.website} onChange={(e) => set('website', e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -9999, opacity: 0 }} aria-hidden="true" />
          </section>

          <section className="panel form-section">
            <h3>{t.receiving}</h3>
            <div className="choice-grid">
              {(
                [
                  ['PICKUP', t.pickup, settings ? [settings.city, settings.address].filter(Boolean).join(', ') : ''],
                  [
                    'DELIVERY',
                    t.deliveryCourier,
                    settings
                      ? `${money(settings.deliveryFee)}` +
                        (settings.freeDeliveryThreshold ? t.freeDeliveryFrom(money(settings.freeDeliveryThreshold), settings.freeDeliveryRetailOnly) : '')
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
            {form.deliveryMethod === 'DELIVERY' && <DeliveryNote variant="compact" />}
            {form.deliveryMethod === 'DELIVERY' && (
              <div className="form-grid">
                <Field label={t.city} error={errors.city}>
                  <input className={clsx('input', errors.city && 'invalid')} value={form.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" />
                </Field>
                <Field label={t.address} error={errors.address}>
                  <input className={clsx('input', errors.address && 'invalid')} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={t.addressPlaceholder} autoComplete="street-address" />
                </Field>
              </div>
            )}
          </section>

          <section className="panel form-section">
            <h3>{t.payment}</h3>
            <div className="choice-grid">
              {(
                [
                  ['KASPI', t.payKaspi, t.kaspiHint],
                  ['CARD_TRANSFER', t.payCard, t.cardHint],
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
              <textarea className="textarea" value={form.comment} onChange={(e) => set('comment', e.target.value)} maxLength={1000} placeholder={t.commentPlaceholder} />
            </Field>
          </section>
        </div>

        <aside className="panel panel-pad checkout-summary">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h3>{t.yourOrder}</h3>
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
          <label className={clsx('consent', errors.consent && 'invalid')} style={{ marginTop: 16 }}>
            <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} />
            <span>
              {t.consentLabel}{' '}
              <Link to="/privacy" target="_blank" className="btn-link">
                {t.consentLink}
              </Link>
            </span>
          </label>
          {errors.consent && <small className="field-error">{errors.consent}</small>}
          <button type="submit" className="btn btn-gold btn-block btn-lg" style={{ marginTop: 18 }} disabled={checkout.isPending || quote.isPlaceholderData || q.items.length === 0}>
            {checkout.isPending ? <Spinner /> : quote.isPlaceholderData ? t.recalculating : `${t.placeOrder} · ${money(q.total)}`}
          </button>
          <p className="muted small" style={{ marginTop: 10, textAlign: 'center' }}>
            {t.payAfterConfirm}
          </p>
        </aside>
      </form>
    </>
  )
}
