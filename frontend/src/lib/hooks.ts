import { useEffect, useRef, useState } from 'react'
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
