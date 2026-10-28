import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/endpoints'

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsApi.get, staleTime: 10 * 60_000 })
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} — Greenleaf`
  }, [title])
}

/** Tells search engines not to index a "not found" page that still answers 200 (the app is a single page). */
export function useNoIndex(active = true) {
  useEffect(() => {
    if (!active) return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [active])
}

/** Page-specific description for search results; the default from index.html comes back on leaving. */
export function useMetaDescription(text: string | null | undefined) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta || !text) return
    const previous = meta.content
    meta.content = text.length > 300 ? `${text.slice(0, 297)}…` : text
    return () => {
      meta.content = previous
    }
  }, [text])
}

/** Must match the phone breakpoint in store.css. */
const PHONE_QUERY = '(max-width: 760px)'
const phoneMedia = typeof window !== 'undefined' ? window.matchMedia(PHONE_QUERY) : null

/** True on phone-sized screens, where the store switches to its app-like layout. */
export function useIsPhone() {
  return useSyncExternalStore(
    (onChange) => {
      phoneMedia?.addEventListener('change', onChange)
      return () => phoneMedia?.removeEventListener('change', onChange)
    },
    () => phoneMedia?.matches ?? false,
  )
}

export const isPhone = () => phoneMedia?.matches ?? false

const REVEAL_SELECTOR = [
  '.product-card',
  '.section-head',
  '.card-promo',
  '.card-gift-banner',
  '.delivery-note.card',
  '.gift-pick',
  '.info-section',
  '.partner-card',
  '.gift-card',
  '.step',
  '.home-entry',
  '.category-tile',
  '.story',
].join(', ')
/** Windows draw their own content; sliding it in would only delay the shopper. */
const NO_REVEAL_INSIDE = '.drawer, .quickview, .modal, .lightbox'
const REVEAL_STAGGER_MS = 70
const REVEAL_MAX_STAGGER = 6

/**
 * Apple-style entrance: cards and blocks slide in from the side of the screen they sit on (wide blocks rise from
 * below) the first time they scroll into view. New content is picked up as it renders, and each element animates once.
 */
export function useRevealOnScroll() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    root.classList.add('reveal-on')
    const seen = new WeakSet<Element>()
    let batch = 0
    let batchTimer = 0

    const finish = (el: HTMLElement) => {
      delete el.dataset.reveal
      delete el.dataset.revealed
      el.style.removeProperty('--reveal-delay')
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          io.unobserve(el)
          // Cards that appear together arrive one after another, like a dealt hand.
          el.style.setProperty('--reveal-delay', `${Math.min(batch++, REVEAL_MAX_STAGGER) * REVEAL_STAGGER_MS}ms`)
          el.dataset.revealed = ''
          el.addEventListener('transitionend', (e) => e.propertyName === 'translate' && finish(el))
          window.setTimeout(() => finish(el), 1600)
        }
        window.clearTimeout(batchTimer)
        batchTimer = window.setTimeout(() => (batch = 0), 150)
      },
      // Any visible pixel counts: the hidden element is still shifted aside, so a share threshold would leave a card
      // at the edge of a rail waiting forever.
      { threshold: 0, rootMargin: '0px 0px -5% 0px' },
    )
    const prepare = (el: HTMLElement) => {
      if (seen.has(el) || el.closest(NO_REVEAL_INSIDE)) return
      seen.add(el)
      const box = el.getBoundingClientRect()
      const width = window.innerWidth
      el.dataset.reveal = box.width > width * 0.66 ? 'up' : box.left + box.width / 2 < width / 2 ? 'left' : 'right'
      io.observe(el)
    }
    const scan = (node: Element | Document) => node.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(prepare)
    scan(document)
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.matches(REVEAL_SELECTOR)) prepare(node)
          scan(node)
        })
      }
    })
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mutations.disconnect()
      window.clearTimeout(batchTimer)
      root.classList.remove('reveal-on')
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(finish)
    }
  }, [])
}

let scrollLocks = 0

/**
 * Locks page scroll while a drawer or modal is open. Locks are counted: windows open and close in any order (the
 * product window closes while the cart opens), and the page scrolls again only when the last one is gone.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    scrollLocks++
    document.body.style.overflow = 'hidden'
    return () => {
      scrollLocks = Math.max(0, scrollLocks - 1)
      if (scrollLocks === 0) document.body.style.overflow = ''
    }
  }, [locked])
}
