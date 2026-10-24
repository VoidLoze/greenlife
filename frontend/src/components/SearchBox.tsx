import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { catalogApi } from '@/api/endpoints'
import type { TypeRef } from '@/api/types'
import { useT } from '@/i18n'
import { money, pluralRu } from '@/lib/format'
import { useClickOutside, useDebounced } from '@/lib/hooks'
import { Highlight } from './Highlight'
import { ChevronRight, CloseIcon, SearchIcon } from './Icons'

/** Short enough to feel instant while typing, long enough not to fire a request for every key of a fast typist. */
const DEBOUNCE_MS = 120

type Option =
  | { type: 'product'; key: string; slug: string }
  | { type: 'productType'; key: string; ref: TypeRef }
  | { type: 'category'; key: string; slug: string }
  | { type: 'brand'; key: string; slug: string }
  | { type: 'query'; key: string; query: string }
  | { type: 'all'; key: string }

export function SearchBox() {
  const { t, pick } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const listId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(() => (location.pathname === '/catalog' ? params.get('q') ?? '' : ''))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typed = value.trim().replace(/\s+/g, ' ')
  const debounced = useDebounced(typed, DEBOUNCE_MS)

  useEffect(() => {
    if (location.pathname === '/catalog') setValue(params.get('q') ?? '')
  }, [location.pathname, params])

  const close = useCallback(() => {
    setOpen(false)
    setActive(-1)
  }, [])
  const ref = useClickOutside<HTMLDivElement>(close)

  const suggest = useQuery({
    queryKey: ['suggest', debounced.toLowerCase()],
    queryFn: () => catalogApi.suggest(debounced),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: catalogApi.categories,
    staleTime: 5 * 60_000,
    enabled: open,
  })
  const data = suggest.data
  /** Results on screen may still belong to the previous text while the next request is in flight. */
  const pending = typed !== debounced || suggest.isFetching
  const highlightQuery = data?.correctedQuery ?? typed
  const categoryName = (slug: string) => {
    const c = categories?.find((x) => x.slug === slug)
    return c ? pick(c.nameRu, c.nameKk) : ''
  }

  const options = useMemo<Option[]>(() => {
    if (!data) return []
    // Same order as on screen, so the arrow keys walk the dropdown top to bottom.
    return [
      ...data.types.map((ref) => ({ type: 'productType' as const, key: `t-${ref.slug}`, ref })),
      ...data.categories.map((c) => ({ type: 'category' as const, key: `c-${c.slug}`, slug: c.slug })),
      ...data.brands.map((b) => ({ type: 'brand' as const, key: `b-${b.slug}`, slug: b.slug })),
      ...data.products.map((p) => ({ type: 'product' as const, key: `p-${p.slug}`, slug: p.slug })),
      ...(data.total > data.products.length ? [{ type: 'all' as const, key: 'all' }] : []),
      ...data.popularQueries.map((q) => ({ type: 'query' as const, key: `q-${q}`, query: q })),
    ]
  }, [data])

  useEffect(() => setActive(-1), [data])

  useEffect(() => {
    if (active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const go = (option: Option | null) => {
    close()
    if (!option || option.type === 'all') {
      const q = data?.correctedQuery ?? typed
      navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog')
      return
    }
    switch (option.type) {
      case 'product':
        navigate(`/product/${option.slug}`)
        break
      case 'productType':
        navigate(`/catalog?category=${option.ref.categorySlug}&type=${option.ref.slug}`)
        break
      case 'category':
        navigate(`/catalog?category=${option.slug}`)
        break
      case 'brand':
        navigate(`/catalog?brand=${option.slug}`)
        break
      case 'query':
        setValue(option.query)
        navigate(`/catalog?q=${encodeURIComponent(option.query)}`)
        break
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (options.length ? (i + 1) % options.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(active >= 0 ? options[active] ?? null : null)
    } else if (e.key === 'Escape') {
      if (open) close()
      else setValue('')
    }
  }

  const indexOf = (key: string) => options.findIndex((o) => o.key === key)
  const optionProps = (key: string) => {
    const idx = indexOf(key)
    return {
      id: `${listId}-${idx}`,
      role: 'option',
      'aria-selected': idx === active,
      'data-index': idx,
      onMouseEnter: () => setActive(idx),
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onClick: () => go(options[idx]),
    }
  }

  const nothing = !!data && typed.length > 0 && data.total === 0 && !data.types.length && !data.categories.length && !data.brands.length
  const showDropdown = open && !!data && (typed.length > 0 || data.popularQueries.length > 0)

  return (
    <div className="search" ref={ref}>
      <form
        className="search-box"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          go(active >= 0 ? options[active] ?? null : null)
        }}
      >
        <SearchIcon size={18} />
        <input
          type="search"
          value={value}
          placeholder={t.searchPlaceholder}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label={t.search}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          maxLength={60}
        />
        {open && pending && typed && <span className="search-spinner" aria-hidden />}
        {value && (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              setValue('')
              setOpen(true)
            }}
            aria-label="Очистить"
          >
            <CloseIcon size={16} />
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-sm">
          {t.search}
        </button>
      </form>

      {showDropdown && (
        <div className={clsx('search-dropdown', pending && 'pending')} id={listId} role="listbox" ref={listRef} aria-label={t.search}>
          {typed ? (
            <div className="search-status" aria-live="polite">
              {pending ? (
                t.searching
              ) : nothing ? (
                <>
                  {t.nothingFound}: «{typed}»
                </>
              ) : (
                <>
                  {t.found}: <b>{data.total}</b> {pluralRu(data.total, 'товар', 'товара', 'товаров')}
                </>
              )}
              {typed.length === 1 && !pending && <span className="search-tip">{t.keepTyping}</span>}
            </div>
          ) : (
            <div className="search-status">{t.searchHintEmpty}</div>
          )}

          {data.correctedQuery && (
            <div className="notice" style={{ margin: '0 6px 8px' }}>
              {t.correctedQuery}: «{data.correctedQuery}»
            </div>
          )}

          {data.types.length > 0 && (
            <div className="search-section">
              <h4>{t.searchTypes}</h4>
              <div className="search-chips">
                {data.types.map((type) => {
                  const props = optionProps(`t-${type.slug}`)
                  const owner = categoryName(type.categorySlug)
                  return (
                    <div key={type.slug} className={clsx('chip search-chip', props['aria-selected'] && 'active')} {...props}>
                      <span><Highlight text={pick(type.nameRu, type.nameKk)} query={highlightQuery} /></span>
                      {owner && <span className="chip-context">{owner}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(data.categories.length > 0 || data.brands.length > 0) && (
            <div className="search-section">
              <h4>
                {data.categories.length > 0 && t.categories}
                {data.categories.length > 0 && data.brands.length > 0 && ' · '}
                {data.brands.length > 0 && t.brands}
              </h4>
              <div className="search-chips">
                {data.categories.map((c) => {
                  const props = optionProps(`c-${c.slug}`)
                  return (
                    <div key={c.slug} className={clsx('chip search-chip', props['aria-selected'] && 'active')} {...props}>
                      <span><Highlight text={pick(c.nameRu, c.nameKk)} query={highlightQuery} /></span>
                    </div>
                  )
                })}
                {data.brands.map((b) => {
                  const props = optionProps(`b-${b.slug}`)
                  return (
                    <div key={b.slug} className={clsx('chip search-chip', props['aria-selected'] && 'active')} {...props}>
                      <span><Highlight text={b.name} query={highlightQuery} /></span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {data.products.length > 0 && (
            <div className="search-section">
              <h4>{t.products}</h4>
              {data.products.map((p) => {
                const props = optionProps(`p-${p.slug}`)
                const meta = [p.brand, p.volume, pick(p.categoryNameRu, p.categoryNameKk)].filter(Boolean).join(' · ')
                return (
                  <div key={p.slug} className={clsx('search-item', props['aria-selected'] && 'active')} {...props}>
                    {p.thumbUrl ? <img src={p.thumbUrl} alt="" loading="lazy" /> : <span className="thumb-ph" />}
                    <span className="search-item-body">
                      <span className="name">
                        <Highlight text={pick(p.nameRu, p.nameKk)} query={highlightQuery} />
                      </span>
                      {meta && <span className="meta">{meta}</span>}
                    </span>
                    {p.price != null && (
                      <span className="search-prices">
                        <span className="retail">{money(p.price)}</span>
                        {p.partnerPrice != null && p.partnerPrice < p.price && (
                          <span className="partner" title={t.partnerPrice}>
                            {money(p.partnerPrice)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {data.total > data.products.length && (() => {
            const props = optionProps('all')
            return (
              <div className={clsx('search-all', props['aria-selected'] && 'active')} {...props}>
                {t.showAllResults} {data.total} {pluralRu(data.total, 'товар', 'товара', 'товаров')}
                <ChevronRight size={16} />
              </div>
            )
          })()}

          {data.popularQueries.length > 0 && (
            <div className="search-section">
              <h4>{t.popularQueries}</h4>
              <div className="search-chips">
                {data.popularQueries.map((q) => {
                  const props = optionProps(`q-${q}`)
                  return (
                    <div key={q} className={clsx('chip search-chip', props['aria-selected'] && 'active')} {...props}>
                      <SearchIcon size={12} aria-hidden /> {q}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
