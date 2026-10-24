import type { AxiosProgressEvent } from 'axios'
import { api } from './client'
import type {
  Attribute,
  Media,
  MediaKind,
  Order,
  OrderStatus,
  OrderSummary,
  Page,
  ProductStatus,
  Role,
  User,
} from './types'

export interface BenefitInput {
  textRu: string
  textKk?: string | null
}

export interface AttributeInput {
  nameRu: string
  valueRu: string
  nameKk?: string | null
  valueKk?: string | null
}

export interface ProductUpsert {
  sku?: string | null
  slug?: string | null
  nameRu: string
  nameKk?: string | null
  summaryRu?: string | null
  summaryKk?: string | null
  descriptionRu?: string | null
  descriptionKk?: string | null
  usageRu?: string | null
  usageKk?: string | null
  composition?: string | null
  warningsRu?: string | null
  warningsKk?: string | null
  searchKeywords?: string | null
  categoryId?: number | null
  typeId?: number | null
  brandId?: number | null
  brandName?: string | null
  price?: number | null
  partnerPrice?: number | null
  oldPrice?: number | null
  volume?: string | null
  stockQuantity?: number | null
  status?: ProductStatus
  featured?: boolean
  badge?: string | null
  catalogPage?: number | null
  videoUrl?: string | null
  benefits?: BenefitInput[]
  attributes?: AttributeInput[]
  version?: number
}

export interface CompanyVideo {
  url: string | null
  title: string | null
  uploaded: boolean
  custom: boolean
}

export interface Completeness {
  score: number
  missing: string[]
}

export interface AdminProduct {
  id: number
  sku: string
  slug: string
  nameRu: string
  nameKk: string | null
  summaryRu: string | null
  summaryKk: string | null
  descriptionRu: string | null
  descriptionKk: string | null
  usageRu: string | null
  usageKk: string | null
  composition: string | null
  warningsRu: string | null
  warningsKk: string | null
  searchKeywords: string | null
  category: { id: number; slug: string; nameRu: string } | null
  type: { id: number; slug: string; nameRu: string } | null
  brand: { id: number; slug: string; name: string } | null
  price: number | null
  partnerPrice: number | null
  effectivePartnerPrice: number | null
  oldPrice: number | null
  currency: string
  volume: string | null
  stockQuantity: number | null
  status: ProductStatus
  featured: boolean
  badge: string | null
  catalogPage: number | null
  videoUrl: string | null
  benefits: BenefitInput[]
  attributes: AttributeInput[]
  media: Media[]
  coverUrl: string | null
  completeness: Completeness
  viewCount: number
  soldCount: number
  version: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface AdminProductListItem {
  id: number
  sku: string
  slug: string
  nameRu: string
  brandName: string | null
  categoryNameRu: string | null
  price: number | null
  partnerPrice: number | null
  stockQuantity: number | null
  status: ProductStatus
  featured: boolean
  thumbUrl: string | null
  completeness: number
  viewCount: number
  soldCount: number
  updatedAt: string
}

export interface ParsedDescription {
  summary: string | null
  benefits: string[]
  usage: string | null
  composition: string | null
  warnings: string | null
  attributes: Attribute[]
  volume: string | null
}

export interface AdminCategory {
  id: number
  slug: string
  nameRu: string
  nameKk: string | null
  descriptionRu: string | null
  descriptionKk: string | null
  icon: string | null
  sortOrder: number
  productCount: number
  types: AdminProductType[]
}

export interface AdminProductType {
  id: number
  categoryId: number
  slug: string
  nameRu: string
  nameKk: string | null
  sortOrder: number
  productCount: number
}

export interface AdminBrand {
  id: number
  slug: string
  name: string
  description: string | null
  productCount: number
}

export interface ProductStat {
  id: number
  slug: string
  nameRu: string
  thumbUrl: string | null
  value: number
  stockQuantity: number | null
}

export interface Dashboard {
  counters: {
    productsPublished: number
    productsDraft: number
    productsArchived: number
    productsWithoutPhoto: number
    ordersNew: number
    ordersInProgress: number
    ordersTotal: number
    users: number
    partners: number
  }
  last30Days: { revenue: number; orders: number; averageCheck: number; previousRevenue: number; previousOrders: number }
  daily: { date: string; orders: number; revenue: number }[]
  topSold: ProductStat[]
  topViewed: ProductStat[]
  lowStock: ProductStat[]
  recentOrders: OrderSummary[]
  popularSearches: string[]
}

export interface ProductListFilter {
  q?: string
  status?: ProductStatus | ''
  categoryId?: number | ''
  brandId?: number | ''
  lowStock?: boolean
  noPhoto?: boolean
  sort?: string
  page?: number
  size?: number
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== false))

