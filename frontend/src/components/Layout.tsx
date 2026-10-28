import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router'
import clsx from 'clsx'
import { useLangStore, useT } from '@/i18n'
import { formatPhone } from '@/lib/format'
import { useIsPhone, useRevealOnScroll, useSettings } from '@/lib/hooks'
import { MARQUEE_SENTENCES } from '@/content/promo'
import { Marquee } from './Promo'
import { useAuthStore, useIsAdmin } from '@/store/auth'
import { useCartCount, useCartStore } from '@/store/cart'
import { useFavoritesStore } from '@/store/favorites'
import { toast } from '@/store/toast'
import { promptInstall, useInstallOption } from '@/lib/pwa'
import { BrandLogo } from './Brand'
import { CartDrawer } from './CartDrawer'
import { BagIcon, CardIcon, DownloadIcon, GridIcon, HeartIcon, HomeIcon, UserIcon } from './Icons'
import { ProductQuickView } from './QuickView'
import { SearchBox } from './SearchBox'

function CartButton() {
  const { t } = useT()
  const count = useCartCount()
  const open = useCartStore((s) => s.openDrawer)
  const [bump, setBump] = useState(false)
  const previous = useRef(count)

  useEffect(() => {
    if (count > previous.current) {
      setBump(true)
      const id = window.setTimeout(() => setBump(false), 400)
      previous.current = count
      return () => window.clearTimeout(id)
    }
    previous.current = count
  }, [count])

  return (
    <button type="button" className="btn btn-ghost cart-btn" onClick={open} aria-label={t.cart}>
      <BagIcon size={18} />
      <span className="btn-label">{t.cart}</span>
      {count > 0 && <span className={clsx('cart-count', bump && 'bump')}>{count}</span>}
    </button>
  )
}

/**
 * Phone navigation, app style: always at hand at the bottom of the screen, with the discount card in the middle.
 * The product page swaps it for its own buy bar, and checkout needs the room for the order form.
 */
function MobileTabBar() {
  const { t } = useT()
  const count = useCartCount()
  const open = useCartStore((s) => s.openDrawer)
  const user = useAuthStore((s) => s.user)
  const { pathname } = useLocation()
  if (pathname.startsWith('/checkout') || pathname.startsWith('/product/')) return null
  return (
    <nav className="tab-bar" aria-label={t.home}>
      <NavLink to="/" end>
        <HomeIcon size={22} />
        <span>{t.home}</span>
      </NavLink>
      <NavLink to="/catalog">
        <GridIcon size={22} />
        <span>{t.catalog}</span>
      </NavLink>
      <NavLink to="/partner" className="tab-card">
        <span className="tab-card-icon">
          <CardIcon size={24} />
        </span>
        <span>{t.tabCard}</span>
      </NavLink>
      <button type="button" className="tab-cart" onClick={open} aria-label={count ? `${t.cart}: ${count}` : t.cart}>
        <span className="tab-icon">
          <BagIcon size={22} />
          {count > 0 && <span className="cart-count">{count}</span>}
        </span>
        <span>{t.cart}</span>
      </button>
      <NavLink to={user ? '/account' : '/login'}>
        <UserIcon size={22} />
        <span>{user ? t.profile : t.login}</span>
      </NavLink>
    </nav>
  )
}

function FavoritesLink() {
  const { t } = useT()
  const count = useFavoritesStore((s) => s.favorites.length)
  return (
    <Link to="/favorites" className="btn btn-ghost btn-icon fav-link" aria-label={count ? `${t.favorites}: ${count}` : t.favorites} title={t.favorites}>
      <HeartIcon size={18} filled={count > 0} />
      {count > 0 && <span className="cart-count">{count}</span>}
    </Link>
  )
}

function InstallButton() {
  const { t } = useT()
  const option = useInstallOption()
  if (!option) return null
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm install-btn"
      onClick={() => (option === 'prompt' ? void promptInstall() : toast.info(t.installIos))}
    >
      <DownloadIcon size={16} /> {t.installApp}
    </button>
  )
}

