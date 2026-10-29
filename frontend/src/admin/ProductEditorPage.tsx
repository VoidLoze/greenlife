import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { adminApi, type AdminProduct, type ParsedDescription, type ProductUpsert } from '@/api/admin'
import { errorMessage, problemOf } from '@/api/client'
import type { ApiProblem, ProductStatus } from '@/api/types'
import { Autocomplete, Select } from '@/components/Select'
import { EmptyState, Field, Modal, PageLoader, Spinner } from '@/components/ui'
import { VideoPlayer } from '@/components/VideoPlayer'
import { categoryIcon } from '@/lib/categoryIcon'
import { parseVideo } from '@/lib/video'
import { dateTime, money } from '@/lib/format'
import { useDocumentTitle, useSettings } from '@/lib/hooks'
import { toast } from '@/store/toast'
import { CardPreview, EditorSteps, publishBlockers, PublishChecklist, StepNav, type GuideInput, type Tab } from './EditorGuide'
import { MediaManager } from './MediaManager'
import { AdminHead, moneyOrNull, nullIfBlank, numberOrNull, productStatusBadge, productStatusLabel, ScoreRing } from './shared'

interface FormState {
  nameRu: string
  nameKk: string
  sku: string
  slug: string
  categoryId: string
  typeId: string
  brand: string
  price: string
  partnerPrice: string
  oldPrice: string
  trackStock: boolean
  stockQuantity: string
  volume: string
  badge: string
  featured: boolean
  status: ProductStatus
  catalogPage: string
  videoUrl: string
  searchKeywords: string
  summaryRu: string
  summaryKk: string
  descriptionRu: string
  descriptionKk: string
  usageRu: string
  usageKk: string
  composition: string
  warningsRu: string
  warningsKk: string
  benefits: { textRu: string; textKk: string }[]
  attributes: { nameRu: string; valueRu: string; nameKk: string; valueKk: string }[]
}

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v))

function emptyForm(): FormState {
  return {
    nameRu: '', nameKk: '', sku: '', slug: '', categoryId: '', typeId: '', brand: '',
    price: '', partnerPrice: '', oldPrice: '', trackStock: false, stockQuantity: '', volume: '', badge: '',
    featured: false, status: 'DRAFT', catalogPage: '', videoUrl: '', searchKeywords: '',
    summaryRu: '', summaryKk: '', descriptionRu: '', descriptionKk: '', usageRu: '', usageKk: '',
    composition: '', warningsRu: '', warningsKk: '', benefits: [], attributes: [],
  }
}

function fromProduct(p: AdminProduct): FormState {
  return {
    nameRu: p.nameRu, nameKk: str(p.nameKk), sku: p.sku, slug: p.slug,
    categoryId: str(p.category?.id), typeId: str(p.type?.id), brand: p.brand?.name ?? '',
    price: str(p.price), partnerPrice: str(p.partnerPrice), oldPrice: str(p.oldPrice),
    trackStock: p.stockQuantity != null, stockQuantity: str(p.stockQuantity), volume: str(p.volume), badge: str(p.badge),
    featured: p.featured, status: p.status, catalogPage: str(p.catalogPage), videoUrl: str(p.videoUrl), searchKeywords: str(p.searchKeywords),
    summaryRu: str(p.summaryRu), summaryKk: str(p.summaryKk), descriptionRu: str(p.descriptionRu), descriptionKk: str(p.descriptionKk),
    usageRu: str(p.usageRu), usageKk: str(p.usageKk), composition: str(p.composition),
    warningsRu: str(p.warningsRu), warningsKk: str(p.warningsKk),
    benefits: p.benefits.map((b) => ({ textRu: b.textRu, textKk: str(b.textKk) })),
    attributes: p.attributes.map((a) => ({ nameRu: a.nameRu, valueRu: a.valueRu, nameKk: str(a.nameKk), valueKk: str(a.valueKk) })),
  }
}

/** Which editor step shows each server-side field, so an error on a hidden step can point there. */
const FIELD_TAB: Record<string, Tab> = {
  summaryRu: 'description', summaryKk: 'description', descriptionRu: 'description', descriptionKk: 'description',
  usageRu: 'description', usageKk: 'description', composition: 'description', warningsRu: 'description', warningsKk: 'description',
  searchKeywords: 'specs', catalogPage: 'specs', videoUrl: 'media',
}
const tabOfField = (field: string): Tab =>
  FIELD_TAB[field] ?? (field.startsWith('benefits') || field.startsWith('attributes') ? 'specs' : 'main')
const TAB_LABEL: Record<Tab, string> = { main: 'Основное', description: 'Описание', specs: 'Характеристики', media: 'Фото и видео' }

