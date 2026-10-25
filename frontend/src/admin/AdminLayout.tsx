import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import '@/styles/admin.css'
import clsx from 'clsx'
import { adminApi } from '@/api/admin'
import { BrandLogo } from '@/components/Brand'
import { MenuIcon } from '@/components/Icons'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/store/toast'

const COUNTER = /^\(\d+\) /

/** Keeps "(3) " in front of whatever title the current page sets, so new orders are visible from another tab. */
function useTitleCounter(count: number) {
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(COUNTER, '')
      const next = count > 0 ? `(${count}) ${base}` : base
      if (document.title !== next) document.title = next
    }
    apply()
    const title = document.querySelector('title')
    if (!title) return
    const observer = new MutationObserver(apply)
    observer.observe(title, { childList: true, characterData: true, subtree: true })
    return () => {
      observer.disconnect()
      document.title = document.title.replace(COUNTER, '')
    }
  }, [count])
}

function chime() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9)
    for (const [freq, at] of [[880, 0], [1320, 0.18]] as const) {
      const osc = ctx.createOscillator()
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + 0.9)
    }
    window.setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* sound is a nicety; browsers may block it until the page is clicked */
  }
}

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
  const { data: dashboard } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })
  const newOrders = dashboard?.counters.ordersNew ?? 0
  const seen = useRef<number | null>(null)

  useTitleCounter(newOrders)

  useEffect(() => {
    if (!dashboard) return
    const before = seen.current
    seen.current = newOrders
    if (before != null && newOrders > before) {
      chime()
      toast.success(newOrders - before === 1 ? 'Новый заказ!' : `Новых заказов: ${newOrders - before}`)
    }
  }, [dashboard, newOrders])

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
