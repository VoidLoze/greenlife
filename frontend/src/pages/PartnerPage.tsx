import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import type { Media } from '@/api/types'
import { CheckIcon, GiftIcon, PhoneIcon, TelegramIcon, WhatsappIcon } from '@/components/Icons'
import { Lightbox } from '@/components/Lightbox'
import { CardGiftBanner, DeliveryNote } from '@/components/Promo'
import { CARD_BENEFITS, CARD_GIFT_CALL, GIFT_SETS, type GiftSet } from '@/content/promo'
import { useT } from '@/i18n'
import { whatsappLink } from '@/lib/format'
import { useDocumentTitle, useIsPhone, useSettings } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'

interface PartnerOption {
  id: string
  image: string
  /** Background of the card, matched to the colour of the card in the photo. */
  tone: 'green' | 'black'
  serial: [string, string]
  tier: [string, string]
  name: [string, string]
  summary: [string, string]
  accents: [string[], string[]]
}

const OPTIONS: PartnerOption[] = [
  {
    id: 'card-plus-item',
    image: '/cards/IMG_5334.jpeg',
    tone: 'green',
    serial: ['MEMBERSHIP CARD', 'Мүшелік картасы'],
    tier: ['Стандарт', 'Стандарт'],
    name: ['Карта + дополнительный товар', 'Карта + қосымша тауар'],
    summary: [
      'Комбо-опция: карта участия и дополнительный товар для более выгодного участия в программе с расширенными условиями.',
      'Комбо-опция: қатысу картасы плюс қосымша тауар, кеңейтілген қатысу шарттарымен.',
    ],
    accents: [
      ['Дополнительный товар', 'Более выгодные условия', 'Подходит для расширенного участия'],
      ['Қосымша тауар', 'Көбірек тиімді шарттар', 'Кеңейтілген қатысуға жарайды'],
    ],
  },
  {
    id: 'full-cost',
    image: '/cards/IMG_5336.jpeg',
    tone: 'black',
    serial: ['STANDARD CARD', 'Стандартты карта'],
    tier: ['Базовая', 'Базалық'],
    name: ['Товар по 100% стоимости', '100% бағамен тауар'],
    summary: [
      'Выбор без скидки: товар приобретается по полной стоимости, без участия в бонусной программе.',
      'Жеңілдіксіз нұсқа: тауар толық бағамен, бонустық бағдарлама қатысуынсыз сатып алынады.',
    ],
    accents: [
      ['Полная стоимость', 'Без акции', 'Простой стандартный вариант'],
      ['Толық баға', 'Акциясыз', 'Қарапайым стандартты нұсқа'],
    ],
  },
]

function partnerIntro(lang: 'ru' | 'kk', discount: number | undefined) {
  if (lang === 'kk') {
    return [
      'Greenleaf серіктестік бағдарламасында қатысудың екі форматы бар: карта мен қосымша тауар немесе бонустық бағдарламаға қатыспай толық бағамен сатып алу.',
      discount ? `Серіктестік баға бөлшек бағадан ${discount}% төмен — ол каталогтағы әр тауардың жанында көрсетілген.` : null,
      'Форматты таңдаңыз — WhatsApp дайын хабарламамен ашылады.',
    ]
  }
  return [
    'В партнёрской программе Greenleaf два формата участия: карта вместе с дополнительным товаром или покупка по полной стоимости без участия в бонусной программе.',
    discount ? `Партнёрская цена на ${discount}% ниже розничной — она указана рядом с каждым товаром в каталоге.` : null,
    'Выберите формат — откроется WhatsApp с готовым сообщением.',
  ]
}

const benefitsPhone = CARD_BENEFITS.contactPhone.replace(/\D/g, '')

function Accented({ title, accent }: { title: string; accent: string | null }) {
  const at = accent ? title.indexOf(accent) : -1
  if (!accent || at < 0) return <>{title}</>
  return (
    <>
      {title.slice(0, at)}
      <span className="cb-num">{accent}</span>
      {title.slice(at + accent.length)}
    </>
  )
}

