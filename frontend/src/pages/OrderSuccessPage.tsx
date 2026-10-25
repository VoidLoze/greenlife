import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/endpoints'
import type { CheckoutResponse } from '@/api/types'
import { WhatsappIcon } from '@/components/Icons'
import { OrderDetails } from '@/components/OrderView'
import { EmptyState, PageLoader } from '@/components/ui'
import { useT } from '@/i18n'
import { useDocumentTitle, useSettings } from '@/lib/hooks'
import { loadOrderReceipt } from '@/lib/session'
import { useAuthStore } from '@/store/auth'

export default function OrderSuccessPage() {
  const { number = '' } = useParams()
  const { t } = useT()
  const { data: settings } = useSettings()
  const authStatus = useAuthStore((s) => s.status)
  useDocumentTitle(`${t.orderNumber} ${number}`)

  // The tab receipt (not history state) is the source, so it disappears together with the session on sign-out.
  const stored = useMemo(() => {
    const receipt = loadOrderReceipt<CheckoutResponse>(number)
    return receipt?.order?.number === number ? receipt : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, authStatus])

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
        text={t.trackByNumberHint}
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
        <div className="panel panel-pad" style={{ width: '100%', textAlign: 'left' }}>
          <h4 className="eyebrow" style={{ marginBottom: 10 }}>
            {t.whatNext}
          </h4>
          <ol className="next-steps">
            <li>{t.nextConfirm}</li>
            <li>
              {order.paymentMethod === 'KASPI' ? t.nextKaspi : order.paymentMethod === 'CARD_TRANSFER' ? t.nextCard : t.nextCash}
            </li>
            <li>
              {order.deliveryMethod === 'PICKUP' ? (
                <>
                  {t.nextPickup} <b>{settings ? [settings.city, settings.address].filter(Boolean).join(', ') : ''}</b>
                  {settings?.workingHours ? ` · ${settings.workingHours}` : ''}
                </>
              ) : (
                <>
                  {t.nextDelivery} <b>{[order.city, order.address].filter(Boolean).join(', ')}</b>
                </>
              )}
            </li>
            <li>{t.nextTrack}</li>
          </ol>
        </div>
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