function toUpsert(f: FormState, brands: { id: number; name: string }[], version?: number, stockBase?: number | null): ProductUpsert {
  const brandName = f.brand.trim()
  const brand = brandName ? brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase()) : undefined
  const stock = f.trackStock ? (numberOrNull(f.stockQuantity) ?? 0) : null
  const page = numberOrNull(f.catalogPage)
  return {
    nameRu: f.nameRu.trim(),
    nameKk: nullIfBlank(f.nameKk),
    sku: nullIfBlank(f.sku),
    slug: nullIfBlank(f.slug),
    categoryId: f.categoryId ? Number(f.categoryId) : null,
    typeId: f.categoryId && f.typeId ? Number(f.typeId) : null,
    brandId: brand?.id ?? null,
    brandName: brand ? null : nullIfBlank(brandName),
    price: moneyOrNull(f.price),
    partnerPrice: moneyOrNull(f.partnerPrice),
    oldPrice: moneyOrNull(f.oldPrice),
    stockQuantity: stock == null ? null : Math.floor(stock),
    stockBase: stockBase ?? null,
    volume: nullIfBlank(f.volume),
    badge: nullIfBlank(f.badge),
    featured: f.featured,
    status: f.status,
    catalogPage: page == null ? null : Math.floor(page),
    videoUrl: nullIfBlank(f.videoUrl),
    searchKeywords: nullIfBlank(f.searchKeywords),
    summaryRu: nullIfBlank(f.summaryRu),
    summaryKk: nullIfBlank(f.summaryKk),
    descriptionRu: nullIfBlank(f.descriptionRu),
    descriptionKk: nullIfBlank(f.descriptionKk),
    usageRu: nullIfBlank(f.usageRu),
    usageKk: nullIfBlank(f.usageKk),
    composition: nullIfBlank(f.composition),
    warningsRu: nullIfBlank(f.warningsRu),
    warningsKk: nullIfBlank(f.warningsKk),
    benefits: f.benefits.filter((b) => b.textRu.trim()).map((b) => ({ textRu: b.textRu.trim(), textKk: nullIfBlank(b.textKk) })),
    attributes: f.attributes
      .filter((a) => a.nameRu.trim() && a.valueRu.trim())
      .map((a) => ({ nameRu: a.nameRu.trim(), valueRu: a.valueRu.trim(), nameKk: nullIfBlank(a.nameKk), valueKk: nullIfBlank(a.valueKk) })),
    version,
  }
}

type ParsedKey = 'summary' | 'benefits' | 'usage' | 'composition' | 'warnings' | 'attributes' | 'volume'