const delay = (d: number) => ({ '--d': d }) as CSSProperties

function CardBenefits() {
  const { t } = useT()
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  const { main, more, producers } = CARD_BENEFITS
  return (
    <section ref={ref} id="benefits" className={`card-benefits${shown ? ' is-shown' : ''}`} aria-labelledby="card-benefits-title">
      <div className="cb-head">
        <h2 id="card-benefits-title" className="cb-reveal" style={delay(0)}>
          {CARD_BENEFITS.lead[0]} <span>{CARD_BENEFITS.lead[1]}</span> {CARD_BENEFITS.lead[2]}
        </h2>
        <div className="cb-card cb-reveal" style={delay(1)} aria-hidden="true">
          <img src="/cards/IMG_5334.jpeg" alt="" loading="lazy" />
        </div>
      </div>

      <ul className="cb-main">
        {main.map((item, idx) => (
          <li key={item.title} className={`cb-tile cb-tile-${idx} cb-reveal`} style={delay(idx + 2)}>
            {!item.accent && (
              <span className="cb-gift" aria-hidden="true">
                <GiftIcon size={34} />
              </span>
            )}
            <strong>
              <Accented title={item.title} accent={item.accent} />
            </strong>
            <small>{item.text}</small>
          </li>
        ))}
      </ul>

      <ul className="cb-more">
        {more.map((item, idx) => (
          <li key={item.title} className="cb-reveal" style={delay(idx + 5)}>
            <span className="benefit-check">
              <CheckIcon size={16} />
            </span>
            <span>
              <strong>{item.title}</strong>
              {item.text && <small>{item.text}</small>}
            </span>
          </li>
        ))}
        <li className="cb-producers cb-reveal" style={delay(7)}>
          <div className="cb-producers-title">
            <span className="benefit-check">
              <CheckIcon size={16} />
            </span>
            <strong>{producers.title}</strong>
          </div>
          <ul className="card-benefits-countries" aria-label="Страны-производители">
            {producers.countries.map(([flag, country, goods]) => (
              <li key={country}>
                <span className="flag" aria-hidden="true">
                  {flag}
                </span>
                <span>
                  <strong>{country}</strong>
                  <small>{goods}</small>
                </span>
              </li>
            ))}
          </ul>
        </li>
      </ul>

      <div className="cb-cta cb-reveal" style={delay(8)}>
        <span className="cb-cta-label">📩 {CARD_BENEFITS.contactLabel}</span>
        <a className="card-benefits-phone" href={`tel:+${benefitsPhone}`}>
          <PhoneIcon size={18} /> {CARD_BENEFITS.contactPhone}
        </a>
        <a
          className="btn btn-whatsapp"
          href={whatsappLink(benefitsPhone, 'Здравствуйте! Хочу узнать больше о дисконтной карте Greenleaf.')}
          target="_blank"
          rel="noreferrer"
        >
          <WhatsappIcon size={18} /> {t.writeWhatsapp}
        </a>
      </div>
    </section>
  )
}