export const adminApi = {
  dashboard: () => data(api.get<Dashboard>('/admin/dashboard')),

  products: (f: ProductListFilter) => data(api.get<Page<AdminProductListItem>>('/admin/products', { params: clean(f) })),
  product: (id: number) => data(api.get<AdminProduct>(`/admin/products/${id}`)),
  createProduct: (body: ProductUpsert) => data(api.post<AdminProduct>('/admin/products', body)),
  updateProduct: (id: number, body: ProductUpsert) => data(api.put<AdminProduct>(`/admin/products/${id}`, body)),
  setStatus: (id: number, status: ProductStatus) =>
    data(api.patch<AdminProduct>(`/admin/products/${id}/status`, { status })),
  deleteProduct: (id: number) => data(api.delete<{ archived: boolean; message: string }>(`/admin/products/${id}`)),
  duplicate: (id: number) => data(api.post<AdminProduct>(`/admin/products/${id}/duplicate`)),
  parseDescription: (text: string, name?: string) =>
    data(api.post<ParsedDescription>('/admin/products/parse-description', { text, name })),

  uploadMedia: (
    id: number,
    file: File,
    meta: { kind: MediaKind; title?: string; description?: string; altText?: string; cover?: boolean },
    onProgress?: (percent: number) => void,
  ) => {
    const form = new FormData()
    form.append('file', file)
    form.append('kind', meta.kind)
    if (meta.title) form.append('title', meta.title)
    if (meta.description) form.append('description', meta.description)
    if (meta.altText) form.append('altText', meta.altText)
    if (meta.cover) form.append('cover', 'true')
    return data(
      api.post<Media>(`/admin/products/${id}/media`, form, {
        timeout: meta.kind === 'VIDEO' ? 30 * 60_000 : 120_000,
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      }),
    )
  },
  updateMedia: (
    id: number,
    mediaId: number,
    body: { title?: string; description?: string; altText?: string; kind?: MediaKind; cover?: boolean },
  ) => data(api.patch<Media>(`/admin/products/${id}/media/${mediaId}`, body)),
  reorderMedia: (id: number, kind: MediaKind, ids: number[]) =>
    data(api.put<Media[]>(`/admin/products/${id}/media/order`, { kind, ids })),
  deleteMedia: (id: number, mediaId: number) => data(api.delete<AdminProduct>(`/admin/products/${id}/media/${mediaId}`)),

  companyVideo: () => data(api.get<CompanyVideo>('/admin/settings/company-video')),
  setCompanyVideoLink: (body: { url: string | null; title: string | null }) =>
    data(api.put<CompanyVideo>('/admin/settings/company-video', body)),
  uploadCompanyVideo: (file: File, title: string | null, onProgress?: (percent: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    if (title) form.append('title', title)
    return data(
      api.post<CompanyVideo>('/admin/settings/company-video/file', form, {
        timeout: 30 * 60_000,
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      }),
    )
  },
  resetCompanyVideo: () => data(api.delete<CompanyVideo>('/admin/settings/company-video')),

  categories: () => data(api.get<AdminCategory[]>('/admin/categories')),
  saveCategory: (body: Partial<AdminCategory>, id?: number) =>
    data(id ? api.put<AdminCategory>(`/admin/categories/${id}`, body) : api.post<AdminCategory>('/admin/categories', body)),
  deleteCategory: (id: number) => api.delete(`/admin/categories/${id}`),
  saveType: (body: Pick<AdminProductType, 'nameRu'> & Partial<AdminProductType>, id?: number, categoryId?: number) =>
    data(id ? api.put<AdminProductType>(`/admin/types/${id}`, body) : api.post<AdminProductType>(`/admin/categories/${categoryId}/types`, body)),
  deleteType: (id: number) => api.delete(`/admin/types/${id}`),

  brands: () => data(api.get<AdminBrand[]>('/admin/brands')),
  saveBrand: (body: Partial<AdminBrand>, id?: number) =>
    data(id ? api.put<AdminBrand>(`/admin/brands/${id}`, body) : api.post<AdminBrand>('/admin/brands', body)),
  deleteBrand: (id: number) => api.delete(`/admin/brands/${id}`),

  orders: (f: { q?: string; status?: OrderStatus | ''; from?: string; to?: string; page?: number }) =>
    data(api.get<Page<OrderSummary>>('/admin/orders', { params: clean(f) })),
  order: (id: number) => data(api.get<Order>(`/admin/orders/${id}`)),
  setOrderStatus: (id: number, status: OrderStatus, note?: string) =>
    data(api.patch<Order>(`/admin/orders/${id}/status`, { status, note })),
  setOrderNote: (id: number, adminNote: string) => data(api.patch<Order>(`/admin/orders/${id}/note`, { adminNote })),

  users: (f: { q?: string; role?: Role | ''; page?: number }) =>
    data(api.get<Page<User>>('/admin/users', { params: clean(f) })),
  updateUser: (id: number, body: { role?: Role; partner?: boolean; enabled?: boolean }) =>
    data(api.patch<User>(`/admin/users/${id}`, body)),
}
