import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { catalogApi, type CatalogFilters } from '@/api/endpoints'
import type { Category, Facets, FacetValue, PriceBucket } from '@/api/types'
import { ChevronDown, FilterIcon } from '@/components/Icons'
import { ProductGrid } from '@/components/ProductCard'
import { CardGiftBanner } from '@/components/Promo'
import { Select, type SelectOption } from '@/components/Select'
import { EmptyState, Pagination, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { categoryIcon } from '@/lib/categoryIcon'
import { money } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'

const PAGE_SIZE = 24
const BRANDS_COLLAPSED = 8

type Filters = CatalogFilters & { page: number; category: string[]; type: string[]; brand: string[] }

function readFilters(params: URLSearchParams): Filters {
  const num = (key: string) => {
    const v = params.get(key)
    if (v == null || v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }
  return {
    q: params.get('q')?.trim() || undefined,
    category: params.getAll('category'),
    type: params.getAll('type'),
    brand: params.getAll('brand'),
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    inStock: params.get('inStock') === 'true',
    featured: params.get('featured') === 'true',
    sort: params.get('sort') || undefined,
    page: Math.max(1, num('page') ?? 1),
  }
}

const countMap = (values: FacetValue[] | undefined) => new Map((values ?? []).map((v) => [v.slug, v.count]))

/** Categories in catalog order; when a category is picked its product types unfold right under it. */
function CategoryTree({
  categories,
  facets,
  selected,
  selectedTypes,
  onToggleCategory,
  onToggleType,
}: {
  categories: Category[]
  facets?: Facets
  selected: string[]
  selectedTypes: string[]
  onToggleCategory: (slug: string) => void
  onToggleType: (slug: string) => void
}) {
  const { t, pick } = useT()
  const categoryCounts = countMap(facets?.categories)
  const typeCounts = countMap(facets?.types)
  const countOf = (c: Category) => (facets ? categoryCounts.get(c.slug) ?? 0 : c.productCount)
  const visible = categories.filter((c) => selected.includes(c.slug) || countOf(c) > 0)

  if (!visible.length) return null
  return (
    <div className="filter-group">
      <h4>{t.categories}</h4>
      <div className="filter-list">
        {visible.map((c) => {
          const isSelected = selected.includes(c.slug)
          const types = isSelected
            ? c.types.filter((type) => selectedTypes.includes(type.slug) || (typeCounts.get(type.slug) ?? 0) > 0)
            : []
          return (
            <div key={c.slug} className={clsx('filter-node', isSelected && 'open')}>
              <label className="filter-option">
                <input type="checkbox" checked={isSelected} onChange={() => onToggleCategory(c.slug)} />
                <span className="filter-icon" aria-hidden>
                  {categoryIcon(c.icon)}
                </span>
                <span>{pick(c.nameRu, c.nameKk)}</span>
                <span className="count">{countOf(c)}</span>
              </label>
              {types.length > 0 && (
                <div className="filter-sublist" role="group" aria-label={`${t.productTypes}: ${pick(c.nameRu, c.nameKk)}`}>
                  {types.map((type) => (
                    <label key={type.slug} className="filter-option sub">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type.slug)}
                        onChange={() => onToggleType(type.slug)}
                      />
                      <span>{pick(type.nameRu, type.nameKk)}</span>
                      <span className="count">{typeCounts.get(type.slug) ?? 0}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BrandList({
  facets,
  selected,
  labelOf,
  onToggle,
}: {
  facets?: Facets
  selected: string[]
  labelOf: (slug: string) => string
  onToggle: (slug: string) => void
}) {
  const { t } = useT()
  const [expanded, setExpanded] = useState(false)
  const items = [
    ...(facets?.brands ?? []).filter((b) => b.count > 0 || selected.includes(b.slug)),
    ...selected.filter((s) => !facets?.brands.some((b) => b.slug === s)).map((slug) => ({ slug, count: 0 })),
  ].sort((a, b) => Number(selected.includes(b.slug)) - Number(selected.includes(a.slug)) || b.count - a.count)
  if (!items.length) return null
  const visible = expanded ? items : items.slice(0, BRANDS_COLLAPSED)
  return (
    <div className="filter-group">
      <h4>{t.brands}</h4>
      <div className="filter-list">
        {visible.map((f) => (
          <label key={f.slug} className={clsx('filter-option', f.count === 0 && !selected.includes(f.slug) && 'disabled')}>
            <input type="checkbox" checked={selected.includes(f.slug)} onChange={() => onToggle(f.slug)} />
            <span>{labelOf(f.slug)}</span>
            <span className="count">{f.count}</span>
          </label>
        ))}
      </div>
      {items.length > BRANDS_COLLAPSED && (
        <button type="button" className="filter-more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          <ChevronDown size={14} className={clsx(expanded && 'flip')} />
          {expanded ? t.showLess : `${t.showMore} (${items.length - BRANDS_COLLAPSED})`}
        </button>
      )}
    </div>
  )
}

function bucketLabel(b: PriceBucket, t: ReturnType<typeof useT>['t']) {
  if (b.min == null) return `${t.priceUpTo} ${money(b.max)}`
  if (b.max == null) return `${t.priceFrom} ${money(b.min)}`
  return `${money(b.min).replace(' ₸', '')} – ${money(b.max)}`
}

function PriceFilter({
  facets,
  min,
  max,
  onApply,
}: {
  facets?: Facets
  min?: number
  max?: number
  onApply: (min?: number, max?: number) => void
}) {
  const { t } = useT()
  const [from, setFrom] = useState(min?.toString() ?? '')
  const [to, setTo] = useState(max?.toString() ?? '')
  useEffect(() => {
    setFrom(min?.toString() ?? '')
    setTo(max?.toString() ?? '')
  }, [min, max])
  const apply = () => {
    const a = from ? Number(from) : undefined
    const b = to ? Number(to) : undefined
    if (a === min && b === max) return
    if (a != null && b != null && a > b) onApply(b, a)
    else onApply(a, b)
  }
  const isActive = (b: PriceBucket) => (b.min ?? undefined) === min && (b.max ?? undefined) === max
  return (
    <div className="filter-group">
      <h4>{t.price}, ₸</h4>
      {facets?.priceBuckets && (
        <div className="price-buckets">
          {facets.priceBuckets.map((b) => {
            const active = isActive(b)
            return (
              <button
                key={`${b.min}-${b.max}`}
                type="button"
                className={clsx('price-bucket', active && 'active')}
                aria-pressed={active}
                disabled={b.count === 0 && !active}
                onClick={() => (active ? onApply(undefined, undefined) : onApply(b.min ?? undefined, b.max ?? undefined))}
              >
                <span>{bucketLabel(b, t)}</span>
                <span className="count">{b.count}</span>
              </button>
            )
          })}
        </div>
      )}
      <form
        className="price-inputs"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <input className="input" inputMode="numeric" aria-label={`${t.price} ${t.from}`} placeholder={facets?.priceMin != null ? `${t.from} ${Math.floor(facets.priceMin)}` : t.from} value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} onBlur={apply} />
        <input className="input" inputMode="numeric" aria-label={`${t.price} ${t.to}`} placeholder={facets?.priceMax != null ? `${t.to} ${Math.ceil(facets.priceMax)}` : t.to} value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} onBlur={apply} />
        <button type="submit" hidden />
      </form>
    </div>
  )
}

export default function CatalogPage() {
  const { t, pick } = useT()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories, staleTime: 5 * 60_000 })
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: catalogApi.brands, staleTime: 5 * 60_000 })

  const apiFilters: CatalogFilters = { ...filters, page: filters.page - 1, size: PAGE_SIZE }
  const results = useQuery({
    queryKey: ['search', apiFilters],
    queryFn: () => catalogApi.search(apiFilters),
    placeholderData: keepPreviousData,
  })
  const facetFilters: CatalogFilters = { ...filters, page: undefined, sort: undefined }
  const facets = useQuery({
    queryKey: ['facets', facetFilters],
    queryFn: () => catalogApi.facets(facetFilters),
    placeholderData: keepPreviousData,
  })

  const categoryBySlug = (slug: string) => categories?.find((c) => c.slug === slug)
  const categoryOfType = (typeSlug: string) => categories?.find((c) => c.types.some((x) => x.slug === typeSlug))
  const typesOf = (categorySlug: string) => categoryBySlug(categorySlug)?.types.map((x) => x.slug) ?? []

  const categoryName = (slug: string) => {
    const c = categoryBySlug(slug)
    return c ? pick(c.nameRu, c.nameKk) : slug
  }
  const typeName = (slug: string) => {
    const type = categoryOfType(slug)?.types.find((x) => x.slug === slug)
    return type ? pick(type.nameRu, type.nameKk) : slug
  }
  const brandName = (slug: string) => brands?.find((x) => x.slug === slug)?.name ?? slug

  const singleCategory = filters.category.length === 1 ? categoryBySlug(filters.category[0]) : undefined
  const singleType = singleCategory && filters.type.length === 1 ? filters.type[0] : undefined
  const title = filters.q
    ? `«${filters.q}»`
    : singleType
      ? typeName(singleType)
      : singleCategory
        ? pick(singleCategory.nameRu, singleCategory.nameKk)
        : t.catalog
  const eyebrow = filters.q ? t.searchResults : singleType && singleCategory ? pick(singleCategory.nameRu, singleCategory.nameKk) : 'Greenleaf'
  useDocumentTitle(filters.q ? `${t.searchTitle}: ${filters.q}` : title)

  const update = (mutate: (next: URLSearchParams) => void, keepPage = false) => {
    const next = new URLSearchParams(params)
    mutate(next)
    if (!keepPage) next.delete('page')
    setParams(next)
  }

  const setTaxonomy = (nextCategories: string[], nextTypes: string[]) =>
    update((next) => {
      next.delete('category')
      next.delete('type')
      nextCategories.forEach((v) => next.append('category', v))
      nextTypes.forEach((v) => next.append('type', v))
    })

  const toggleCategory = (slug: string) => {
    if (filters.category.includes(slug)) {
      const dropped = typesOf(slug)
      setTaxonomy(
        filters.category.filter((v) => v !== slug),
        filters.type.filter((v) => !dropped.includes(v)),
      )
    } else {
      setTaxonomy([...filters.category, slug], filters.type)
    }
  }

  const toggleType = (slug: string) => {
    const owner = categoryOfType(slug)?.slug
    const nextTypes = filters.type.includes(slug) ? filters.type.filter((v) => v !== slug) : [...filters.type, slug]
    const nextCategories = owner && !filters.category.includes(owner) ? [...filters.category, owner] : filters.category
    setTaxonomy(nextCategories, nextTypes)
  }

  const clearTypesOf = (categorySlug: string) => {
    const dropped = typesOf(categorySlug)
    setTaxonomy(filters.category, filters.type.filter((v) => !dropped.includes(v)))
  }

  /** Category strip: one tap shows just that category, a second tap on the only active one shows everything. */
  const showOnlyCategory = (slug: string) => {
    if (filters.category.length === 1 && filters.category[0] === slug) setTaxonomy([], [])
    else setTaxonomy([slug], filters.type.filter((v) => typesOf(slug).includes(v)))
  }

  const toggleBrand = (slug: string) =>
    update((next) => {
      const values = next.getAll('brand')
      next.delete('brand')
      const updated = values.includes(slug) ? values.filter((v) => v !== slug) : [...values, slug]
      updated.forEach((v) => next.append('brand', v))
    })

  const setSingle = (key: string, value?: string) =>
    update((next) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })

  const setPrice = (min?: number, max?: number) =>
    update((next) => {
      if (min != null) next.set('minPrice', String(min))
      else next.delete('minPrice')
      if (max != null) next.set('maxPrice', String(max))
      else next.delete('maxPrice')
    })

  const resetAll = () => setParams(filters.q ? new URLSearchParams({ q: filters.q }) : new URLSearchParams())

  const priceChip = (() => {
    const { minPrice: min, maxPrice: max } = filters
    if (min != null && max != null) return `${money(min).replace(' ₸', '')} – ${money(max)}`
    if (min != null) return `${t.from} ${money(min)}`
    if (max != null) return `${t.to} ${money(max)}`
    return null
  })()

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...filters.category.map((slug) => ({ key: `c-${slug}`, label: categoryName(slug), onRemove: () => toggleCategory(slug) })),
    ...filters.type.map((slug) => ({ key: `t-${slug}`, label: typeName(slug), onRemove: () => toggleType(slug) })),
    ...filters.brand.map((slug) => ({ key: `b-${slug}`, label: brandName(slug), onRemove: () => toggleBrand(slug) })),
    ...(priceChip ? [{ key: 'price', label: priceChip, onRemove: () => setPrice() }] : []),
    ...(filters.inStock ? [{ key: 'stock', label: t.onlyInStock, onRemove: () => setSingle('inStock') }] : []),
    ...(filters.featured ? [{ key: 'featured', label: t.featured, onRemove: () => setSingle('featured') }] : []),
  ]

  const data = results.data
  const total = data?.totalItems ?? 0
  const sort = filters.sort ?? (filters.q ? 'relevance' : 'popular')
  const sortOptions: SelectOption[] = [
    ...(filters.q ? [{ value: 'relevance', label: t.sortRelevance }] : []),
    { value: 'popular', label: t.sortPopular },
    { value: 'price_asc', label: t.sortPriceAsc },
    { value: 'price_desc', label: t.sortPriceDesc },
    { value: 'newest', label: t.sortNewest },
    { value: 'name', label: t.sortName },
  ]

  const categoryCounts = countMap(facets.data?.categories)
  const typeCounts = countMap(facets.data?.types)
  const subfilterRows = (categories ?? []).filter((c) => filters.category.includes(c.slug) && c.types.length > 0)

  return (
    <>
      <div className="catalog-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            {results.isLoading ? '…' : `${t.found}: ${t.countProducts(total)}`}
          </p>
        </div>
        <CardGiftBanner />
      </div>

      {categories && (
        <div className="category-strip" role="toolbar" aria-label={t.categories}>
          <button
            type="button"
            className={clsx('chip', !filters.category.length && 'active')}
            aria-pressed={!filters.category.length}
            onClick={() => setTaxonomy([], [])}
          >
            {t.allProducts}
          </button>
          {categories.map((c) => {
            const active = filters.category.includes(c.slug)
            return (
              <button
                key={c.slug}
                type="button"
                className={clsx('chip', active && 'active')}
                aria-pressed={active}
                onClick={() => showOnlyCategory(c.slug)}
              >
                <span aria-hidden>{categoryIcon(c.icon)}</span>
                {pick(c.nameRu, c.nameKk)}
              </button>
            )
          })}
        </div>
      )}

      {subfilterRows.length > 0 && (
        <div className="type-strip">
          {subfilterRows.map((c) => {
            const chosen = c.types.filter((x) => filters.type.includes(x.slug))
            const shown = c.types.filter((x) => filters.type.includes(x.slug) || (typeCounts.get(x.slug) ?? 0) > 0)
            return (
              <div key={c.slug} className="type-row" role="toolbar" aria-label={`${t.productTypes}: ${pick(c.nameRu, c.nameKk)}`}>
                <span className="type-row-label">
                  <span aria-hidden>{categoryIcon(c.icon)}</span>
                  {subfilterRows.length > 1 ? pick(c.nameRu, c.nameKk) : t.productTypes}
                </span>
                <button
                  type="button"
                  className={clsx('type-chip', chosen.length === 0 && 'active')}
                  aria-pressed={chosen.length === 0}
                  onClick={() => clearTypesOf(c.slug)}
                >
                  {t.allInCategory}
                  <span className="count">{categoryCounts.get(c.slug) ?? c.productCount}</span>
                </button>
                {shown.map((x) => {
                  const active = filters.type.includes(x.slug)
                  return (
                    <button
                      key={x.slug}
                      type="button"
                      className={clsx('type-chip', active && 'active')}
                      aria-pressed={active}
                      onClick={() => toggleType(x.slug)}
                    >
                      {pick(x.nameRu, x.nameKk)}
                      <span className="count">{typeCounts.get(x.slug) ?? 0}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {data?.correctedQuery && (
        <div className="notice" style={{ marginBottom: 16 }}>
          {t.correctedQuery} «{data.correctedQuery}»
        </div>
      )}

      <div className="catalog-layout">
        <aside className={clsx('panel filters', filtersOpen && 'open')} aria-label={t.filters}>
          {categories && (
            <CategoryTree
              categories={categories}
              facets={facets.data}
              selected={filters.category}
              selectedTypes={filters.type}
              onToggleCategory={toggleCategory}
              onToggleType={toggleType}
            />
          )}
          <PriceFilter facets={facets.data} min={filters.minPrice} max={filters.maxPrice} onApply={setPrice} />
          <BrandList facets={facets.data} selected={filters.brand} labelOf={brandName} onToggle={toggleBrand} />
          <div className="filter-group">
            <h4>{t.availability}</h4>
            <div className="stack" style={{ gap: 10 }}>
              <label className="checkbox">
                <input type="checkbox" checked={!!filters.inStock} onChange={(e) => setSingle('inStock', e.target.checked ? 'true' : undefined)} />
                {t.onlyInStock}
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={!!filters.featured} onChange={(e) => setSingle('featured', e.target.checked ? 'true' : undefined)} />
                {t.featured}
              </label>
            </div>
          </div>
          {activeChips.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetAll}>
              {t.resetFilters}
            </button>
          )}
          <button
            type="button"
            className="btn btn-gold filters-done"
            onClick={() => {
              setFiltersOpen(false)
              document.querySelector('.catalog-layout .toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            {t.showProducts(total)}
          </button>
        </aside>

        <div>
          <div className="toolbar">
            <button
              type="button"
              className="btn btn-ghost btn-sm filters-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <FilterIcon size={16} /> {t.filters}
              {activeChips.length > 0 && <span className="badge badge-gold">{activeChips.length}</span>}
            </button>
            <div className="active-filters">
              {activeChips.map((chip) => (
                <button key={chip.key} type="button" className="chip chip-removable" onClick={chip.onRemove} aria-label={`${t.remove}: ${chip.label}`}>
                  {chip.label}
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
            <span className="spacer" />
            {results.isFetching && !results.isLoading && <Spinner />}
            <Select value={sort} options={sortOptions} onChange={(v) => setSingle('sort', v)} aria-label={t.sort} />
          </div>

          {results.isError ? (
            <div className="notice error">{t.catalogLoadFailed}</div>
          ) : data && data.items.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon="🔍"
                title={t.nothingFound}
                text={t.nothingFoundHint}
                action={
                  activeChips.length > 0 || filters.q ? (
                    <button type="button" className="btn btn-primary" onClick={() => setParams(new URLSearchParams())}>
                      {t.resetFilters}
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div style={{ opacity: results.isPlaceholderData ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <ProductGrid products={data?.items} loading={results.isLoading} />
            </div>
          )}

          {data && (
            <Pagination
              page={filters.page}
              totalPages={data.totalPages}
              onChange={(p) => {
                update((next) => (p > 1 ? next.set('page', String(p)) : next.delete('page')), true)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}
