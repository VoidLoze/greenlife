import type { ReactNode } from 'react'
import type { MediaKind, OrderStatus, ProductStatus } from '@/api/types'

export const productStatusLabel: Record<ProductStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'В архиве',
}

export const productStatusBadge: Record<ProductStatus, string> = {
  DRAFT: 'badge-amber',
  PUBLISHED: 'badge-green',
  ARCHIVED: 'badge-gray',
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  SHIPPED: 'Передан в доставку',
  COMPLETED: 'Выполнен',
  CANCELLED: 'Отменён',
}

export const mediaKindLabel: Record<MediaKind, string> = {
  PHOTO: 'Фото',
  SCREENSHOT: 'Скрин',
  DOCUMENT: 'Документ',
  VIDEO: 'Видео',
}

export function scoreColor(score: number) {
  if (score >= 80) return 'var(--success)'
  if (score >= 50) return 'var(--warning)'
  return 'var(--danger)'
}

export function CompletenessBar({ score }: { score: number }) {
  return (
    <div className="completeness" title={`Заполненность карточки: ${score}%`}>
      <div className="track">
        <div className="fill" style={{ width: `${score}%`, background: scoreColor(score) }} />
      </div>
      <span style={{ color: scoreColor(score) }}>{score}%</span>
    </div>
  )
}

export function ScoreRing({ score }: { score: number }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className="score-ring">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
        <circle
          cx="46"
          cy="46"
          r={r}
          stroke={scoreColor(score)}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <strong>{score}</strong>
    </div>
  )
}

export function AdminHead({ title, eyebrow, children }: { title: ReactNode; eyebrow?: string; children?: ReactNode }) {
  return (
    <div className="admin-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <label className="toggle" title={label}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  )
}

/** Converts empty strings to null so optional fields are cleared rather than stored as "". */
export const nullIfBlank = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null)

export const numberOrNull = (value: string) => {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Tenge amounts are whole numbers, but people type them as "12 500", "12,500" or "12.500": a separator followed by
 * exactly three digits is a thousands separator, not a decimal point.
 */
export const moneyOrNull = (value: string) => {
  const compact = value.replace(/[\s\u00a0']/g, '')
  if (compact === '') return null
  const n = Number(compact.replace(/[.,](?=\d{3}(?:[.,]|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
