import { useEffect, useRef, useState, type TouchEvent } from 'react'
import clsx from 'clsx'
import type { Media, ProductDetail } from '@/api/types'
import { parseVideo } from '@/lib/video'
import { ChevronLeft, ChevronRight, PlayIcon } from './Icons'
import { VideoPlayer } from './VideoPlayer'

export type Slide =
  | { key: string; type: 'video'; url: string; title: string | null; poster: string | null }
  | { key: string; type: 'image'; media: Media; screenshot: boolean }

/** Video goes first (the admin link, then uploaded files), then photos, then (optionally) screenshots. */
export function productSlides(product: ProductDetail, withScreenshots = true): Slide[] {
  const slides: Slide[] = []
  if (product.videoUrl && parseVideo(product.videoUrl)) {
    slides.push({ key: 'video-link', type: 'video', url: product.videoUrl, title: null, poster: null })
  }
  for (const v of product.videos ?? []) {
    slides.push({ key: `video-${v.id}`, type: 'video', url: v.url, title: v.title, poster: v.thumbUrl })
  }
  for (const m of product.photos) slides.push({ key: `photo-${m.id}`, type: 'image', media: m, screenshot: false })
  if (withScreenshots) slides.push(...screenshotSlides(product))
  return slides
}

export function screenshotSlides(product: ProductDetail): Slide[] {
  return product.screenshots.map((m) => ({ key: `shot-${m.id}`, type: 'image', media: m, screenshot: true }))
}

function slideThumb(slide: Slide): string | null {
  if (slide.type === 'image') return slide.media.thumbUrl ?? slide.media.url
  if (slide.poster) return slide.poster
  const source = parseVideo(slide.url)
  return source?.type === 'youtube' ? source.poster : null
}

const SWIPE_THRESHOLD = 45

export function MediaCarousel({
  slides,
  alt,
  keyboard = false,
  onImageClick,
}: {
  slides: Slide[]
  alt: string
  keyboard?: boolean
  onImageClick?: (media: Media) => void
}) {
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null)
  const thumbs = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const count = slides.length
  const current = Math.min(index, Math.max(count - 1, 0))

  const go = (next: number) => setIndex(((next % count) + count) % count)

  useEffect(() => {
    if (!keyboard || count < 2) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      // With a window open on top (product window, cart), only a carousel inside that window listens.
      const dialogs = document.querySelectorAll('[aria-modal="true"]')
      const top = dialogs[dialogs.length - 1]
      if (top && !top.contains(root.current)) return
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, count])

  useEffect(() => {
    const strip = thumbs.current
    const active = strip?.children[current] as HTMLElement | undefined
    if (strip && active) strip.scrollTo({ left: active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2, behavior: 'smooth' })
  }, [current])

  if (count === 0) {
    return (
      <div className="carousel">
        <div className="carousel-stage carousel-empty">
          <span>GL</span>
        </div>
      </div>
    )
  }

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, horizontal: null }
  }
  const onTouchMove = (e: TouchEvent) => {
    const start = touch.current
    if (!start || count < 2) return
    const t = e.touches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (start.horizontal === null && Math.abs(dx) + Math.abs(dy) > 8) start.horizontal = Math.abs(dx) > Math.abs(dy)
    if (start.horizontal) setDrag(dx)
  }
  const onTouchEnd = () => {
    if (drag <= -SWIPE_THRESHOLD) go(current + 1)
    else if (drag >= SWIPE_THRESHOLD) go(current - 1)
    setDrag(0)
    touch.current = null
  }

  const active = slides[current]
  const caption = active.type === 'image' ? active.media : null

  return (
    <div className="carousel" ref={root}>
      <div className="carousel-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <div
          className={clsx('carousel-track', drag !== 0 && 'dragging')}
          style={{ transform: `translateX(calc(${-current * 100}% + ${drag}px))` }}
        >
          {slides.map((slide, i) => (
            <div key={slide.key} className={clsx('carousel-slide', slide.type === 'image' && slide.screenshot && 'screenshot')} aria-hidden={i !== current}>
              {slide.type === 'video' ? (
                <VideoPlayer url={slide.url} title={slide.title} poster={slide.poster} active={i === current} />
              ) : (
                <img
                  src={slide.media.url}
                  alt={slide.media.altText ?? slide.media.title ?? alt}
                  loading={Math.abs(i - current) <= 1 ? 'eager' : 'lazy'}
                  draggable={false}
                  onClick={onImageClick ? () => onImageClick(slide.media) : undefined}
                  style={onImageClick ? { cursor: 'zoom-in' } : undefined}
                />
              )}
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button type="button" className="carousel-nav prev" onClick={() => go(current - 1)} aria-label="Назад">
              <ChevronLeft />
            </button>
            <button type="button" className="carousel-nav next" onClick={() => go(current + 1)} aria-label="Вперёд">
              <ChevronRight />
            </button>
            <span className="carousel-counter">
              {current + 1} / {count}
            </span>
          </>
        )}
      </div>

      {caption && (caption.title || caption.description) && (
        <div className="carousel-caption">
          {caption.title && <strong>{caption.title}</strong>}
          {caption.description && <span>{caption.description}</span>}
        </div>
      )}

      {count > 1 && (
        <div className="carousel-thumbs" ref={thumbs}>
          {slides.map((slide, i) => {
            const thumb = slideThumb(slide)
            return (
              <button
                key={slide.key}
                type="button"
                className={clsx(i === current && 'active', slide.type === 'video' && 'is-video')}
                onClick={() => setIndex(i)}
                aria-label={slide.type === 'video' ? 'Видео' : (slide.media.title ?? `${i + 1}`)}
              >
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="thumb-blank" />}
                {slide.type === 'video' && (
                  <span className="thumb-play">
                    <PlayIcon size={16} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