function Header() {
  const { t } = useT()
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const user = useAuthStore((s) => s.user)
  const isAdmin = useIsAdmin()
  const phone = useIsPhone()
  const { pathname } = useLocation()

  return (
    <header className="site-header container">
      <div className="topbar">
        <Link to="/" className="brand" aria-label="Greenleaf family">
          <BrandLogo />
        </Link>
        {phone && pathname === '/' && <Marquee sentences={MARQUEE_SENTENCES} to="/partner" className="header-marquee" />}
        <nav className="main-nav">
          <NavLink to="/catalog">{t.catalog}</NavLink>
          <NavLink to="/partner">{t.partner}</NavLink>
          <NavLink to="/track">{t.trackOrder}</NavLink>
        </nav>
        <SearchBox />
        <div className="header-actions">
          <div className="lang-switch">
            <button type="button" className={clsx(lang === 'ru' && 'active')} onClick={() => setLang('ru')}>
              RU
            </button>
            <button type="button" className={clsx(lang === 'kk' && 'active')} onClick={() => setLang('kk')}>
              KZ
            </button>
          </div>
          {isAdmin && (
            <Link to="/admin" className="btn btn-gold btn-sm admin-link" aria-label={t.admin} title={t.admin}>
              <GridIcon size={16} />
            </Link>
          )}
          <FavoritesLink />
          <Link to={user ? '/account' : '/login'} className="btn btn-ghost btn-icon account-link" aria-label={user ? t.account : t.login} title={user?.fullName ?? t.login}>
            <UserIcon size={18} />
          </Link>
          <CartButton />
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const { t } = useT()
  const { data: settings } = useSettings()
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack" style={{ gap: 10 }}>
            <div className="brand">
              <BrandLogo />
            </div>
            <p className="muted small" style={{ maxWidth: 340 }}>
              {t.heroText}
            </p>
          </div>
          <div>
            <h4>{t.catalog}</h4>
            <ul>
              <li><Link to="/catalog">{t.allProducts}</Link></li>
              <li><Link to="/catalog?sort=popular">{t.bestsellers}</Link></li>
              <li><Link to="/catalog?sort=newest">{t.newest}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t.partner}</h4>
            <ul>
              <li><Link to="/partner">{t.becomePartner}</Link></li>
              <li><Link to="/track">{t.trackOrder}</Link></li>
              <li><Link to="/account">{t.account}</Link></li>
              <li><Link to="/privacy">{t.privacy}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t.contacts}</h4>
            <ul>
              {settings?.phone && <li><a href={`tel:${settings.phone.replace(/\s/g, '')}`}>{formatPhone(settings.phone)}</a></li>}
              {settings?.whatsapp && <li><a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a></li>}
              {settings?.telegramUrl && <li><a href={settings.telegramUrl} target="_blank" rel="noreferrer">Telegram</a></li>}
              {settings?.instagramUrl && <li><a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a></li>}
              {settings?.address && <li className="muted small">{[settings.city, settings.address].filter(Boolean).join(', ')}</li>}
              {settings?.workingHours && <li className="muted small">{t.workingHours}: {settings.workingHours}</li>}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Greenleaf</span>
          <InstallButton />
        </div>
      </div>
    </footer>
  )
}

const scrollPositions = new Map<string, number>()

/**
 * New pages open at the top; Back/Forward returns to where the shopper was (the catalog is long). Only the path
 * counts as a new page — filters and the product window change the query and keep the scroll.
 */
function ScrollToTop() {
  const { pathname, hash, key } = useLocation()
  const navigationType = useNavigationType()
  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => scrollPositions.set(keyRef.current, window.scrollY))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const saved = navigationType === 'POP' ? scrollPositions.get(key) : undefined
    if (saved != null) {
      // The page may still be loading its products: wait until it is tall enough to scroll there.
      let attempts = 0
      const timer = window.setInterval(() => {
        const reachable = document.documentElement.scrollHeight - window.innerHeight >= saved
        if (reachable || ++attempts > 20) {
          window.clearInterval(timer)
          window.scrollTo({ top: saved })
        }
      }, 50)
      return () => window.clearInterval(timer)
    }
    if (!hash) {
      window.scrollTo({ top: 0 })
      return
    }
    // Pages are lazy-loaded, so the anchor may appear a moment after navigation.
    let attempts = 0
    const timer = window.setInterval(() => {
      const target = document.getElementById(hash.slice(1))
      if (target || ++attempts > 30) {
        window.clearInterval(timer)
        target?.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash])
  return null
}

export function Layout() {
  useRevealOnScroll()
  return (
    <>
      <ScrollToTop />
      <Header />
      <main className="main container">
        <Outlet />
      </main>
      <Footer />
      <ProductQuickView />
      <CartDrawer />
      <MobileTabBar />
    </>
  )
}
