import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { adminApi } from '@/api/admin'
import { BrandLogo } from '@/components/Brand'
import { MenuIcon } from '@/components/Icons'
import { useAuthStore } from '@/store/auth'

const NAV = [
  { to: '/admin', label: 'Дашборд', icon: '◧', end: true },
  { to: '/admin/products', label: 'Товары', icon: '◫' },
  { to: '/admin/orders', label: 'Заказы', icon: '☰', badge: true },
  { to: '/admin/categories', label: 'Категории', icon: '❖' },
  { to: '/admin/brands', label: 'Бренды', icon: '✦' },
  { to: '/admin/users', label: 'Пользователи', icon: '☺' },
  { to: '/admin/settings', label: 'Настройки сайта', icon: '⚙' },
]

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { data: dashboard } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard, refetchInterval: 60_000 })
  const newOrders = dashboard?.counters.ordersNew ?? 0

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="admin-shell">
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <aside className={clsx('admin-sidebar', open && 'open')}>
        <Link to="/" className="brand">
          <BrandLogo subtitle="Админ-панель" />
        </Link>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="admin-nav-link">
            <span className="icon">{item.icon}</span>
            {item.label}
            {item.badge && newOrders > 0 && <span className="badge badge-gold">{newOrders}</span>}
          </NavLink>
        ))}
        <Link to="/admin/products/new" className="btn btn-gold btn-sm" style={{ marginTop: 12 }}>
          + Новый товар
        </Link>
        <div className="admin-sidebar-foot">
          <div className="small">
            <strong style={{ display: 'block' }}>{user?.fullName}</strong>
            <span className="muted">{user?.email}</span>
          </div>
          <Link to="/" className="btn btn-ghost btn-sm">
            ← На сайт
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await logout()
              navigate('/')
            }}
          >
            Выйти
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-mobile-bar">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Меню">
            <MenuIcon />
          </button>
          <strong>Greenleaf · Админка</strong>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
