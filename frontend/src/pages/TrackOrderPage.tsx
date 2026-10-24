import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '@/api/client'
import { ordersApi } from '@/api/endpoints'
import { OrderDetails } from '@/components/OrderView'
import { Field, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { formatPhone, isValidPhone } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'

export default function TrackOrderPage() {
  const { t } = useT()
  const [params] = useSearchParams()
  const [number, setNumber] = useState(params.get('number') ?? '')
  const [phone, setPhone] = useState('')
  useDocumentTitle(t.trackOrder)

  const track = useMutation({ mutationFn: () => ordersApi.track(number, phone) })
  const valid = number.trim().length >= 6 && isValidPhone(phone)

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 760, margin: '0 auto' }}>
      <div>
        <span className="eyebrow">Greenleaf</span>
        <h1>{t.trackOrder}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Введите номер заказа и телефон, указанный при оформлении.
        </p>
      </div>
      <form
        className="panel form-section"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) track.mutate()
        }}
      >
        <div className="form-grid">
          <Field label={t.orderNumber}>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="GL-261020-0001" />
          </Field>
          <Field label={t.phone}>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value ? formatPhone(e.target.value) : '')} placeholder="+7 7__ ___ __ __" inputMode="tel" />
          </Field>
        </div>
        {track.isError && <div className="notice error">{errorMessage(track.error)}</div>}
        <button type="submit" className="btn btn-primary" disabled={!valid || track.isPending}>
          {track.isPending ? <Spinner /> : t.search}
        </button>
      </form>
      {track.data && (
        <div className="panel panel-pad">
          <OrderDetails order={track.data} />
        </div>
      )}
    </div>
  )
}
