export type VideoSource =
  | { type: 'youtube'; id: string; poster: string; embed: (autoplay: boolean) => string }
  | { type: 'vimeo'; id: string; embed: (autoplay: boolean) => string }
  | { type: 'file'; src: string }
  | { type: 'link'; href: string }

const YOUTUBE_ID = /^[\w-]{11}$/
const FILE_EXT = /\.(mp4|webm|mov|m4v)(\?.*)?$/i

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/)
      id = match?.[2] ?? null
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}

/** Turns a pasted link (YouTube, Vimeo, a direct file or an uploaded media URL) into something we can render. */
export function parseVideo(raw: string | null | undefined): VideoSource | null {
  const value = raw?.trim()
  if (!value) return null
  if (value.startsWith('/')) return { type: 'file', src: value }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const yt = youtubeId(url)
  if (yt) {
    const start = url.searchParams.get('t') ?? url.searchParams.get('start')
    const startSeconds = start && /^\d+s?$/.test(start) ? parseInt(start, 10) : 0
    return {
      type: 'youtube',
      id: yt,
      poster: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      embed: (autoplay) => {
        const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
        if (autoplay) params.set('autoplay', '1')
        if (startSeconds > 0) params.set('start', String(startSeconds))
        return `https://www.youtube-nocookie.com/embed/${yt}?${params}`
      },
    }
  }

  const host = url.hostname.replace(/^www\./, '')
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.match(/(\d{6,})/)?.[1]
    if (id) return { type: 'vimeo', id, embed: (autoplay) => `https://player.vimeo.com/video/${id}${autoplay ? '?autoplay=1' : ''}` }
  }

  if (FILE_EXT.test(url.pathname)) return { type: 'file', src: url.toString() }
  return { type: 'link', href: url.toString() }
}