function ParseModal({ parsed, onApply, onClose }: { parsed: ParsedDescription; onApply: (keys: ParsedKey[]) => void; onClose: () => void }) {
  const available = useMemo(() => {
    const list: { key: ParsedKey; label: string; preview: string }[] = []
    if (parsed.summary) list.push({ key: 'summary', label: 'Краткое описание', preview: parsed.summary })
    if (parsed.benefits.length) list.push({ key: 'benefits', label: `Преимущества (${parsed.benefits.length})`, preview: parsed.benefits.map((b) => `• ${b}`).join('\n') })
    if (parsed.usage) list.push({ key: 'usage', label: 'Применение', preview: parsed.usage })
    if (parsed.composition) list.push({ key: 'composition', label: 'Состав', preview: parsed.composition })
    if (parsed.warnings) list.push({ key: 'warnings', label: 'Меры предосторожности', preview: parsed.warnings })
    if (parsed.attributes.length) list.push({ key: 'attributes', label: `Характеристики (${parsed.attributes.length})`, preview: parsed.attributes.map((a) => `${a.nameRu}: ${a.valueRu}`).join('\n') })
    if (parsed.volume) list.push({ key: 'volume', label: 'Объём', preview: parsed.volume })
    return list
  }, [parsed])
  const [selected, setSelected] = useState<ParsedKey[]>(available.map((a) => a.key))

  return (
    <Modal open wide title="Разбор описания" onClose={onClose}>
      {available.length === 0 ? (
        <p className="muted">Не удалось выделить структуру — попробуйте разбить текст на предложения.</p>
      ) : (
        <div className="stack">
          <p className="muted small">Отметьте, что перенести в карточку. Существующие значения в выбранных полях будут заменены.</p>
          {available.map((item) => (
            <label key={item.key} className="panel" style={{ padding: 14, display: 'grid', gap: 6, cursor: 'pointer' }}>
              <span className="checkbox">
                <input type="checkbox" checked={selected.includes(item.key)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, item.key] : s.filter((k) => k !== item.key)))} />
                <strong>{item.label}</strong>
              </span>
              <span className="muted small" style={{ whiteSpace: 'pre-line' }}>
                {item.preview}
              </span>
            </label>
          ))}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={!selected.length} onClick={() => onApply(selected)}>
              Применить ({selected.length})
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const Req = () => (
  <b className="req" title="Обязательное поле">
    *
  </b>
)

function LangPair({ label, ru, kk, onRu, onKk, multiline, rows, maxRu, hint, required, error }: {
  label: string
  ru: string
  kk: string
  onRu: (v: string) => void
  onKk: (v: string) => void
  multiline?: boolean
  rows?: number
  maxRu?: number
  hint?: string
  required?: boolean
  error?: string
}) {
  const Control = multiline ? 'textarea' : 'input'
  return (
    <div className="lang-pair">
      <Field
        label={
          <>
            {label} · RU {required && <Req />}
          </>
        }
        error={error}
        hint={hint ?? (maxRu ? `${ru.length} / ${maxRu}` : undefined)}
      >
        <Control className={clsx(multiline ? 'textarea' : 'input', error && 'invalid')} value={ru} rows={rows} maxLength={maxRu} onChange={(e) => onRu(e.target.value)} />
      </Field>
      <Field label={`${label} · KZ (необязательно)`}>
        <Control className={multiline ? 'textarea' : 'input'} value={kk} rows={rows} maxLength={maxRu} onChange={(e) => onKk(e.target.value)} />
      </Field>
    </div>
  )
}

export default function ProductEditorPage() {
  const { id: idParam } = useParams()
  const productId = idParam ? Number(idParam) : null
  const isNew = productId == null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'main'
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); return p }, { replace: true })
  const { data: settings } = useSettings()

  const productQuery = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => adminApi.product(productId!),
    enabled: !isNew,
    staleTime: Infinity,
  })
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories })
  const brands = useQuery({ queryKey: ['admin', 'brands'], queryFn: adminApi.brands })

  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [initial, setInitial] = useState<FormState>(emptyForm)
  const [problem, setProblem] = useState<ApiProblem | null>(null)
  const [parsed, setParsed] = useState<ParsedDescription | null>(null)

  /** Replaces the form with the product as saved. Media changes only refresh `product`, never the form being edited. */
  const load = useCallback((p: AdminProduct) => {
    setProduct(p)
    const f = fromProduct(p)
    setForm(f)
    setInitial(f)
  }, [])

  const loadedOnce = useRef(false)
  useEffect(() => {
    if (productQuery.data && !loadedOnce.current) {
      loadedOnce.current = true
      load(productQuery.data)
    }
  }, [productQuery.data, load])

  useDocumentTitle(isNew ? 'Новый товар' : product?.nameRu)

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Navigations the editor starts itself (after create/delete) must not ask about changes that were just saved.
  const allowLeave = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const selectedCategory = categories.data?.find((c) => String(c.id) === form.categoryId)

  const adopt = useCallback(
    (p: AdminProduct) => {
      setProduct(p)
      queryClient.setQueryData(['admin', 'product', p.id], p)
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
    [queryClient],
  )

  const save = useMutation({
    mutationFn: (override?: Partial<FormState>) => {
      const stockBase = initial.trackStock ? (numberOrNull(initial.stockQuantity) ?? 0) : null
      const body = toUpsert({ ...form, ...override }, brands.data ?? [], product?.version, isNew ? null : stockBase)
      return isNew ? adminApi.createProduct(body) : adminApi.updateProduct(productId!, body)
    },
    onSuccess: (p) => {
      setProblem(null)
      adopt(p)
      const f = fromProduct(p)
      setForm(f)
      setInitial(f)
      queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] })
      if (isNew) {
        toast.success('Товар создан. Теперь добавьте фото, видео и документы.')
        allowLeave.current = true
        navigate(`/admin/products/${p.id}?tab=media`, { replace: true })
      } else {
        toast.success('Сохранено')
      }
    },
    onError: (e) => {
      const pr = problemOf(e)
      setProblem(pr)
      const fields = Object.keys(pr.errors ?? {})
      if (fields.length && !fields.some((f) => tabOfField(f) === tab)) setTab(tabOfField(fields[0]))
      if (pr.code !== 'stale_data' && pr.code !== 'not_ready_to_publish') toast.error(pr.detail)
    },
  })

  const reloadMedia = useCallback(async () => {
    if (!productId) return
    const fresh = await adminApi.product(productId)
    adopt(fresh)
    setInitial((i) => ({ ...i, status: fresh.status }))
    setForm((f) => (f.status === initial.status ? { ...f, status: fresh.status } : f))
  }, [productId, adopt, initial.status])

  const parse = useMutation({
    mutationFn: () => adminApi.parseDescription(form.descriptionRu, form.nameRu || undefined),
    onSuccess: setParsed,
    onError: (e) => toast.error(errorMessage(e)),
  })

  const applyParsed = (keys: ParsedKey[]) => {
    if (!parsed) return
    setForm((f) => ({
      ...f,
      ...(keys.includes('summary') && parsed.summary ? { summaryRu: parsed.summary.slice(0, 600) } : {}),
      ...(keys.includes('benefits') ? { benefits: parsed.benefits.slice(0, 20).map((b) => ({ textRu: b.slice(0, 500), textKk: '' })) } : {}),
      ...(keys.includes('usage') && parsed.usage ? { usageRu: parsed.usage } : {}),
      ...(keys.includes('composition') && parsed.composition ? { composition: parsed.composition } : {}),
      ...(keys.includes('warnings') && parsed.warnings ? { warningsRu: parsed.warnings } : {}),
      ...(keys.includes('attributes')
        ? { attributes: parsed.attributes.slice(0, 40).map((a) => ({ nameRu: a.nameRu, valueRu: a.valueRu, nameKk: a.nameKk ?? '', valueKk: a.valueKk ?? '' })) }
        : {}),
      ...(keys.includes('volume') && parsed.volume ? { volume: parsed.volume } : {}),
    }))
    setParsed(null)
    toast.info('Поля заполнены — проверьте и сохраните')
  }

  const remove = useMutation({
    mutationFn: () => adminApi.deleteProduct(productId!),
    onSuccess: async (res) => {
      toast.info(res.message)
      if (res.archived) {
        const fresh = await productQuery.refetch()
        if (fresh.data) load(fresh.data)
      } else {
        allowLeave.current = true
        queryClient.removeQueries({ queryKey: ['admin', 'product', productId] })
        navigate('/admin/products', { replace: true })
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const duplicate = useMutation({
    mutationKey: ['duplicate', productId],
    mutationFn: () => adminApi.duplicate(productId!),
    onSuccess: (p) => {
      toast.success('Создана копия (черновик)')
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      navigate(`/admin/products/${p.id}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!isNew && productQuery.isLoading) return <PageLoader />
  if (!isNew && productQuery.isError) {
    return <EmptyState icon="⚠" title="Товар не найден" text={errorMessage(productQuery.error)} action={<Link to="/admin/products" className="btn btn-primary">К списку</Link>} />
  }

  const fieldError = (key: string) => problem?.errors?.[key]
  const autoPartner = (() => {
    const price = moneyOrNull(form.price)
    if (price == null || !settings?.partnerDiscountPercent) return null
    return Math.round(price * (1 - settings.partnerDiscountPercent / 100))
  })()
  const videoPreview = parseVideo(form.videoUrl)
  const guide: GuideInput = {
    name: form.nameRu,
    categoryId: form.categoryId,
    price: moneyOrNull(form.price),
    oldPrice: moneyOrNull(form.oldPrice),
    partnerPrice: moneyOrNull(form.partnerPrice),
    summary: form.summaryRu,
    description: form.descriptionRu,
    benefits: form.benefits.filter((b) => b.textRu.trim()).length,
    volume: form.volume,
    badge: form.badge,
    product,
  }
  const blockers = publishBlockers(guide)
  const canPublish = blockers.every((b) => b.ok)
  const moneyError = (raw: string) => {
    if (!raw.trim()) return undefined
    const n = moneyOrNull(raw)
    if (n == null || n <= 0) return 'Введите сумму больше нуля, например 12 500'
    return Number.isInteger(n) ? undefined : 'Только целые тенге, без копеек'
  }
  const priceError = moneyError(form.price)
  const partnerPriceError = moneyError(form.partnerPrice)
  const oldPriceError =
    moneyError(form.oldPrice) ??
    (guide.oldPrice != null && guide.price != null && guide.oldPrice <= guide.price ? 'Должна быть выше розничной — иначе скидка не покажется' : undefined)
  const submit = () => {
    if (!form.nameRu.trim()) {
      setTab('main')
      setProblem({ ...(problem ?? {}), errors: { nameRu: 'Укажите название — это единственное обязательное поле для черновика' } } as ApiProblem)
      toast.error('Укажите название товара')
      return
    }
    if (priceError || partnerPriceError || oldPriceError) {
      setTab('main')
      toast.error('Проверьте цены на шаге «Основное»')
      return
    }
    if (form.status === 'PUBLISHED' && !canPublish) {
      toast.error('Товар пока нельзя опубликовать — смотрите список «Для публикации нужно» справа')
      return
    }
    save.mutate(undefined)
  }

  return (
    <>
      <AdminHead
        eyebrow={isNew ? 'Новый товар' : `${product?.sku} · обновлён ${dateTime(product?.updatedAt)}`}
        title={form.nameRu || (isNew ? 'Новый товар' : 'Без названия')}
      >
        {product && <span className={`badge ${productStatusBadge[product.status]}`}>{productStatusLabel[product.status]}</span>}
        {product?.status === 'PUBLISHED' && (
          <a className="btn btn-ghost btn-sm" href={`/product/${product.slug}`} target="_blank" rel="noreferrer">
            Открыть на сайте ↗
          </a>
        )}
        <Link to="/admin/products" className="btn btn-ghost btn-sm">
          ← К списку
        </Link>
      </AdminHead>

      {problem?.code === 'stale_data' && (
        <div className="notice error" style={{ marginBottom: 14, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{problem.detail}</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={async () => {
              setProblem(null)
              const fresh = await productQuery.refetch()
              if (fresh.data) load(fresh.data)
            }}
          >
            Загрузить свежую версию
          </button>
        </div>
      )}
      {problem?.errors && Object.keys(problem.errors).some((f) => tabOfField(f) !== tab) && (
        <div className="notice error" style={{ marginBottom: 14, flexDirection: 'column', alignItems: 'flex-start' }}>
          <strong>Исправьте ошибки на других шагах:</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {Object.entries(problem.errors)
              .filter(([f]) => tabOfField(f) !== tab)
              .map(([f, message]) => (
                <li key={f}>
                  <button type="button" className="link-btn" onClick={() => setTab(tabOfField(f))}>
                    {TAB_LABEL[tabOfField(f)]}
                  </button>
                  : {message}
                </li>
              ))}
          </ul>
        </div>
      )}
      {problem?.code === 'not_ready_to_publish' && (
        <div className="notice error" style={{ marginBottom: 14, flexDirection: 'column' }}>
          <strong>{problem.detail}</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {problem.details?.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      )}

      <div className="editor-layout">
        <div className="stack" style={{ gap: 16 }}>
          <EditorSteps input={guide} tab={tab} onTab={setTab} />
          {isNew && tab === 'main' && (
            <div className="editor-intro">
              <strong>Как добавить товар</strong>
              <span>
                Заполните поля со звёздочкой <Req /> и нажмите «Создать товар» — он сохранится черновиком и сразу откроется шаг загрузки
                фото. Описание и характеристики можно дописать позже. Покупатели увидят товар только после публикации.
              </span>
            </div>
          )}

          {tab === 'main' && (
            <>
              <section className="panel editor-section">
                <h3>Название и идентификаторы</h3>
                <LangPair label="Название" required error={fieldError('nameRu')} ru={form.nameRu} kk={form.nameKk} onRu={(v) => { set('nameRu', v); if (fieldError('nameRu')) setProblem(null) }} onKk={(v) => set('nameKk', v)} maxRu={255} />
                <div className="grid-2">
                  <Field label="Артикул (SKU)" error={fieldError('sku')} hint={isNew ? 'Оставьте пустым — сгенерируется автоматически' : undefined}>
                    <input className="input" value={form.sku} maxLength={40} onChange={(e) => set('sku', e.target.value.replace(/[^A-Za-z0-9._-]/g, ''))} placeholder="GL-1001" />
                  </Field>
                  <Field label="Адрес страницы (slug)" error={fieldError('slug')} hint="Пусто — создастся из названия">
                    <input className="input" value={form.slug} maxLength={200} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
                  </Field>
                </div>
              </section>

              <section className="panel editor-section">
                <h3>Категория, тип и бренд</h3>
                <div className="grid-3">
                  <Field label={<>Категория <Req /></>} hint="Нужна для публикации">
                    <Select
                      value={form.categoryId}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          categoryId: v,
                          typeId: categories.data?.find((c) => String(c.id) === v)?.types.some((t) => String(t.id) === f.typeId) ? f.typeId : '',
                        }))
                      }
                      options={[
                        { value: '', label: '— не выбрана —' },
                        ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: `${categoryIcon(c.icon)} ${c.nameRu}`, text: c.nameRu })),
                      ]}
                    />
                  </Field>
                  <Field
                    label="Тип товара"
                    hint={
                      !form.categoryId
                        ? 'Сначала выберите категорию'
                        : selectedCategory?.types.length
                          ? 'Подкатегория — по ней покупатели фильтруют каталог'
                          : 'У категории пока нет типов — добавьте их в «Категории»'
                    }
                  >
                    <Select
                      value={form.typeId}
                      disabled={!selectedCategory?.types.length}
                      onChange={(v) => set('typeId', v)}
                      options={[
                        { value: '', label: '— без типа —' },
                        ...(selectedCategory?.types ?? []).map((t) => ({ value: String(t.id), label: t.nameRu, hint: `${t.productCount} товаров` })),
                      ]}
                    />
                  </Field>
                  <Field
                    label="Бренд"
                    hint={
                      form.brand.trim() && !brands.data?.some((b) => b.name.toLowerCase() === form.brand.trim().toLowerCase())
                        ? `Будет создан новый бренд «${form.brand.trim()}»`
                        : 'Выберите из списка или впишите новый'
                    }
                  >
                    <Autocomplete value={form.brand} maxLength={120} onChange={(v) => set('brand', v)} suggestions={brands.data?.map((b) => b.name) ?? []} />
                  </Field>
                </div>
              </section>

              <section className="panel editor-section">
                <h3>Цены и склад</h3>
                <div className="grid-3">
                  <Field label={<>Розничная цена, ₸ <Req /></>} error={fieldError('price') ?? priceError} hint="Нужна для публикации">
                    <input className="input" inputMode="numeric" value={form.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.,\s]/g, ''))} />
                  </Field>
                  <Field label="Партнёрская цена, ₸" error={fieldError('partnerPrice') ?? partnerPriceError} hint={autoPartner != null ? `Пусто — авто: ${money(autoPartner)} (−${settings?.partnerDiscountPercent}%)` : undefined}>
                    <input className="input" inputMode="numeric" value={form.partnerPrice} placeholder={autoPartner != null ? String(autoPartner) : ''} onChange={(e) => set('partnerPrice', e.target.value.replace(/[^\d.,\s]/g, ''))} />
                  </Field>
                  <Field label="Старая цена (зачёркнутая), ₸" error={fieldError('oldPrice') ?? oldPriceError} hint="Необязательно. Должна быть выше розничной">
                    <input className={clsx('input', oldPriceError && 'invalid')} inputMode="numeric" value={form.oldPrice} onChange={(e) => set('oldPrice', e.target.value.replace(/[^\d.,\s]/g, ''))} />
                  </Field>
                  <Field
                    label="Остаток, шт."
                    error={fieldError('stockQuantity')}
                    hint={
                      form.trackStock
                        ? 'Уменьшается с каждым заказом; при 0 товар «нет в наличии». Заказы, пришедшие пока вы редактируете, учтутся'
                        : 'Учёт выключен — товар всегда «в наличии»'
                    }
                  >
                    <label className="checkbox" style={{ marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={form.trackStock}
                        onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked, stockQuantity: e.target.checked ? f.stockQuantity : '' }))}
                      />
                      Вести учёт остатка
                    </label>
                    {form.trackStock && (
                      <input className="input" inputMode="numeric" value={form.stockQuantity} placeholder="0" onChange={(e) => set('stockQuantity', e.target.value.replace(/\D/g, ''))} />
                    )}
                  </Field>
                  <Field label="Объём / вес">
                    <input className="input" value={form.volume} maxLength={60} placeholder="250 мл" onChange={(e) => set('volume', e.target.value)} />
                  </Field>
                  <Field label="Бейдж" hint="Например: Хит, Новинка, −20%">
                    <input className="input" value={form.badge} maxLength={60} onChange={(e) => set('badge', e.target.value)} />
                  </Field>
                </div>
                <label className="checkbox">
                  <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                  Показывать в «Выбор Greenleaf» на главной
                </label>
              </section>
              {isNew ? (
                <div className="step-nav">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('description')}>
                    Сначала заполнить описание →
                  </button>
                  <button type="button" className="btn btn-gold" onClick={submit} disabled={save.isPending}>
                    {save.isPending ? <Spinner /> : 'Создать товар и перейти к фото →'}
                  </button>
                </div>
              ) : (
                <StepNav tab={tab} onTab={setTab} />
              )}
            </>
          )}

          {tab === 'description' && (
            <section className="panel editor-section">
              <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                <h3>Тексты карточки</h3>
                <button type="button" className="btn btn-gold btn-sm" disabled={form.descriptionRu.trim().length < 20 || parse.isPending} onClick={() => parse.mutate()} title="Выделит из подробного описания краткое описание, преимущества, применение, состав, объём">
                  {parse.isPending ? <Spinner /> : '✨ Разобрать описание'}
                </button>
              </div>
              <LangPair label="Подробное описание" ru={form.descriptionRu} kk={form.descriptionKk} onRu={(v) => set('descriptionRu', v)} onKk={(v) => set('descriptionKk', v)} multiline rows={8} maxRu={20000} hint="Вставьте текст из каталога и нажмите «Разобрать описание»" />
              <LangPair label="Краткое описание" ru={form.summaryRu} kk={form.summaryKk} onRu={(v) => set('summaryRu', v)} onKk={(v) => set('summaryKk', v)} multiline rows={3} maxRu={600} />
              <LangPair label="Способ применения" ru={form.usageRu} kk={form.usageKk} onRu={(v) => set('usageRu', v)} onKk={(v) => set('usageKk', v)} multiline rows={4} maxRu={5000} />
              <Field label="Состав">
                <textarea className="textarea" value={form.composition} maxLength={5000} onChange={(e) => set('composition', e.target.value)} />
              </Field>
              <LangPair label="Меры предосторожности" ru={form.warningsRu} kk={form.warningsKk} onRu={(v) => set('warningsRu', v)} onKk={(v) => set('warningsKk', v)} multiline rows={3} maxRu={3000} />
              <StepNav tab={tab} onTab={setTab} />
            </section>
          )}

          {tab === 'specs' && (
            <>
              <section className="panel editor-section">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>Преимущества</h3>
                  <span className="muted small">{form.benefits.length} / 20 · рекомендуем 3+</span>
                </div>
                <div className="repeat-list">
                  {form.benefits.map((b, i) => (
                    <div key={i} className="repeat-row">
                      <div className="lang-pair">
                        <input className="input" placeholder="RU" value={b.textRu} maxLength={500} onChange={(e) => set('benefits', form.benefits.map((x, j) => (j === i ? { ...x, textRu: e.target.value } : x)))} />
                        <input className="input" placeholder="KZ" value={b.textKk} maxLength={500} onChange={(e) => set('benefits', form.benefits.map((x, j) => (j === i ? { ...x, textKk: e.target.value } : x)))} />
                      </div>
                      <button type="button" className="close-btn" onClick={() => set('benefits', form.benefits.filter((_, j) => j !== i))} aria-label="Удалить">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} disabled={form.benefits.length >= 20} onClick={() => set('benefits', [...form.benefits, { textRu: '', textKk: '' }])}>
                  + Преимущество
                </button>
              </section>

              <section className="panel editor-section">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>Характеристики</h3>
                  <span className="muted small">{form.attributes.length} / 40</span>
                </div>
                <div className="repeat-list">
                  {form.attributes.map((a, i) => (
                    <div key={i} className="repeat-row attr">
                      <input className="input" placeholder="Название (Тип кожи)" value={a.nameRu} maxLength={120} onChange={(e) => set('attributes', form.attributes.map((x, j) => (j === i ? { ...x, nameRu: e.target.value } : x)))} />
                      <input className="input" placeholder="Значение (Для всех типов)" value={a.valueRu} maxLength={500} onChange={(e) => set('attributes', form.attributes.map((x, j) => (j === i ? { ...x, valueRu: e.target.value } : x)))} />
                      <button type="button" className="close-btn" onClick={() => set('attributes', form.attributes.filter((_, j) => j !== i))} aria-label="Удалить">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} disabled={form.attributes.length >= 40} onClick={() => set('attributes', [...form.attributes, { nameRu: '', valueRu: '', nameKk: '', valueKk: '' }])}>
                  + Характеристика
                </button>
              </section>

              <section className="panel editor-section">
                <h3>Поиск и каталог</h3>
                <div className="grid-2">
                  <Field label="Ключевые слова для поиска" hint="Синонимы, народные названия, опечатки — через запятую">
                    <input className="input" value={form.searchKeywords} maxLength={1000} onChange={(e) => set('searchKeywords', e.target.value)} />
                  </Field>
                  <Field label="Страница в бумажном каталоге">
                    <input className="input" inputMode="numeric" value={form.catalogPage} onChange={(e) => set('catalogPage', e.target.value.replace(/\D/g, ''))} />
                  </Field>
                </div>
              </section>
              <StepNav tab={tab} onTab={setTab} nextLabel={isNew ? { media: 'Далее: создать товар и добавить фото' } : undefined} />
            </>
          )}

          {tab === 'media' && (
            <>
              <section className="panel editor-section">
                <h3>Видео о товаре</h3>
                <Field
                  label="Ссылка на видео"
                  error={fieldError('videoUrl') ?? (form.videoUrl.trim() && !videoPreview ? 'Не похоже на ссылку на видео (нужна ссылка http:// или https://)' : undefined)}
                  hint="YouTube, Vimeo или прямая ссылка на MP4. В окне товара видео показывается первым, потом фото. Можно и загрузить файл ниже."
                >
                  <input className="input" value={form.videoUrl} maxLength={500} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => set('videoUrl', e.target.value.trim())} />
                </Field>
                {videoPreview && (
                  <div style={{ maxWidth: 520 }}>
                    <VideoPlayer url={form.videoUrl} />
                  </div>
                )}
              </section>
              <section className="panel editor-section">
                <h3>Фото, видео и документы</h3>
                {product ? (
                  <>
                    <p className="muted small">
                      Перетащите файлы в рамку или нажмите на неё. Первое фото становится обложкой — её видно в каталоге; порядок меняется
                      перетаскиванием.
                    </p>
                    <MediaManager product={product} onChanged={reloadMedia} />
                  </>
                ) : (
                  <div className="media-locked">
                    <span className="media-locked-icon">📷</span>
                    <strong>Фото загружаются после создания товара</strong>
                    <span className="muted small">
                      {form.nameRu.trim() ? 'Нажмите кнопку — товар сохранится черновиком, и здесь появится загрузка файлов.' : 'Сначала укажите название на шаге «Основное».'}
                    </span>
                    {form.nameRu.trim() ? (
                      <button type="button" className="btn btn-gold" onClick={submit} disabled={save.isPending}>
                        {save.isPending ? <Spinner /> : 'Создать товар'}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-ghost" onClick={() => setTab('main')}>
                        ← К шагу «Основное»
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <aside className="editor-side">
          <section className="panel editor-section">
            <h3>Публикация</h3>
            <div className="status-switch">
              {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as ProductStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={clsx(form.status === s && `active ${s}`)}
                  disabled={s === 'PUBLISHED' && !canPublish && form.status !== 'PUBLISHED'}
                  title={s === 'PUBLISHED' && !canPublish ? 'Сначала заполните пункты из списка ниже' : undefined}
                  onClick={() => set('status', s)}
                >
                  {productStatusLabel[s]}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              {form.status === 'DRAFT'
                ? 'Черновик видите только вы — покупатели его не видят.'
                : form.status === 'PUBLISHED'
                  ? 'Товар виден в каталоге и доступен для заказа.'
                  : 'Архив скрыт из каталога, но остаётся в старых заказах.'}
            </p>
            <PublishChecklist items={blockers} />
            <button type="button" className="btn btn-primary btn-block" onClick={submit} disabled={save.isPending || (!dirty && !isNew)}>
              {save.isPending ? <Spinner /> : isNew ? 'Создать товар' : dirty ? 'Сохранить изменения' : 'Сохранено ✓'}
            </button>
            {product && (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => queryClient.isMutating({ mutationKey: ['duplicate', productId] }) === 0 && duplicate.mutate()}
                  disabled={duplicate.isPending}
                >
                  Дублировать
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ flex: 1 }}
                  disabled={remove.isPending}
                  onClick={() => window.confirm(`Удалить «${product.nameRu}»?\nЕсли товар есть в заказах, он будет перемещён в архив.`) && remove.mutate()}
                >
                  Удалить
                </button>
              </div>
            )}
          </section>

          <section className="panel editor-section">
            <h3>Так увидит покупатель</h3>
            <CardPreview input={guide} autoPartner={autoPartner} />
          </section>

          <section className="panel editor-section">
            <h3>Качество карточки</h3>
            {product ? (
              <>
                <div className="row" style={{ gap: 16 }}>
                  <ScoreRing score={product.completeness.score} />
                  <p className="muted small">
                    {product.completeness.score >= 80
                      ? 'Отличная карточка — такие товары лучше находят и чаще покупают.'
                      : 'Заполните пункты ниже, чтобы карточка лучше продавала.'}
                  </p>
                </div>
                {product.completeness.missing.length > 0 && (
                  <ul className="missing-list">
                    {product.completeness.missing.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                )}
                {dirty && <span className="muted small">Оценка обновится после сохранения</span>}
              </>
            ) : (
              <p className="muted small">Оценка появится после создания товара.</p>
            )}
          </section>

          {product && (
            <section className="panel editor-section">
              <h3>Статистика</h3>
              <dl className="kv">
                <dt>Просмотры</dt>
                <dd>{product.viewCount}</dd>
                <dt>Продано</dt>
                <dd>{product.soldCount} шт.</dd>
                <dt>Партн. цена</dt>
                <dd>{money(product.effectivePartnerPrice)}</dd>
                <dt>Создан</dt>
                <dd>{dateTime(product.createdAt)}</dd>
                <dt>Опубликован</dt>
                <dd>{dateTime(product.publishedAt)}</dd>
              </dl>
            </section>
          )}
        </aside>
      </div>

      {dirty && !isNew && (
        <div className="unsaved-bar">
          <span>Есть несохранённые изменения</span>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(initial)}>
              Отменить
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={save.isPending}>
              {save.isPending ? <Spinner /> : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {parsed && <ParseModal parsed={parsed} onApply={applyParsed} onClose={() => setParsed(null)} />}
    </>
  )
}
