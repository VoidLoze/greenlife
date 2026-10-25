import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { CARD_GIFT_CALL } from '@/content/promo'
import { money } from '@/lib/format'
import { useSettings } from '@/lib/hooks'
import { GiftIcon, TruckIcon } from './Icons'

/** Seamless ticker: the text is rendered twice and the track slides by exactly one copy. */
export function Marquee({ text, to }: { text: string; to: string }) {
  const style = { '--marquee-duration': `${Math.max(20, Math.round(text.length * 0.13))}s` } as CSSProperties
  return (
    <Link to={to} className="marquee" aria-label={text} style={style}>
      <span className="marquee-track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <span key={copy} className="marquee-item">
            {text}
            <i>✦</i>
          </span>
        ))}
      </span>
    </Link>
  )
}

export function DeliveryNote({ variant = 'card' }: { variant?: 'card' | 'compact' }) {
  const { data: settings } = useSettings()
  const threshold = settings?.freeDeliveryThreshold || 7000
  return (
    <div className={`delivery-note ${variant}`}>
      <span className="delivery-note-icon">
        <TruckIcon size={variant === 'compact' ? 18 : 22} />
      </span>
      <p>
        <b>Бесплатная доставка до двери</b> по розничной цене при покупке от {money(threshold)} или при покупке
        дисконтной карты в день приобретения
      </p>
    </div>
  )
}

export function CardGiftBanner({ className = '' }: { className?: string }) {
  return (
    <Link to="/partner#gifts" className={`card-gift-banner ${className}`}>
      <span className="card-gift-icon">
        <GiftIcon size={22} />
      </span>
      <span className="card-gift-text">{CARD_GIFT_CALL}</span>
      <span className="card-gift-cta" aria-hidden="true">
        →
      </span>
    </Link>
  )
}
