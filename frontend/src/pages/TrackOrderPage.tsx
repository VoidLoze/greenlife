import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '@/api/client'
import { ordersApi } from '@/api/endpoints'
import { OrderDetails } from '@/components/OrderView'
import { Field, PhoneInput, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { isValidPhone } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'

export default function TrackOrderPage() {
  const { t } = useT()
  const [params] = useSearchParams()
  const [number, setNumber] = useState(params.get('number') ?? '')
  const [phone, setPhone] = useState('')
  useDocumentTitle(t.trackOrder)

  const track = useMutation({ mutationFn: () => ordersApi.track(number, phone) })
  const valid = /^GL-\d{6}-[0-9A-Z]{4,6}$/.test(number.trim()) && isValidPhone(phone)

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 760, margin: '0 auto' }}>
      <div>
        <span className="eyebrow">Greenleaf</span>
        <h1>{t.trackOrder}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {t.trackHint}
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
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="GL-261025-7KQ2MX" maxLength={24} />
          </Field>
          <Field label={t.phone}>
            <PhoneInput value={phone} onChange={setPhone} />
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
