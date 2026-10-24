import { useEffect, type ReactNode } from 'react'
import clsx from 'clsx'
import { useScrollLock } from '@/lib/hooks'
import { useToastStore } from '@/store/toast'
import { CloseIcon } from './Icons'

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('spinner', className)} role="status" aria-label="Загрузка" />
}

export function PageLoader() {
  return (
    <div className="center-box">
      <Spinner />
    </div>
  )
}

export function EmptyState({
  icon = '🌿',
  title,
  text,
  action,
}: {
  icon?: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

export function QuantityStepper({
  value,
  max = 99,
  onChange,
  large,
}: {
  value: number
  max?: number
  onChange: (value: number) => void
  large?: boolean
}) {
  const clamp = (n: number) => Math.max(0, Math.min(max, n))
  return (
    <div className={clsx('stepper', large && 'lg')}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} aria-label="Меньше">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={1}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n) && n >= 1) onChange(clamp(Math.floor(n)))
        }}
        aria-label="Количество"
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Больше">
        +
      </button>
    </div>
  )
}

/** Compact pagination with ellipses; `page` is 1-based. */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  const pages: (number | '…')[] = []
  const window = 1
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= window) {
      pages.push(p)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }
  return (
    <nav className="pagination" aria-label="Страницы">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Назад">
        ‹
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="muted">
            …
          </span>
        ) : (
          <button key={p} type="button" className={clsx(p === page && 'active')} onClick={() => onChange(p)}>
            {p}
          </button>
        ),
      )}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Вперёд">
        ›
      </button>
    </nav>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" style={wide ? { width: 'min(900px, calc(100vw - 32px))' } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Закрыть">
            <CloseIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={clsx('toast', t.kind)}>
          <span>{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Закрыть">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={clsx('field', className)}>
      <span>{label}</span>
      {children}
      {error ? <span className="error">{error}</span> : hint ? <small>{hint}</small> : null}
    </label>
  )
}
