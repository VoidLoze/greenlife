import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useT } from '@/i18n'
import { MuteIcon, SoundIcon } from './Icons'

const REELS = ['/video/greenleaf-1.mp4', '/video/greenleaf-2.mp4']
const OFFICIAL_SITE = 'https://greenleaf-global.com/contacts/'

/** Two vertical videos playing one after another in a loop, muted until the shopper turns the sound on. */
export function HomeReels() {
  const { t } = useT()
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const root = useRef<HTMLElement>(null)
  const visible = useRef(true)
  const activeRef = useRef(active)
  activeRef.current = active

  const play = (video: HTMLVideoElement | null) => {
    if (!video || !visible.current) return
    video.play().catch(() => {
      // A browser that refuses sound without a fresh tap still plays the video muted.
      video.muted = true
      setMuted(true)
      video.play().catch(() => undefined)
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
        const video = videos.current[activeRef.current]
        if (entry.isIntersecting) play(video)
        else video?.pause()
      },
      { threshold: 0.25 },
    )
    observer.observe(el)
    return () => observer.disconnect()
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

  return (
    <figure className="home-reels" ref={root}>
      <div className="reels-stage">
        {REELS.map((src, i) => (
          <video
            key={src}
            ref={(el) => {
              videos.current[i] = el
              if (el) el.muted = muted
            }}
            className={clsx(i === active && 'active')}
            src={src}
            muted
            playsInline
            autoPlay={i === 0}
            preload={i === 0 ? 'auto' : 'metadata'}
            onEnded={() => setActive((i + 1) % REELS.length)}
            onTimeUpdate={(e) => {
              if (i === activeRef.current) setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))
            }}
          />
        ))}
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
