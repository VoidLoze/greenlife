import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/endpoints'
import type { CheckoutResponse } from '@/api/types'
import { WhatsappIcon } from '@/components/Icons'
import { OrderDetails } from '@/components/OrderView'
import { EmptyState, PageLoader } from '@/components/ui'
import { useT } from '@/i18n'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'

export default function OrderSuccessPage() {
  const { number = '' } = useParams()
  const { t } = useT()
  const location = useLocation()
  const authStatus = useAuthStore((s) => s.status)
  useDocumentTitle(`${t.orderNumber} ${number}`)

  const stored = useMemo<CheckoutResponse | null>(() => {
    const fromState = location.state as CheckoutResponse | null
    if (fromState?.order?.number === number) return fromState
    try {
      const raw = sessionStorage.getItem(`gl-order-${number}`)
      return raw ? (JSON.parse(raw) as CheckoutResponse) : null
    } catch {
      return null
    }
  }, [location.state, number])

  const remote = useQuery({
    queryKey: ['my-order', number],
    queryFn: () => ordersApi.myOrder(number),
    enabled: !stored && authStatus === 'authenticated',
  })
  const whatsapp = useQuery({
    queryKey: ['my-order-wa', number],
    queryFn: () => ordersApi.whatsapp(number),
    enabled: !stored && authStatus === 'authenticated',
  })

  const order = stored?.order ?? remote.data
  const whatsappUrl = stored?.whatsappUrl ?? whatsapp.data?.url

  if (!order) {
    if (authStatus === 'loading' || remote.isLoading) return <PageLoader />
    return (
      <EmptyState
        icon="📦"
        title={`${t.orderNumber}: ${number}`}
        text="Проверить статус заказа можно по номеру и телефону."
        action={
          <Link to={`/track?number=${encodeURIComponent(number)}`} className="btn btn-primary">
            {t.trackOrder}
          </Link>
        }
      />
    )
  }

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 760, margin: '0 auto' }}>
      <div className="panel success-card">
        <div className="success-icon">✓</div>
        <h1>{t.orderPlaced}</h1>
        <div>
          <span className="muted">{t.orderNumber}</span>
          <div className="order-number">{order.number}</div>
        </div>
        <p className="muted">{t.orderPlacedHint}</p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          {whatsappUrl && (
            <a className="btn btn-whatsapp btn-lg" href={whatsappUrl} target="_blank" rel="noreferrer">
              <WhatsappIcon size={20} /> {t.sendToWhatsapp}
            </a>
          )}
          <Link to="/catalog" className="btn btn-ghost btn-lg">
            {t.goToCatalog}
          </Link>
        </div>
      </div>
      <div className="panel panel-pad">
        <OrderDetails order={order} />
      </div>
    </div>
  )
}
