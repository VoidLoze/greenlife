import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminBrand } from '@/api/admin'
import { errorMessage, problemOf } from '@/api/client'
import { EmptyState, Field, Modal, PageLoader, Spinner } from '@/components/ui'
import { useDocumentTitle } from '@/lib/hooks'
import { toast } from '@/store/toast'
import { AdminHead, nullIfBlank } from './shared'

type Draft = Partial<AdminBrand> & { name: string }

function BrandForm({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  const save = useMutation({
    mutationFn: () =>
      adminApi.saveBrand({ name: draft.name.trim(), slug: nullIfBlank(draft.slug) ?? undefined, description: nullIfBlank(draft.description) }, draft.id),
    onSuccess: () => {
      toast.success('Бренд сохранён')
      queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] })
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      onClose()
    },
    onError: (e) => {
      const p = problemOf(e)
      setErrors(p.errors ?? {})
      if (!p.errors) toast.error(p.detail)
    },
  })

  return (
    <Modal open title={draft.id ? 'Редактировать бренд' : 'Новый бренд'} onClose={onClose} dirty={dirty && !save.isPending}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.name.trim()) save.mutate()
        }}
      >
        <Field label="Название" error={errors.name}>
          <input className="input" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Slug" error={errors.slug} hint="Пусто — из названия">
          <input className="input" value={draft.slug ?? ''} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
        </Field>
        <Field label="Описание">
          <textarea className="textarea" rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={save.isPending || !draft.name.trim()}>
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

export default function BrandsPage() {
  useDocumentTitle('Бренды')
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'brands'], queryFn: adminApi.brands })
  const [editing, setEditing] = useState<Draft | null>(null)
  const [q, setQ] = useState('')
  const filtered = useMemo(() => data?.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())) ?? [], [data, q])

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteBrand(id),
    onSuccess: () => {
      toast.success('Бренд удалён')
      queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] })
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading) return <PageLoader />

  return (
    <>
      <AdminHead eyebrow="Каталог" title={`Бренды${data ? ` · ${data.length}` : ''}`}>
        <button type="button" className="btn btn-gold" onClick={() => setEditing({ name: '' })}>
          + Бренд
        </button>
      </AdminHead>
      <div className="filter-bar">
        <input className="input grow" placeholder="Поиск бренда…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!filtered.length ? (
        <div className="panel">
          <EmptyState title="Брендов не найдено" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table cards">
            <thead>
              <tr>
                <th>Бренд</th>
                <th>Slug</th>
                <th className="num">Товаров</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td className="cell-main">
                    <strong>{b.name}</strong>
                    {b.description && <span className="muted small" style={{ display: 'block' }}>{b.description.slice(0, 100)}</span>}
                  </td>
                  <td className="muted" data-label="Slug">{b.slug}</td>
                  <td className="num" data-label="Товаров">
                    <Link to={`/admin/products?brandId=${b.id}`} className="btn-link">
                      {b.productCount}
                    </Link>
                  </td>
                  <td className="actions cell-end">
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(b)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={b.productCount > 0}
                        title={b.productCount > 0 ? 'У бренда есть товары' : 'Удалить'}
                        onClick={() => window.confirm(`Удалить бренд «${b.name}»?`) && remove.mutate(b.id)}
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
      {editing && <BrandForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
