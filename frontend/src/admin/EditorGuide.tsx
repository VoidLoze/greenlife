import clsx from 'clsx'
import type { AdminProduct } from '@/api/admin'
import { CheckIcon } from '@/components/Icons'
import { money } from '@/lib/format'

export type Tab = 'main' | 'description' | 'specs' | 'media'

export interface GuideInput {
  name: string
  categoryId: string
  price: number | null
  oldPrice: number | null
  partnerPrice: number | null
  summary: string
  description: string
  benefits: number
  volume: string
  badge: string
  product: AdminProduct | null
}

type StepStatus = 'done' | 'todo' | 'required' | 'locked'

interface Step {
  id: Tab
  label: string
  status: StepStatus
  note: string
}

const photoCount = (product: AdminProduct | null) => product?.media.filter((m) => m.kind === 'PHOTO').length ?? 0

function steps(g: GuideInput): Step[] {
  const missingMain = [!g.name.trim() && 'название', !g.categoryId && 'категория', !(g.price && g.price > 0) && 'цена'].filter(Boolean)
  const photos = photoCount(g.product)
  return [
    {
      id: 'main',
      label: 'Основное',
      status: missingMain.length ? 'required' : 'done',
      note: missingMain.length ? `Нужно: ${missingMain.join(', ')}` : 'Название, категория, цена',
    },
    {
      id: 'description',
      label: 'Описание',
      status: g.summary.trim() && g.description.trim() ? 'done' : 'todo',
      note: g.summary.trim() && g.description.trim() ? 'Тексты заполнены' : 'Краткое и подробное описание',
    },
    {
      id: 'specs',
      label: 'Характеристики',
      status: g.benefits >= 3 ? 'done' : 'todo',
      note: g.benefits >= 3 ? `${g.benefits} преимуществ` : 'Преимущества, характеристики',
    },
    {
      id: 'media',
      label: 'Фото и видео',
      status: !g.product ? 'locked' : photos ? 'done' : 'required',
      note: !g.product ? 'Откроется после создания' : photos ? `${photos} фото` : 'Нужно хотя бы 1 фото',
    },
  ]
}

export const TAB_ORDER: Tab[] = ['main', 'description', 'specs', 'media']

export function EditorSteps({ input, tab, onTab }: { input: GuideInput; tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <nav className="editor-steps" aria-label="Шаги заполнения товара">
      {steps(input).map((step, idx) => (
        <button
          key={step.id}
          type="button"
          className={clsx('editor-step', step.status, tab === step.id && 'active')}
          aria-current={tab === step.id ? 'step' : undefined}
          onClick={() => onTab(step.id)}
        >
          <span className="editor-step-num">{step.status === 'done' ? <CheckIcon size={14} /> : step.status === 'locked' ? '🔒' : idx + 1}</span>
          <span className="editor-step-text">
            <strong>{step.label}</strong>
            <small>{step.note}</small>
          </span>
        </button>
      ))}
    </nav>
  )
}

export function StepNav({ tab, onTab, nextLabel }: { tab: Tab; onTab: (tab: Tab) => void; nextLabel?: Partial<Record<Tab, string>> }) {
  const idx = TAB_ORDER.indexOf(tab)
  const prev = TAB_ORDER[idx - 1]
  const next = TAB_ORDER[idx + 1]
  const labels: Record<Tab, string> = { main: 'Основное', description: 'Описание', specs: 'Характеристики', media: 'Фото и видео' }
  return (
    <div className="step-nav">
      {prev ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTab(prev)}>
          ← {labels[prev]}
        </button>
      ) : (
        <span />
      )}
      {next && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onTab(next)}>
          {nextLabel?.[next] ?? `Далее: ${labels[next]}`} →
        </button>
      )}
    </div>
  )
}

/** Mirrors ProductQuality.assertPublishable on the server, evaluated live on the unsaved form. */
export function publishBlockers(g: GuideInput): { label: string; ok: boolean }[] {
  const list = [
    { label: 'Название', ok: !!g.name.trim() },
    { label: 'Розничная цена', ok: !!(g.price && g.price > 0) },
    { label: 'Категория', ok: !!g.categoryId },
    { label: 'Хотя бы одно фото (обложка)', ok: !!g.product?.coverUrl },
  ]
  if (g.oldPrice != null) list.push({ label: 'Старая цена выше розничной', ok: !!g.price && g.oldPrice > g.price })
  return list
}

export function PublishChecklist({ items }: { items: { label: string; ok: boolean }[] }) {
  const ready = items.every((i) => i.ok)
  return (
    <div className={clsx('publish-check', ready && 'ready')}>
      <strong>{ready ? '✓ Готово к публикации' : 'Для публикации нужно:'}</strong>
      {!ready && (
        <ul>
          {items.map((item) => (
            <li key={item.label} className={item.ok ? 'ok' : undefined}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CardPreview({ input, autoPartner }: { input: GuideInput; autoPartner: number | null }) {
  const partner = input.partnerPrice ?? autoPartner
  return (
    <div className="card-preview" aria-label="Предпросмотр карточки">
      <div className="card-preview-visual">
        {input.product?.coverUrl ? <img src={input.product.coverUrl} alt="" /> : <span>Нет фото</span>}
        {input.badge.trim() && <em>{input.badge.trim()}</em>}
      </div>
      <div className="card-preview-body">
        <strong className={clsx(!input.name.trim() && 'placeholder')}>{input.name.trim() || 'Название товара'}</strong>
        {input.volume.trim() && <small>{input.volume.trim()}</small>}
        <div className="card-preview-prices">
          <span>
            Розница
            <b>{input.price ? money(input.price) : '—'}</b>
            {input.oldPrice && input.price && input.oldPrice > input.price ? <s>{money(input.oldPrice)}</s> : null}
          </span>
          <span className="partner">
            Партнёрам
            <b>{partner ? money(partner) : '—'}</b>
          </span>
        </div>
      </div>
    </div>
  )
}
