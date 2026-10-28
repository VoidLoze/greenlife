import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { useT } from '@/i18n'
import { MuteIcon, PlayIcon, SoundIcon } from './Icons'

const REELS = ['/video/greenleaf-1.mp4', '/video/greenleaf-2.mp4']
const OFFICIAL_SITE = 'https://greenleaf-global.com/contacts/'
const WATCHDOG_MS = 2000
/** Watchdog ticks without progress before a stuck video is reloaded. */
const STALL_TICKS = 3

/**
 * Two vertical videos playing one after another in a loop, muted until the shopper turns the sound on.
 * Playback heals itself: refused autoplay resumes on the first tap anywhere, a hidden tab resumes on return,
 * and a watchdog restarts or skips a video that stalled, failed to load or never fired `ended`.
 */
export function HomeReels({ overlay }: { overlay?: ReactNode }) {
  const { t } = useT()
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const blockedRef = useRef(blocked)
  blockedRef.current = blocked
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const root = useRef<HTMLElement>(null)
  const visible = useRef(true)
  const activeRef = useRef(active)
  activeRef.current = active

  const shouldPlay = () => visible.current && document.visibilityState === 'visible'
  const current = () => videos.current[activeRef.current] ?? null
  const next = () => setActive((i) => (i + 1) % REELS.length)

  const play = (video: HTMLVideoElement | null) => {
    if (!video || !shouldPlay()) return
    video
      .play()
      .then(() => setBlocked(false))
      .catch((err: DOMException) => {
        if (err?.name !== 'NotAllowedError') return
        if (!video.muted) {
          // A browser that refuses sound without a fresh tap still plays the video muted.
          video.muted = true
          setMuted(true)
          video
            .play()
            .then(() => setBlocked(false))
            .catch(() => setBlocked(true))
          return
        }
        setBlocked(true)
      })
  }

  useEffect(() => {
    videos.current.forEach((video, i) => {
      if (!video) return
      if (i === active) {
        video.currentTime = 0
        play(video)
      } else {
        video.pause()
      }
    })
    setProgress(0)
  }, [active])

  useEffect(() => {
    videos.current.forEach((video) => {
      if (video) video.muted = muted
    })
  }, [muted])

  // Off screen the video pauses, so it does not eat battery while the shopper reads the catalog.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting
        if (entry.isIntersecting) play(current())
        else current()?.pause()
      },
      { threshold: 0.25 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const resume = () => {
      if (blockedRef.current) {
        // iOS remembers a video started inside a tap and lets it play later, so both are unlocked right away,
        // even while scrolled out of view.
        videos.current.forEach((video) => {
          video
            ?.play()
            .then(() => {
              if (video !== current() || !shouldPlay()) video.pause()
              setBlocked(false)
            })
            .catch(() => undefined)
        })
        return
      }
      const video = current()
      if (video?.paused) play(video)
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? resume() : current()?.pause())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', resume)
    window.addEventListener('focus', resume)
    // Any tap counts as the user gesture a power-saving browser waits for before it lets a video start.
    document.addEventListener('pointerdown', resume, { passive: true })
    document.addEventListener('touchend', resume, { passive: true })
    document.addEventListener('keydown', resume)

    let lastTime = -1
    let stuckTicks = 0
    const timer = window.setInterval(() => {
      const video = current()
      if (!video || !shouldPlay()) {
        stuckTicks = 0
        return
      }
      if (video.ended) {
        next()
        return
      }
      if (video.paused) {
        play(video)
        return
      }
      if (video.currentTime === lastTime) {
        stuckTicks += 1
        // A slow connection that is still downloading gets more patience than a dead one.
        const limit = video.networkState === HTMLMediaElement.NETWORK_LOADING ? STALL_TICKS * 3 : STALL_TICKS
        if (stuckTicks >= limit) {
          stuckTicks = 0
          if (video.duration && video.duration - video.currentTime < 1) {
            next()
          } else {
            const at = video.currentTime
            video.addEventListener('loadedmetadata', () => (video.currentTime = at), { once: true })
            video.load()
            play(video)
          }
        }
      } else {
        stuckTicks = 0
      }
      lastTime = video.currentTime
    }, WATCHDOG_MS)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('focus', resume)
      document.removeEventListener('pointerdown', resume)
      document.removeEventListener('touchend', resume)
      document.removeEventListener('keydown', resume)
    }
  }, [])

  const select = (i: number) => {
    if (i === active) {
      const video = videos.current[i]
      if (video) video.currentTime = 0
      play(video)
    } else {
      setActive(i)
    }
  }

  const onError = (i: number) => {
    const video = videos.current[i]
    // Give the network a moment, then retry the file; the shopper meanwhile sees the other video.
    window.setTimeout(() => video?.load(), 3000)
    if (i === activeRef.current) next()
  }

  return (
    <figure className={clsx('home-reels', overlay && 'with-overlay')} ref={root}>
      <div className="reels-stage">
        {REELS.map((src, i) => (
          <video
            key={src}
            ref={(el) => {
              videos.current[i] = el
              if (el) {
                el.defaultMuted = true
                el.muted = muted
              }
            }}
            className={clsx(i === active && 'active')}
            src={src}
            muted
            playsInline
            autoPlay={i === 0}
            preload="auto"
            disablePictureInPicture
            onEnded={() => i === activeRef.current && next()}
            onError={() => onError(i)}
            onCanPlay={() => i === activeRef.current && current()?.paused && play(current())}
            onTimeUpdate={(e) => {
              if (i === activeRef.current) setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))
            }}
          />
        ))}
        {overlay && <div className="reels-overlay">{overlay}</div>}
        {blocked && (
          <button type="button" className="video-play reels-play" onClick={() => play(current())} aria-label={t.playVideo}>
            <PlayIcon size={30} />
          </button>
        )}
        <div className="reels-bars">
          {REELS.map((src, i) => (
            <button key={src} type="button" onClick={() => select(i)} aria-label={`${i + 1} / ${REELS.length}`}>
              <span style={{ transform: `scaleX(${i < active ? 1 : i === active ? progress : 0})` }} />
            </button>
          ))}
        </div>
        <button type="button" className="reels-sound" onClick={() => setMuted((m) => !m)} aria-label={muted ? t.soundOn : t.soundOff} title={muted ? t.soundOn : t.soundOff}>
          {muted ? <MuteIcon size={20} /> : <SoundIcon size={20} />}
        </button>
      </div>
      <figcaption>
        {t.moreInfoBefore}
        <a href={OFFICIAL_SITE} target="_blank" rel="noreferrer">
          {t.moreInfoLink}
        </a>
        {t.moreInfoAfter}
      </figcaption>
    </figure>
  )
}
