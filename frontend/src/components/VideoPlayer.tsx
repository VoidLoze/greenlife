import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { parseVideo } from '@/lib/video'
import { PlayIcon } from './Icons'

/**
 * YouTube/Vimeo are shown as a poster until clicked, so the page does not load third-party players up front.
 * Uploaded files use the native player. `active={false}` pauses/unloads the video (e.g. when swiped away).
 */
export function VideoPlayer({
  url,
  title,
  poster,
  active = true,
  showTitle = true,
  className,
}: {
  url: string
  title?: string | null
  poster?: string | null
  active?: boolean
  showTitle?: boolean
  className?: string
}) {
  const source = useMemo(() => parseVideo(url), [url])
  const [startedUrl, setStartedUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const started = active && startedUrl === url

  useEffect(() => {
    if (!active) videoRef.current?.pause()
  }, [active])

  if (!source) return null

  if (source.type === 'file') {
    const src = source.src.includes('#') ? source.src : `${source.src}#t=0.1`
    return (
      <div className={clsx('video-frame', className)}>
        <video ref={videoRef} src={src} poster={poster ?? undefined} controls playsInline preload="metadata" title={title ?? undefined} />
      </div>
    )
  }

  if (source.type === 'link') {
    return (
      <a className={clsx('video-frame video-facade', className)} href={source.href} target="_blank" rel="noreferrer">
        {poster && <img src={poster} alt="" loading="lazy" />}
        <span className="video-play">
          <PlayIcon size={30} />
        </span>
        <span className="video-facade-title">{title ?? 'Смотреть видео'} ↗</span>
      </a>
    )
  }

  if (started) {
    return (
      <div className={clsx('video-frame', className)}>
        <iframe
          src={source.embed(true)}
          title={title ?? 'Видео'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    )
  }

  const cover = poster ?? (source.type === 'youtube' ? source.poster : null)
  return (
    <button type="button" className={clsx('video-frame video-facade', className)} onClick={() => setStartedUrl(url)} aria-label={title ? `Смотреть: ${title}` : 'Смотреть видео'}>
      {cover && <img src={cover} alt="" loading="lazy" />}
      <span className="video-play">
        <PlayIcon size={30} />
      </span>
      {title && showTitle && <span className="video-facade-title">{title}</span>}
    </button>
  )
}
