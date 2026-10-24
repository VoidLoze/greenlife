import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminProductListItem, type ProductListFilter } from '@/api/admin'
import { errorMessage } from '@/api/client'
import type { ProductStatus } from '@/api/types'
import { Select } from '@/components/Select'
import { EmptyState, Pagination, Spinner } from '@/components/ui'
import { dateTime, money } from '@/lib/format'
import { useDebounced, useDocumentTitle } from '@/lib/hooks'
import { toast } from '@/store/toast'
import { AdminHead, CompletenessBar, productStatusBadge, productStatusLabel } from './shared'

export default function ProductsPage() {
  useDocumentTitle('Товары')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const debouncedQ = useDebounced(q, 300)

  const filter: ProductListFilter = {
    q: params.get('q') ?? '',
    status: (params.get('status') as ProductStatus) ?? '',
    categoryId: params.get('categoryId') ? Number(params.get('categoryId')) : '',
    brandId: params.get('brandId') ? Number(params.get('brandId')) : '',
    lowStock: params.get('lowStock') === 'true',
    noPhoto: params.get('noPhoto') === 'true',
    sort: params.get('sort') ?? '',
    page: Math.max(0, Number(params.get('page') ?? 1) - 1),
    size: 30,
  }

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) setParam('q', debouncedQ || undefined)
  }, [debouncedQ])

  const list = useQuery({ queryKey: ['admin', 'products', filter], queryFn: () => adminApi.products(filter), placeholderData: keepPreviousData })
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories })
  const brands = useQuery({ queryKey: ['admin', 'brands'], queryFn: adminApi.brands })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const status = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ProductStatus }) => adminApi.setStatus(id, status),
    onSuccess: (p) => {
      toast.success(`«${p.nameRu}» — ${productStatusLabel[p.status].toLowerCase()}`)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const duplicate = useMutation({
    mutationFn: (id: number) => adminApi.duplicate(id),
    onSuccess: (p) => {
      toast.success('Создана копия товара (черновик)')
      refresh()
      navigate(`/admin/products/${p.id}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteProduct(id),
    onSuccess: (res) => {
      toast.info(res.message)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const onDelete = (p: AdminProductListItem) => {
    if (window.confirm(`Удалить «${p.nameRu}»?\nЕсли товар есть в заказах, он будет перемещён в архив.`)) remove.mutate(p.id)
  }

  const data = list.data
  const page = (filter.page ?? 0) + 1

  return (
    <>
      <AdminHead eyebrow="Каталог" title={`Товары${data ? ` · ${data.totalItems}` : ''}`}>
        {list.isFetching && <Spinner />}
        <Link to="/admin/products/new" className="btn btn-gold">
          + Новый товар
        </Link>
      </AdminHead>

      <div className="filter-bar">
        <input className="input grow" placeholder="Поиск по названию, артикулу, slug…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          aria-label="Статус"
          value={filter.status ?? ''}
          onChange={(v) => setParam('status', v)}
          options={[
            { value: '', label: 'Все статусы' },
            { value: 'PUBLISHED', label: 'Опубликованные' },
            { value: 'DRAFT', label: 'Черновики' },
            { value: 'ARCHIVED', label: 'Архив' },
          ]}
        />
        <Select
          aria-label="Категория"
          value={String(filter.categoryId ?? '')}
          onChange={(v) => setParam('categoryId', v)}
          options={[
            { value: '', label: 'Все категории' },
            ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.nameRu, hint: `${c.productCount} товаров` })),
          ]}
        />
        <Select
          aria-label="Бренд"
          value={String(filter.brandId ?? '')}
          onChange={(v) => setParam('brandId', v)}
          options={[
            { value: '', label: 'Все бренды' },
            ...(brands.data ?? []).map((b) => ({ value: String(b.id), label: b.name, hint: `${b.productCount} товаров` })),
          ]}
        />
        <Select
          aria-label="Сортировка"
          value={filter.sort ?? ''}
          onChange={(v) => setParam('sort', v)}
          options={[
            { value: '', label: 'Недавно изменённые' },
            { value: 'created', label: 'Недавно созданные' },
            { value: 'name', label: 'По названию' },
            { value: 'price_asc', label: 'Сначала дешевле' },
            { value: 'price_desc', label: 'Сначала дороже' },
            { value: 'stock', label: 'Меньше всего на складе' },
            { value: 'sold', label: 'Больше продаж' },
            { value: 'views', label: 'Больше просмотров' },
          ]}
        />
        <label className="checkbox">
          <input type="checkbox" checked={!!filter.lowStock} onChange={(e) => setParam('lowStock', e.target.checked ? 'true' : undefined)} />
          Мало на складе
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={!!filter.noPhoto} onChange={(e) => setParam('noPhoto', e.target.checked ? 'true' : undefined)} />
          Без фото
        </label>
      </div>

      {list.isError ? (
        <div className="notice error">{errorMessage(list.error)}</div>
      ) : data && data.items.length === 0 ? (
        <div className="panel">
          <EmptyState icon="🔍" title="Товары не найдены" text="Измените фильтры или создайте новый товар." action={<Link to="/admin/products/new" className="btn btn-primary">+ Новый товар</Link>} />
        </div>
      ) : (
        <div className="table-wrap" style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Товар</th>
                <th>Статус</th>
                <th className="num">Цена</th>
                <th className="num">Партн.</th>
                <th className="num">Остаток</th>
                <th>Карточка</th>
                <th className="num">Прод./Просм.</th>
                <th>Изменён</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((p) => (
                <tr key={p.id}>
                  <td>{p.thumbUrl ? <img className="thumb" src={p.thumbUrl} alt="" loading="lazy" /> : <span className="thumb-ph">нет</span>}</td>
                  <td className="name-cell">
                    <Link to={`/admin/products/${p.id}`}>{p.nameRu}</Link>
                    <span className="muted small">
                      {p.sku}
                      {p.brandName ? ` · ${p.brandName}` : ''}
                      {p.categoryNameRu ? ` · ${p.categoryNameRu}` : ''}
                      {p.featured ? ' · ★' : ''}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${productStatusBadge[p.status]}`}>{productStatusLabel[p.status]}</span>
                  </td>
                  <td className="num">{money(p.price)}</td>
                  <td className="num muted">{p.partnerPrice != null ? money(p.partnerPrice) : 'авто'}</td>
                  <td className="num" style={{ color: p.stockQuantity != null && p.stockQuantity <= 3 ? 'var(--warning)' : undefined }}>
                    {p.stockQuantity ?? '∞'}
                  </td>
                  <td>
                    <CompletenessBar score={p.completeness} />
                  </td>
                  <td className="num muted">
                    {p.soldCount} / {p.viewCount}
                  </td>
                  <td className="muted small nowrap">{dateTime(p.updatedAt)}</td>
                  <td className="actions">
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      {p.status === 'PUBLISHED' ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => status.mutate({ id: p.id, status: 'DRAFT' })} title="Снять с витрины">
                          Скрыть
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => status.mutate({ id: p.id, status: 'PUBLISHED' })} title="Опубликовать">
                          Опубл.
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => duplicate.mutate(p.id)} title="Дублировать">
                        ⧉
                      </button>
                      {p.status === 'PUBLISHED' && (
                        <a className="btn btn-ghost btn-sm" href={`/product/${p.slug}`} target="_blank" rel="noreferrer" title="Открыть на сайте">
                          ↗
                        </a>
                      )}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(p)} title="Удалить">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pagination page={page} totalPages={data.totalPages} onChange={(p) => setParam('page', p > 1 ? String(p) : undefined)} />}
    </>
  )
}
