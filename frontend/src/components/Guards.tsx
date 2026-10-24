import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuthStore } from '@/store/auth'
import { EmptyState, PageLoader } from './ui'

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'loading') return <PageLoader />
  if (status === 'anonymous') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const role = useAuthStore((s) => s.user?.role)
  const location = useLocation()
  if (status === 'loading') return <PageLoader />
  if (status === 'anonymous') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (role !== 'ADMIN') {
    return <EmptyState icon="🔒" title="Доступ только для администраторов" text="Войдите под учётной записью администратора." />
  }
  return <>{children}</>
}