function GiftCard({ set, idx, onZoom }: { set: GiftSet; idx: number; onZoom: (idx: number) => void }) {
  const { t } = useT()
  return (
    <article className="gift-card">
      <button type="button" className="gift-visual" onClick={() => onZoom(idx)} aria-label={`Увеличить фото: ${set.title}`}>
        <img src={set.image} alt={set.title} loading="lazy" />
        <span className="gift-number">
          {t.set} {idx + 1}
        </span>
      </button>
      <div className="gift-body">
        <h3>{set.title}</h3>
        {set.groups.map((group, g) => (
          <div key={g} className="gift-group">
            {group.title && <p className="gift-group-title">{group.title}</p>}
            <ul className={group.title ? 'gift-list compact' : 'gift-list'}>
              {group.items.map((item) => (
                <li key={item.name}>
                  <span className="gift-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>
                    {item.name}
                    {item.note && <small>{item.note}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {set.footer && <p className="gift-footer">{set.footer}</p>}
      </div>
    </article>
  )
}

/** On a phone the three sets sit side by side as photo tabs, with the chosen one's contents below. */
function GiftSets() {
  const { t } = useT()
  const phone = useIsPhone()
  const [open, setOpen] = useState<number | null>(null)
  const [picked, setPicked] = useState(0)
  const media: Media[] = GIFT_SETS.map((set, idx) => ({
    id: idx,
    kind: 'PHOTO',
    url: set.image,
    thumbUrl: null,
    title: set.title,
    description: null,
    altText: set.title,
    contentType: 'image/jpeg',
    sizeBytes: 0,
    width: null,
    height: null,
    originalFilename: null,
    cover: false,
    sortOrder: idx,
  }))

  return (
    <section className="gift-section" id="gifts" aria-labelledby="gifts-title">
      <div className="gift-section-head">
        <span className="eyebrow">
          <GiftIcon size={14} /> {CARD_GIFT_CALL}
        </span>
        <h2 id="gifts-title">Подарок от компании</h2>
        <p className="muted">Полный ассортимент товара, равный стоимости дисконтной карты</p>
      </div>
      {phone ? (
        <>
          <div className="gift-tabs" role="tablist" aria-label={t.set}>
            {GIFT_SETS.map((set, idx) => (
              <button
                key={set.id}
                type="button"
                role="tab"
                aria-selected={idx === picked}
                className={clsx('gift-tab', idx === picked && 'active')}
                onClick={() => setPicked(idx)}
              >
                <img src={set.image} alt="" loading="lazy" />
                <span>
                  {t.set} {idx + 1}
                </span>
              </button>
            ))}
          </div>
          <GiftCard key={picked} set={GIFT_SETS[picked]} idx={picked} onZoom={setOpen} />
        </>
      ) : (
        <div className="gift-grid">
          {GIFT_SETS.map((set, idx) => (
            <GiftCard key={set.id} set={set} idx={idx} onZoom={setOpen} />
          ))}
        </div>
      )}
      {open !== null && <Lightbox items={media} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  )
}

function PartnerCard({ option, href }: { option: PartnerOption; href: string }) {
  const { t, lang } = useT()
  const i = lang === 'kk' ? 1 : 0
  return (
    <article id={option.id} className={`partner-card partner-tone-${option.tone}`}>
      <div className="partner-visual">
        <img src={option.image} alt={option.name[i]} loading="lazy" />
      </div>
      <div className="partner-body">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="partner-serial">{option.serial[i]}</span>
          <span className="badge badge-gold">{option.tier[i]}</span>
        </div>
        <h3>{option.name[i]}</h3>
        <p>{option.summary[i]}</p>
        <ul>
          {option.accents[i].map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <a className="btn btn-whatsapp" href={href} target="_blank" rel="noreferrer">
          <WhatsappIcon size={18} /> {t.choose}
        </a>
      </div>
    </article>
  )
}

interface StripSection {
  key: string
  label: string
  /** Element the chip scrolls to; several chips may share one. */
  target: string
  /** For chips sharing a target: whether this one is the chosen tab there. */
  selected?: boolean
  onPick?: () => void
}

/**
 * Phone-only strip of section shortcuts, styled like the catalog's category chips. The chip of the section on screen
 * lights up while the shopper scrolls.
 */
function SectionStrip({ sections }: { sections: StripSection[] }) {
  const [visible, setVisible] = useState(sections[0]?.target)
  const strip = useRef<HTMLElement>(null)
  const targetKey = [...new Set(sections.map((s) => s.target))].join(' ')
  const active = sections.find((s) => s.target === visible && s.selected !== false)?.key

  useEffect(() => {
    const targets = targetKey
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setVisible(hit.target.id)
      },
      { rootMargin: '-35% 0px -60% 0px' },
    )
    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [targetKey])

  useEffect(() => {
    const row = strip.current
    const chip = row?.querySelector<HTMLElement>('.chip.active')
    if (!row || !chip) return
    const offset = chip.getBoundingClientRect().left - row.getBoundingClientRect().left
    row.scrollTo({ left: row.scrollLeft + offset - 20, behavior: 'smooth' })
  }, [active])

  return (
    <nav ref={strip} className="category-strip partner-strip">
      {sections.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`chip${s.key === active ? ' active' : ''}`}
          onClick={() => {
            s.onPick?.()
            document.getElementById(s.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}

export default function PartnerPage() {
  const { t, lang } = useT()
  const { data: settings } = useSettings()
  const user = useAuthStore((s) => s.user)
  const phone = useIsPhone()
  const [picked, setPicked] = useState(0)
  const i = lang === 'kk' ? 1 : 0
  useDocumentTitle(t.partner)
  const sections = useMemo<StripSection[]>(
    () => [
      { key: 'benefits', label: t.benefits, target: 'benefits' },
      ...OPTIONS.map((o, idx) => ({
        key: o.id,
        label: o.name[i],
        target: 'formats',
        selected: idx === picked,
        onPick: () => setPicked(idx),
      })),
      { key: 'gifts', label: 'Подарок от компании', target: 'gifts' },
    ],
    [t, i, picked],
  )

  const contact = (option: PartnerOption) => {
    if (!settings?.whatsapp) return '#'
    const who = user ? ` Мой аккаунт: ${user.email}.` : ''
    return whatsappLink(settings.whatsapp, `Здравствуйте! Хочу оформить партнёрство: «${option.name[0]}».${who}`)
  }

  return (
    <>
      <div className="partner-hero">
        <span className="eyebrow">{t.partner}</span>
        <h1>{t.partnerTitle}</h1>
        {phone && <CardGiftBanner />}
      </div>
      {phone && <SectionStrip sections={sections} />}

      <CardBenefits />

      <div className="partner-hero after">
        <div className="partner-intro">
          {partnerIntro(lang, settings?.partnerDiscountPercent)
            .filter((line): line is string => !!line)
            .map((line) => (
              <p key={line}>{line}</p>
            ))}
        </div>
        {user?.partner && <div className="notice success">★ {t.alreadyPartner}</div>}
      </div>

      {phone ? (
        <div id="formats" className="partner-formats">
          <div className="gift-tabs partner-tabs" role="tablist">
            {OPTIONS.map((option, idx) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={idx === picked}
                className={clsx('gift-tab', idx === picked && 'active')}
                onClick={() => setPicked(idx)}
              >
                <img src={option.image} alt="" loading="lazy" />
                <span>{option.name[i]}</span>
              </button>
            ))}
          </div>
          <PartnerCard key={picked} option={OPTIONS[picked]} href={contact(OPTIONS[picked])} />
        </div>
      ) : (
        <div className="partner-grid">
          {OPTIONS.map((option) => (
            <PartnerCard key={option.id} option={option} href={contact(option)} />
          ))}
        </div>
      )}

      <GiftSets />

      <DeliveryNote />

      <div className="steps">
        {[
          [t.step1Title, t.step1Text],
          [t.step2Title, t.step2Text],
          [t.step3Title, t.step3Text],
        ].map(([title, text], idx) => (
          <div key={title} className="panel step">
            <b>0{idx + 1}</b>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 6 }}>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </div>

      <div className="row wrap" style={{ justifyContent: 'center', marginTop: 30 }}>
        {!user && (
          <Link to="/register?next=/partner" className="btn btn-gold btn-lg">
            {t.register}
          </Link>
        )}
        {settings?.telegramUrl && (
          <a className="btn btn-ghost btn-lg" href={settings.telegramUrl} target="_blank" rel="noreferrer">
            <TelegramIcon size={18} /> {t.writeTelegram}
          </a>
        )}
      </div>
    </>
  )
}
