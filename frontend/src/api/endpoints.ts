import { api } from './client'
import type {
  AuthResponse,
  Brand,
  CartLine,
  Category,
  CheckoutRequest,
  CheckoutResponse,
  DeliveryMethod,
  Facets,
  GiftPick,
  Home,
  Order,
  OrderSummary,
  Page,
  ProductDetail,
  ProductCard,
  PublicSettings,
  Quote,
  Related,
  SearchResponse,
  Suggestions,
  User,
} from './types'

export interface CatalogFilters {
  q?: string
  category?: string[]
  type?: string[]
  brand?: string[]
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  featured?: boolean
  sort?: string
  page?: number
  size?: number
}

function catalogParams(f: CatalogFilters) {
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  f.category?.forEach((c) => params.append('category', c))
  f.type?.forEach((t) => params.append('type', t))
  f.brand?.forEach((b) => params.append('brand', b))
  if (f.minPrice != null) params.set('minPrice', String(f.minPrice))
  if (f.maxPrice != null) params.set('maxPrice', String(f.maxPrice))
  if (f.inStock) params.set('inStock', 'true')
  if (f.featured) params.set('featured', 'true')
  if (f.sort) params.set('sort', f.sort)
  if (f.page) params.set('page', String(f.page))
  if (f.size) params.set('size', String(f.size))
  return params
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const settingsApi = {
  get: () => data(api.get<PublicSettings>('/settings/public')),
}

export const catalogApi = {
  home: () => data(api.get<Home>('/catalog/home')),
  categories: () => data(api.get<Category[]>('/catalog/categories')),
  brands: () => data(api.get<Brand[]>('/catalog/brands')),
  search: (f: CatalogFilters) => data(api.get<SearchResponse>('/catalog/products', { params: catalogParams(f) })),
  facets: (f: CatalogFilters) =>
    data(api.get<Facets>('/catalog/facets', { params: catalogParams({ ...f, page: undefined, size: undefined, sort: undefined }) })),
  suggest: (q: string) => data(api.get<Suggestions>('/catalog/suggest', { params: { q } })),
  product: (slug: string) => data(api.get<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`)),
  related: (slug: string) => data(api.get<Related>(`/catalog/products/${encodeURIComponent(slug)}/related`)),
  view: (slug: string) => api.post(`/catalog/products/${encodeURIComponent(slug)}/view`).catch(() => undefined),
  giftPick: () => data(api.get<GiftPick>('/catalog/gift-pick')),
  cards: (ids: number[]) => data(api.get<ProductCard[]>('/catalog/cards', { params: { ids: ids.join(',') } })),
}

export const authApi = {
  login: (email: string, password: string) => data(api.post<AuthResponse>('/auth/login', { email, password })),
  register: (body: { email: string; password: string; fullName: string; phone?: string; consent: boolean }) =>
    data(api.post<AuthResponse>('/auth/register', body)),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  me: () => data(api.get<User>('/auth/me')),
  updateProfile: (body: { fullName: string; phone?: string }) => data(api.patch<User>('/account/profile', body)),
  changePassword: (currentPassword: string, newPassword: string) =>
    data(api.post<AuthResponse>('/account/password', { currentPassword, newPassword })),
}

export const cartApi = {
  quote: (items: CartLine[], deliveryMethod?: DeliveryMethod) =>
    data(api.post<Quote>('/cart/quote', { items, deliveryMethod })),
  replace: (items: CartLine[]) => data(api.put<Quote>('/cart', { items })),
  merge: (items: CartLine[]) => data(api.post<Quote>('/cart/merge', { items })),
  current: () => data(api.get<Quote>('/cart')),
}

export const ordersApi = {
  checkout: (body: CheckoutRequest) => data(api.post<CheckoutResponse>('/orders', body)),
  mine: (page = 0) => data(api.get<Page<OrderSummary>>('/orders/my', { params: { page, size: 10 } })),
  myOrder: (number: string) => data(api.get<Order>(`/orders/my/${encodeURIComponent(number)}`)),
  whatsapp: (number: string) => data(api.get<{ url: string }>(`/orders/my/${encodeURIComponent(number)}/whatsapp`)),
  track: (number: string, phone: string) =>
    data(api.post<Order>('/orders/track', { number: number.trim(), phone })),
}
