import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useT } from '@/i18n'
import { useFavoritesStore, useIsFavorite } from '@/store/favorites'
import { toast } from '@/store/toast'
import { HeartIcon, LinkIcon, ShareIcon, TelegramIcon, WhatsappIcon } from './Icons'

export function FavoriteButton({ productId, variant = 'icon' }: { productId: number; variant?: 'icon' | 'full' }) {
  const { t } = useT()
  const active = useIsFavorite(productId)
  const toggle = useFavoritesStore((s) => s.toggle)
  const [pop, setPop] = useState(false)

  const onClick = () => {
    const added = toggle(productId)
    setPop(added)
    toast.success(added ? t.addedToFavorites : t.removedFromFavorites)
  }

  const label = active ? t.inFavorites : t.addToFavorites
  if (variant === 'full') {
    return (
      <button type="button" className={clsx('btn btn-ghost fav-full', active && 'active', pop && 'pop')} onClick={onClick} aria-pressed={active} onAnimationEnd={() => setPop(false)}>
        <HeartIcon size={18} filled={active} /> {label}
      </button>
    )
  }
  return (
    <button type="button" className={clsx('fav-btn', active && 'active', pop && 'pop')} onClick={onClick} aria-pressed={active} aria-label={label} title={label} onAnimationEnd={() => setPop(false)}>
      <HeartIcon size={18} filled={active} />
    </button>
  )
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Plain-HTTP pages have no async clipboard API.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/** Phones get the system share sheet; desktops get WhatsApp, Telegram and «copy link». */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onClick = () => {
    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title, url }).catch(() => undefined)
      return
    }
    setOpen((v) => !v)
  }

  const copy = async () => {
    setOpen(false)
    if (await copyText(url)) toast.success(t.linkCopied)
  }

  return (
    <div className="share" ref={root}>
      <button type="button" className="btn btn-ghost" onClick={onClick} aria-expanded={open} aria-haspopup="menu">
        <ShareIcon size={18} /> {t.share}
      </button>
      {open && (
        <div className="share-menu" role="menu">
          <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            <WhatsappIcon size={18} /> WhatsApp
          </a>
          <a role="menuitem" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            <TelegramIcon size={18} /> Telegram
          </a>
          <button type="button" role="menuitem" onClick={copy}>
            <LinkIcon size={18} /> {t.copyLink}
          </button>
        </div>
      )}
    </div>
  )
}
