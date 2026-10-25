import { useEffect, useRef, type InputHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { formatPhone } from '@/lib/format'
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
  dirty,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** The form inside has unsaved input: closing by backdrop/Esc/× asks first. */
  dirty?: boolean
}) {
  useScrollLock(open)
  const box = useRef<HTMLDivElement>(null)
  // A stray click on the backdrop or Esc must not throw away what was typed into the form.
  const dismiss = () => {
    if (dirty && !window.confirm('Закрыть без сохранения? Введённые данные пропадут.')) return
    onClose()
  }
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss
  useFocusTrap(box, open, () => dismissRef.current())
  if (!open) return null
  // On <body>: inside a .panel (backdrop-filter) a fixed window is clipped to the panel and sits under the sticky header.
  return createPortal(
    <>
      <div className="overlay" onClick={dismiss} />
      <div ref={box} className="modal" role="dialog" aria-modal="true" tabIndex={-1} style={wide ? { width: 'min(900px, calc(100vw - 32px))' } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="close-btn" onClick={dismiss} aria-label="Закрыть">
            <CloseIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps keyboard focus inside a dialog while it is open (Tab cycles, Esc closes) and returns it to the element that
 * opened the dialog afterwards.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape: () => void) {
  const escape = useRef(onEscape)
  escape.current = onEscape
  useEffect(() => {
    if (!active) return
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    if (node && !node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>('[autofocus]') ?? node
      first.focus({ preventScroll: true })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        escape.current()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [ref, active])
}

/**
 * Phone field for Kazakhstan numbers. "+7 " is put in on focus, so the first digit typed is the start of the number:
 * typing 707… gives +7 707…, not +7 07…. A leading 8 (the old trunk prefix) is dropped.
 */
export function PhoneInput({
  value,
  onChange,
  className,
  ...rest
}: { value: string; onChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      {...rest}
      className={className ?? 'input'}
      type="tel"
      inputMode="tel"
      autoComplete={rest.autoComplete ?? 'tel'}
      placeholder={rest.placeholder ?? '+7 7__ ___ __ __'}
      value={value}
      onFocus={(e) => {
        if (!value) onChange('+7 ')
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        if (value.replace(/\D/g, '').length <= 1) onChange('')
        rest.onBlur?.(e)
      }}
      onChange={(e) => {
        const raw = e.target.value
        const digits = raw.replace(/\D/g, '')
        if (digits.length <= 1 && raw.trim().startsWith('+')) {
          onChange('+7 ')
          return
        }
        const national = raw.trim().startsWith('+7') ? raw.trim().slice(2).replace(/\D/g, '') : null
        if (national != null && national.startsWith('8')) {
          onChange(formatPhone('+7' + national.slice(1)))
          return
        }
        onChange(raw ? formatPhone(raw) : '')
      }}
    />
  )
}
