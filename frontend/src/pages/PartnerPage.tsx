import { Link } from 'react-router'
import { TelegramIcon, WhatsappIcon } from '@/components/Icons'
import { useT } from '@/i18n'
import { whatsappLink } from '@/lib/format'
import { useDocumentTitle, useSettings } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'

interface PartnerOption {
  id: string
  image: string
  serial: [string, string]
  tier: [string, string]
  name: [string, string]
  summary: [string, string]
  accents: [string[], string[]]
}

const OPTIONS: PartnerOption[] = [
  {
    id: 'discount-card',
    image: '/cards/IMG_5334.jpeg',
    serial: ['DISCOUNT CARD', 'Жеңілдік картасы'],
    tier: ['Премиум', 'Премиум'],
    name: ['Дисконтная карта', 'Жеңілдік картасын таңдау'],
    summary: [
      'Подходит для клиентов, которые хотят начать сотрудничество с накопительной системой скидок. Дисконтная карта позволяет получать выгодные условия при последующих покупках и участвовать в партнёрской программе.',
      'Клиенттер үшін жинақтылық жүйесі бар, әрі қарай сатып алуларда тиімді шарттар алуға мүмкіндік беретін нұсқа.',
    ],
    accents: [
      ['Накопительная система скидок', 'Удобная программа лояльности', 'Подходит для регулярных клиентов'],
      ['Жинақтылық жүйесі', 'Ыңғайлы адалдық бағдарламасы', 'Тұрақты клиенттерге жарайды'],
    ],
  },
  {
    id: 'card-plus-item',
    image: '/cards/IMG_5335.jpeg',
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
      'Greenleaf серіктестік бағдарламасында қатысудың үш форматы бар: жинақтылық жүйесі бар жеңілдік картасы, карта мен қосымша тауар немесе бонустық бағдарламаға қатыспай толық бағамен сатып алу.',
      discount ? `Серіктестік баға бөлшек бағадан ${discount}% төмен — ол каталогтағы әр тауардың жанында көрсетілген.` : null,
      'Форматты таңдаңыз — WhatsApp дайын хабарламамен ашылады.',
    ]
  }
  return [
    'В партнёрской программе Greenleaf три формата участия: дисконтная карта с накопительной системой скидок, карта вместе с дополнительным товаром или покупка по полной стоимости без участия в бонусной программе.',
    discount ? `Партнёрская цена на ${discount}% ниже розничной — она указана рядом с каждым товаром в каталоге.` : null,
    'Выберите формат — откроется WhatsApp с готовым сообщением.',
  ]
}

export default function PartnerPage() {
  const { t, lang } = useT()
  const { data: settings } = useSettings()
  const user = useAuthStore((s) => s.user)
  const i = lang === 'kk' ? 1 : 0
  useDocumentTitle(t.partner)

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
        <div className="partner-intro">
          {partnerIntro(lang, settings?.partnerDiscountPercent)
            .filter((line): line is string => !!line)
            .map((line) => (
              <p key={line}>{line}</p>
            ))}
        </div>
        {user?.partner && <div className="notice success">★ Вы уже партнёр — партнёрские цены применяются автоматически.</div>}
      </div>

      <div className="partner-grid">
        {OPTIONS.map((option, idx) => (
          <article key={option.id} className={`partner-card partner-tone-${idx + 1}`}>
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
              <a className="btn btn-whatsapp" href={contact(option)} target="_blank" rel="noreferrer">
                <WhatsappIcon size={18} /> {t.choose}
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="steps">
        {[
          ['Выберите формат', 'Нажмите «Выбрать» — откроется WhatsApp с готовым сообщением.'],
          ['Менеджер подтвердит', 'Мы ответим, расскажем детали и отметим ваш аккаунт как партнёрский.'],
          ['Покупайте выгодно', 'После входа в аккаунт партнёрские цены применяются автоматически.'],
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
