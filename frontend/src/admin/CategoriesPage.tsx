import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminCategory, type AdminProductType } from '@/api/admin'
import { errorMessage, problemOf } from '@/api/client'
import { EmptyState, Field, Modal, PageLoader, Spinner } from '@/components/ui'
import { categoryIcon } from '@/lib/categoryIcon'
import { pluralRu } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { toast } from '@/store/toast'
import { AdminHead, nullIfBlank } from './shared'

type Draft = Partial<AdminCategory> & { nameRu: string }

function CategoryForm({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = useMutation({
    mutationFn: () =>
      adminApi.saveCategory(
        {
          nameRu: draft.nameRu.trim(),
          nameKk: nullIfBlank(draft.nameKk),
          slug: nullIfBlank(draft.slug) ?? undefined,
          descriptionRu: nullIfBlank(draft.descriptionRu),
          descriptionKk: nullIfBlank(draft.descriptionKk),
          icon: nullIfBlank(draft.icon),
          sortOrder: Number(draft.sortOrder ?? 0) || 0,
        },
        draft.id,
      ),
    onSuccess: () => {
      toast.success('Категория сохранена')
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
    onError: (e) => {
      const p = problemOf(e)
      setErrors(p.errors ?? {})
      if (!p.errors) toast.error(p.detail)
    },
  })

  return (
    <Modal open title={draft.id ? 'Редактировать категорию' : 'Новая категория'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.nameRu.trim()) save.mutate()
        }}
      >
        <div className="grid-2">
          <Field label="Название · RU" error={errors.nameRu}>
            <input className="input" value={draft.nameRu} maxLength={120} onChange={(e) => set('nameRu', e.target.value)} autoFocus />
          </Field>
          <Field label="Название · KZ">
            <input className="input" value={draft.nameKk ?? ''} maxLength={120} onChange={(e) => set('nameKk', e.target.value)} />
          </Field>
          <Field label="Slug" error={errors.slug} hint="Пусто — из названия">
            <input className="input" value={draft.slug ?? ''} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </Field>
          <div className="grid-2">
            <Field label="Иконка" hint="Эмодзи">
              <input className="input" value={draft.icon ?? ''} maxLength={8} onChange={(e) => set('icon', e.target.value)} />
            </Field>
            <Field label="Порядок">
              <input className="input" inputMode="numeric" value={draft.sortOrder ?? 0} onChange={(e) => set('sortOrder', Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </Field>
          </div>
        </div>
        <Field label="Описание · RU">
          <textarea className="textarea" rows={3} value={draft.descriptionRu ?? ''} onChange={(e) => set('descriptionRu', e.target.value)} />
        </Field>
        <Field label="Описание · KZ">
          <textarea className="textarea" rows={3} value={draft.descriptionKk ?? ''} onChange={(e) => set('descriptionKk', e.target.value)} />
        </Field>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={save.isPending || !draft.nameRu.trim()}>
            {save.isPending ? <Spinner /> : 'Сохранить'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  )
}

type TypeDraft = Partial<AdminProductType> & { nameRu: string; categoryId: number }

/** Product types are the sub-filters shoppers see after picking a category in the catalog. */
function TypeForm({ initial, category, onClose }: { initial: TypeDraft; category: AdminCategory; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<TypeDraft>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof TypeDraft>(k: K, v: TypeDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['facets'] })
  }

  const save = useMutation({
    mutationFn: () =>
      adminApi.saveType(
        {
          nameRu: draft.nameRu.trim(),
          nameKk: nullIfBlank(draft.nameKk),
          slug: nullIfBlank(draft.slug) ?? undefined,
          sortOrder: draft.sortOrder,
        },
        draft.id,
        draft.categoryId,
      ),
    onSuccess: () => {
      toast.success('Вид товара сохранён')
      refresh()
      onClose()
    },
    onError: (e) => {
      const p = problemOf(e)
      setErrors(p.errors ?? {})
      if (!p.errors) toast.error(p.detail)
    },
  })

  const remove = useMutation({
    mutationFn: () => adminApi.deleteType(draft.id!),
    onSuccess: () => {
      toast.success('Вид товара удалён')
      refresh()
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const count = draft.productCount ?? 0
  return (
    <Modal open title={draft.id ? 'Вид товара' : `Новый вид · ${category.nameRu}`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.nameRu.trim()) save.mutate()
        }}
      >
        <p className="muted small" style={{ margin: 0 }}>
          {categoryIcon(category.icon)} {category.nameRu} — в каталоге этот вид появится подфильтром, когда покупатель выберет категорию.
        </p>
        <div className="grid-2">
          <Field label="Название · RU" error={errors.nameRu}>
            <input className="input" value={draft.nameRu} maxLength={150} onChange={(e) => set('nameRu', e.target.value)} autoFocus placeholder="Например, Шампуни" />
          </Field>
          <Field label="Название · KZ">
            <input className="input" value={draft.nameKk ?? ''} maxLength={150} onChange={(e) => set('nameKk', e.target.value)} />
          </Field>
          <Field label="Slug" error={errors.slug} hint="Пусто — из названия">
            <input className="input" value={draft.slug ?? ''} maxLength={80} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </Field>
          <Field label="Порядок" hint="Меньше — левее в фильтре">
            <input
              className="input"
              inputMode="numeric"
              value={draft.sortOrder ?? ''}
              placeholder="В конец"
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '')
                set('sortOrder', digits ? Number(digits) : undefined)
              }}
            />
          </Field>
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={save.isPending || !draft.nameRu.trim()}>
            {save.isPending ? <Spinner /> : 'Сохранить'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          {draft.id && (
            <>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-danger"
                disabled={remove.isPending}
                onClick={() =>
                  window.confirm(
                    count > 0
                      ? `Удалить вид «${draft.nameRu}»? ${count} ${pluralRu(count, 'товар останется', 'товара останутся', 'товаров останутся')} в категории без вида.`
                      : `Удалить вид «${draft.nameRu}»?`,
                  ) && remove.mutate()
                }
              >
                Удалить
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default function CategoriesPage() {
  useDocumentTitle('Категории')
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories })
  const [editing, setEditing] = useState<Draft | null>(null)
  const [editingType, setEditingType] = useState<{ draft: TypeDraft; category: AdminCategory } | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Категория удалена')
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading) return <PageLoader />

  return (
    <>
      <AdminHead eyebrow="Каталог" title="Категории">
        <button type="button" className="btn btn-gold" onClick={() => setEditing({ nameRu: '', sortOrder: (data?.length ?? 0) + 1 })}>
          + Категория
        </button>
      </AdminHead>
      {!data?.length ? (
        <div className="panel">
          <EmptyState title="Категорий пока нет" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Категория</th>
                <th>Виды товаров (подфильтры)</th>
                <th className="num">Товаров</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="muted">{c.sortOrder}</td>
                  <td>
                    <strong>
                      {categoryIcon(c.icon)} {c.nameRu}
                    </strong>
                    {c.nameKk && <span className="muted small" style={{ display: 'block' }}>{c.nameKk}</span>}
                    <span className="muted small" style={{ display: 'block' }}>{c.slug}</span>
                  </td>
                  <td>
                    <div className="type-tags">
                      {c.types.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          className="type-tag"
                          title="Изменить вид товара"
                          onClick={() => setEditingType({ draft: type, category: c })}
                        >
                          {type.nameRu}
                          <span className="count">{type.productCount}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="type-tag add"
                        onClick={() => setEditingType({ draft: { nameRu: '', categoryId: c.id }, category: c })}
                      >
                        + вид
                      </button>
                    </div>
                  </td>
                  <td className="num">
                    <Link to={`/admin/products?categoryId=${c.id}`} className="btn-link">
                      {c.productCount}
                    </Link>
                  </td>
                  <td className="actions">
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={c.productCount > 0}
                        title={c.productCount > 0 ? 'Сначала перенесите товары в другую категорию' : 'Удалить'}
                        onClick={() => window.confirm(`Удалить категорию «${c.nameRu}»?`) && remove.mutate(c.id)}
                      >
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
      {editing && <CategoryForm initial={editing} onClose={() => setEditing(null)} />}
      {editingType && (
        <TypeForm initial={editingType.draft} category={editingType.category} onClose={() => setEditingType(null)} />
      )}
    </>
  )
}
