import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { errorMessage } from '@/api/client'
import type { Role, User } from '@/api/types'
import { Select } from '@/components/Select'
import { EmptyState, Pagination, Spinner } from '@/components/ui'
import { dateTime } from '@/lib/format'
import { useDebounced, useDocumentTitle } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/store/toast'
import { AdminHead, Toggle } from './shared'

export default function UsersPage() {
  useDocumentTitle('Пользователи')
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [page, setPage] = useState(1)
  const debouncedQ = useDebounced(q, 300)

  const list = useQuery({
    queryKey: ['admin', 'users', debouncedQ, role, page],
    queryFn: () => adminApi.users({ q: debouncedQ, role, page: page - 1 }),
    placeholderData: keepPreviousData,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { role?: Role; partner?: boolean; enabled?: boolean } }) => adminApi.updateUser(id, body),
    onSuccess: (u: User) => {
      toast.success(`${u.fullName}: изменения сохранены`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null)
  const resetPassword = useMutation({
    mutationFn: (u: User) => adminApi.resetPassword(u.id).then((r) => ({ name: u.fullName, password: r.temporaryPassword })),
    onSuccess: (r) => setIssued(r),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const data = list.data

  useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages)
  }, [data, page])

  return (
    <>
      <AdminHead eyebrow="Доступ" title={`Пользователи${data ? ` · ${data.totalItems}` : ''}`}>
        {list.isFetching && <Spinner />}
      </AdminHead>
      <div className="filter-bar">
        <input
          className="input grow"
          placeholder="Имя, email или телефон…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <Select<Role | ''>
          aria-label="Роль"
          value={role}
          onChange={(v) => {
            setRole(v)
            setPage(1)
          }}
          options={[
            { value: '', label: 'Все роли' },
            { value: 'USER', label: 'Покупатели' },
            { value: 'ADMIN', label: 'Администраторы' },
          ]}
        />
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        «Партнёр» включает партнёрские цены. Смена роли или блокировка сразу завершает все сеансы пользователя. Забыл пароль —
        «Новый пароль»: покупатель получит временный пароль от вас и сменит его в личном кабинете.
      </p>

      {issued && (
        <div className="panel notice-panel" role="status">
          <div>
            <strong>Временный пароль для {issued.name}:</strong> <code className="temp-password">{issued.password}</code>
            <p className="muted small">Передайте его покупателю (например, в WhatsApp). Старый пароль больше не работает, все сеансы завершены.</p>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                navigator.clipboard?.writeText(issued.password).then(
                  () => toast.success('Скопировано'),
                  () => toast.error('Не удалось скопировать — выделите пароль вручную'),
                )
              }
            >
              Копировать
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIssued(null)}>
              Скрыть
            </button>
          </div>
        </div>
      )}

      {data && data.items.length === 0 ? (
        <div className="panel">
          <EmptyState icon="☺" title="Пользователи не найдены" />
        </div>
      ) : (
        <div className="table-wrap" style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Телефон</th>
                <th>Роль</th>
                <th>Партнёр</th>
                <th>Активен</th>
                <th>Регистрация</th>
                <th>Последний вход</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((u) => {
                const self = u.id === me?.id
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.fullName}</strong>
                      {self && <span className="badge badge-green" style={{ marginLeft: 6 }}>вы</span>}
                      <span className="muted small" style={{ display: 'block' }}>{u.email}</span>
                    </td>
                    <td className="muted">{u.phone ?? '—'}</td>
                    <td>
                      <Select<Role>
                        aria-label={`Роль: ${u.fullName}`}
                        size="sm"
                        style={{ width: 170 }}
                        value={u.role}
                        disabled={self || update.isPending}
                        onChange={(next) => {
                          if (window.confirm(`Сменить роль ${u.fullName} на «${next === 'ADMIN' ? 'Администратор' : 'Покупатель'}»?`)) {
                            update.mutate({ id: u.id, body: { role: next } })
                          }
                        }}
                        options={[
                          { value: 'USER', label: 'Покупатель' },
                          { value: 'ADMIN', label: 'Администратор' },
                        ]}
                      />
                    </td>
                    <td>
                      <Toggle checked={u.partner} disabled={update.isPending} label="Партнёр" onChange={(v) => update.mutate({ id: u.id, body: { partner: v } })} />
                    </td>
                    <td>
                      <Toggle
                        checked={u.enabled}
                        disabled={self || update.isPending}
                        label="Активен"
                        onChange={(v) => (v || window.confirm(`Заблокировать ${u.fullName}?`)) && update.mutate({ id: u.id, body: { enabled: v } })}
                      />
                    </td>
                    <td className="muted nowrap">{dateTime(u.createdAt)}</td>
                    <td className="muted nowrap">{dateTime(u.lastLoginAt)}</td>
                    <td>
                      {!self && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm nowrap"
                          disabled={resetPassword.isPending}
                          onClick={() =>
                            window.confirm(`Выдать ${u.fullName} новый временный пароль? Старый перестанет работать.`) && resetPassword.mutate(u)
                          }
                        >
                          Новый пароль
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  )
}
