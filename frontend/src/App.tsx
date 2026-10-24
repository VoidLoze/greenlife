import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, RouterProvider, useParams } from 'react-router'
import { CartSync } from '@/components/CartSync'
import { RequireAdmin, RequireAuth } from '@/components/Guards'
import { Layout } from '@/components/Layout'
import { PageLoader, Toasts } from '@/components/ui'
import { useLangStore } from '@/i18n'
import { useAuthStore } from '@/store/auth'
import HomePage from '@/pages/HomePage'
import CatalogPage from '@/pages/CatalogPage'
import ProductPage from '@/pages/ProductPage'
import NotFoundPage from '@/pages/NotFoundPage'

const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const OrderSuccessPage = lazy(() => import('@/pages/OrderSuccessPage'))
const TrackOrderPage = lazy(() => import('@/pages/TrackOrderPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const AccountPage = lazy(() => import('@/pages/AccountPage'))
const PartnerPage = lazy(() => import('@/pages/PartnerPage'))

const AdminLayout = lazy(() => import('@/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/admin/DashboardPage'))
const AdminProducts = lazy(() => import('@/admin/ProductsPage'))
const AdminProductEditor = lazy(() => import('@/admin/ProductEditorPage'))
const AdminCategories = lazy(() => import('@/admin/CategoriesPage'))
const AdminBrands = lazy(() => import('@/admin/BrandsPage'))
const AdminOrders = lazy(() => import('@/admin/OrdersPage'))
const AdminOrder = lazy(() => import('@/admin/OrderPage'))
const AdminUsers = lazy(() => import('@/admin/UsersPage'))
const AdminSettings = lazy(() => import('@/admin/SettingsPage'))

const page = (node: React.ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>

/** Remounts the editor per product so no state leaks between products. */
function ProductEditorRoute() {
  const { id } = useParams()
  return <AdminProductEditor key={id ?? 'new'} />
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'checkout', element: page(<CheckoutPage />) },
      { path: 'order/:number', element: page(<OrderSuccessPage />) },
      { path: 'track', element: page(<TrackOrderPage />) },
      { path: 'login', element: page(<LoginPage />) },
      { path: 'register', element: page(<RegisterPage />) },
      { path: 'partner', element: page(<PartnerPage />) },
      { path: 'account', element: <RequireAuth>{page(<AccountPage />)}</RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: 'admin',
    element: <RequireAdmin>{page(<AdminLayout />)}</RequireAdmin>,
    children: [
      { index: true, element: page(<AdminDashboard />) },
      { path: 'products', element: page(<AdminProducts />) },
      { path: 'products/new', element: page(<ProductEditorRoute />) },
      { path: 'products/:id', element: page(<ProductEditorRoute />) },
      { path: 'categories', element: page(<AdminCategories />) },
      { path: 'brands', element: page(<AdminBrands />) },
      { path: 'orders', element: page(<AdminOrders />) },
      { path: 'orders/:id', element: page(<AdminOrder />) },
      { path: 'users', element: page(<AdminUsers />) },
      { path: 'settings', element: page(<AdminSettings />) },
    ],
  },
])

export default function App() {
  const init = useAuthStore((s) => s.init)
  const lang = useLangStore((s) => s.lang)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <>
      <CartSync />
      <RouterProvider router={router} />
      <Toasts />
    </>
  )
}
