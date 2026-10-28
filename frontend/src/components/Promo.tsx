import { Fragment, useEffect, useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { CARD_GIFT_CALL } from '@/content/promo'
import { money } from '@/lib/format'
import { useSettings } from '@/lib/hooks'
import { GiftIcon, TruckIcon } from './Icons'

/** Cartoon display fonts with Cyrillic; take N of the ticker uses font N mod the list length. */
const MARQUEE_FONTS = ['Rubik Bubbles', 'Lobster', 'Seymour One', 'Rubik Wet Paint', 'Underdog', 'Rubik Moonrocks']

/** Loads only the glyphs the ticker needs (`text=`), so six fonts cost a few kilobytes. */
function useMarqueeFonts(text: string) {
  useEffect(() => {
    if (document.getElementById('marquee-fonts')) return
    const glyphs = [...new Set((text + text.toUpperCase()).replace(/\s/g, ''))].join('')
    const families = MARQUEE_FONTS.map((f) => `family=${f.replace(/ /g, '+')}`).join('&')
    const link = document.createElement('link')
    link.id = 'marquee-fonts'
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(glyphs)}&display=swap`
    document.head.appendChild(link)
  }, [text])
}

/** Seamless ticker: the content is rendered twice and the track slides by exactly one copy. */
export function Marquee({ sentences, to }: { sentences: string[][]; to: string }) {
  const text = sentences.map((takes) => takes.join(' ')).join(' ')
  useMarqueeFonts(text)
  const layout = useMemo(() => {
    let take = 0
    let word = 0
    return sentences.map((takes) =>
      takes.map((takeText) => ({
        take: take++,
        words: takeText.split(' ').map((w) => ({ text: w, index: word++ })),
      })),
    )
  }, [sentences])
  const style = { '--marquee-duration': `${Math.max(30, Math.round(text.length * 0.32))}s` } as CSSProperties

  return (
    <Link to={to} className="marquee" aria-label={text} style={style}>
      <span className="marquee-track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <span key={copy} className="marquee-item">
            {layout.map((takes, s) => (
              <Fragment key={s}>
                <span className="marquee-sentence">
                  {takes.map(({ take, words }) => (
                    <span
                      key={take}
                      className={`marquee-take take-${take % MARQUEE_FONTS.length}`}
                      style={{ '--t': take, fontFamily: `'${MARQUEE_FONTS[take % MARQUEE_FONTS.length]}', var(--font-body)` } as CSSProperties}
                    >
                      {words.map((w) => (
                        <span key={w.index} className="marquee-word" style={{ '--i': w.index, '--tilt': `${((w.index * 37) % 7) - 3}deg` } as CSSProperties}>
                          {w.text}
                        </span>
                      ))}
                    </span>
                  ))}
                </span>
                <i className="marquee-star">✦</i>
              </Fragment>
            ))}
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
