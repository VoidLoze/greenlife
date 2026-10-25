import { Fragment, useMemo } from 'react'

const WORD_SPLIT = /[^\p{L}\p{N}]+/u

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Marks the parts of `text` that match the typed words — at the start of a word, the way the search matches them —
 * so it is visible why a suggestion was offered. "шам гел" highlights «Шам»пунь and «Гел»ь.
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    const words = query
      .toLowerCase()
      .split(WORD_SPLIT)
      .filter((w) => w.length >= 1)
      .sort((a, b) => b.length - a.length)
    if (!words.length) return [text]
    // Captures the character before the match instead of a lookbehind, which Safari before 16.4 cannot parse.
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escapeRegExp).join('|')})`, 'giu')
    const out: string[] = []
    let last = 0
    for (const m of text.matchAll(pattern)) {
      const start = (m.index ?? 0) + m[1].length
      out.push(text.slice(last, start), m[2])
      last = start + m[2].length
    }
    out.push(text.slice(last))
    return out
  }, [text, query])

  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))}
    </>
  )
}
