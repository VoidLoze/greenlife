import { useEffect } from 'react'
import type { Media } from '@/api/types'
import { useT } from '@/i18n'
import { useScrollLock } from '@/lib/hooks'
import { ChevronLeft, ChevronRight, CloseIcon } from './Icons'

export function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: Media[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  useScrollLock(true)
  const { t } = useT()
  const count = items.length
  const item = items[index]

  useEffect(() => {
    // Captured and stopped here: the product window and its carousel underneath must not react to the same keys.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % count)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, count, onIndex, onClose])

  if (!item) return null

  return (
    <div className="lightbox" role="dialog" aria-modal="true">
      <div className="lightbox-top">
        <span className="muted">
          {index + 1} / {count}
        </span>
        <div className="row">
          <a className="btn btn-ghost btn-sm" href={item.url} target="_blank" rel="noreferrer">
            {t.original}
          </a>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Закрыть">
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
      <div className="lightbox-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img src={item.url} alt={item.altText ?? item.title ?? ''} />
        {count > 1 && (
          <>
            <button type="button" className="lightbox-nav prev" onClick={() => onIndex((index - 1 + count) % count)} aria-label="Назад">
              <ChevronLeft />
            </button>
            <button type="button" className="lightbox-nav next" onClick={() => onIndex((index + 1) % count)} aria-label="Вперёд">
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      <div className="lightbox-bottom">
        {item.title && <strong style={{ display: 'block', color: 'var(--ink)' }}>{item.title}</strong>}
        {item.description && <span>{item.description}</span>}
      </div>
    </div>
  )
}
