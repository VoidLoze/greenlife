export type Role = 'USER' | 'ADMIN'
export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type MediaKind = 'PHOTO' | 'SCREENSHOT' | 'DOCUMENT' | 'VIDEO'
export type DeliveryMethod = 'PICKUP' | 'DELIVERY'
export type PaymentMethod = 'CASH' | 'KASPI' | 'CARD_TRANSFER'
export type PriceTier = 'RETAIL' | 'PARTNER'
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED'
export type SortOption = 'relevance' | 'popular' | 'price_asc' | 'price_desc' | 'newest' | 'name'

export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface ApiProblem {
  status: number
  code: string
  detail: string
  errors?: Record<string, string>
  details?: string[]
}

export interface User {
  id: number
  email: string
  fullName: string
  phone: string | null
  role: Role
  partner: boolean
  enabled: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  expiresAt: string
  user: User
}

export interface PublicSettings {
  storeName: string
  phone: string
  whatsapp: string
  telegramUrl: string
  instagramUrl: string
  city: string
  address: string
  workingHours: string
  deliveryFee: number
  freeDeliveryThreshold: number
  /** Only retail-price orders earn free delivery; partners get it on the day they buy the card. */
  freeDeliveryRetailOnly: boolean
  partnerDiscountPercent: number
  maxQuantityPerItem: number
  companyVideoUrl: string | null
  companyVideoTitle: string | null
}

export interface Category {
  id: number
  slug: string
  nameRu: string
  nameKk: string | null
  descriptionRu: string | null
  descriptionKk: string | null
  icon: string | null
  sortOrder: number
  productCount: number
  types: ProductType[]
}

/** Second catalog level inside a category (e.g. «Уход за волосами» → «Шампуни»). */
export interface ProductType {
  slug: string
  nameRu: string
  nameKk: string | null
  productCount: number
}

export interface TypeRef {
  slug: string
  nameRu: string
  nameKk: string | null
  categorySlug: string
}

export interface Brand {
  id: number
  slug: string
  name: string
  description: string | null
  productCount: number
}

export interface CategoryRef {
  slug: string
  nameRu: string
  nameKk: string | null
}

export interface BrandRef {
  slug: string
  name: string
}

export interface GiftPick {
  product: ProductCard | null
  /** Picked from the shopper's own purchases rather than at random. */
  personal: boolean
}

export interface ProductCard {
  id: number
  slug: string
  sku: string
  nameRu: string
  nameKk: string | null
  summaryRu: string | null
  summaryKk: string | null
  brand: BrandRef | null
  category: CategoryRef | null
  type: TypeRef | null
  price: number | null
  partnerPrice: number | null
  oldPrice: number | null
  currency: string
  volume: string | null
  badge: string | null
  imageUrl: string | null
  thumbUrl: string | null
  inStock: boolean
  lowStock: boolean
  featured: boolean
  status: ProductStatus
}

export interface Media {
  id: number
  kind: MediaKind
  url: string
  thumbUrl: string | null
  title: string | null
  description: string | null
  altText: string | null
  contentType: string
  sizeBytes: number
  width: number | null
  height: number | null
  originalFilename: string | null
  cover: boolean
  sortOrder: number
}

export interface Benefit {
  textRu: string
  textKk: string | null
}

export interface Attribute {
  nameRu: string
  valueRu: string
  nameKk: string | null
  valueKk: string | null
}

export interface ProductDetail {
  card: ProductCard
  descriptionRu: string | null
  descriptionKk: string | null
  usageRu: string | null
  usageKk: string | null
  composition: string | null
  warningsRu: string | null
  warningsKk: string | null
  benefits: Benefit[]
  attributes: Attribute[]
  photos: Media[]
  screenshots: Media[]
  documents: Media[]
  videos: Media[]
  videoUrl: string | null
  catalogPage: number | null
  stockQuantity: number | null
  updatedAt: string
}

export interface SearchResponse extends Page<ProductCard> {
  correctedQuery: string | null
}

export interface FacetValue {
  slug: string
  count: number
}

/** Fixed price band (inclusive bounds, null = open end) with the product count under the current filters. */
export interface PriceBucket {
  min: number | null
  max: number | null
  count: number
}

export interface Facets {
  categories: FacetValue[]
  types: FacetValue[]
  brands: FacetValue[]
  priceBuckets: PriceBucket[]
  priceMin: number | null
  priceMax: number | null
  total: number
}

export interface SuggestItem {
  slug: string
  nameRu: string
  nameKk: string | null
  thumbUrl: string | null
  price: number | null
  partnerPrice: number | null
  brand: string | null
  volume: string | null
  categoryNameRu: string | null
  categoryNameKk: string | null
}

export interface Suggestions {
  products: SuggestItem[]
  total: number
  categories: CategoryRef[]
  types: TypeRef[]
  brands: BrandRef[]
  popularQueries: string[]
  correctedQuery: string | null
}

export interface Related {
  boughtTogether: ProductCard[]
  similar: ProductCard[]
}

export interface Home {
  featured: ProductCard[]
  bestsellers: ProductCard[]
  newest: ProductCard[]
  categories: Category[]
  productCount: number
}

export interface CartLine {
  productId: number
  quantity: number
}

export interface CartWarning {
  productId: number
  code: string
  message: string
}

export interface QuoteLine {
  productId: number
  slug: string
  sku: string
  nameRu: string
  nameKk: string | null
  volume: string | null
  thumbUrl: string | null
  unitPrice: number
  retailPrice: number
  oldPrice: number | null
  quantity: number
  maxQuantity: number
  lineTotal: number
  lineSavings: number
}

export interface Quote {
  tier: PriceTier
  items: QuoteLine[]
  itemsCount: number
  itemsTotal: number
  retailTotal: number
  savings: number
  deliveryMethod: DeliveryMethod
  deliveryFee: number
  /** null — this order cannot earn free delivery (partner prices). */
  freeDeliveryThreshold: number | null
  amountToFreeDelivery: number
  total: number
  currency: string
  warnings: CartWarning[]
}

export interface OrderItem {
  productId: number | null
  sku: string
  productName: string
  imageUrl: string | null
  unitPrice: number
  retailPrice: number
  quantity: number
  lineTotal: number
}

export interface StatusChange {
  status: OrderStatus
  label: string
  note: string | null
  createdAt: string
}

export interface Order {
  id: number
  number: string
  status: OrderStatus
  statusLabel: string
  nextStatuses: OrderStatus[]
  userId: number | null
  customerName: string
  phone: string
  email: string | null
  city: string | null
  address: string | null
  comment: string | null
  deliveryMethod: DeliveryMethod
  paymentMethod: PaymentMethod
  priceTier: PriceTier
  itemsTotal: number
  savingsTotal: number
  deliveryFee: number
  total: number
  currency: string
  itemsCount: number
  items: OrderItem[]
  history: StatusChange[]
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderSummary {
  id: number
  number: string
  status: OrderStatus
  statusLabel: string
  customerName: string
  phone: string
  deliveryMethod: DeliveryMethod
  priceTier: PriceTier
  total: number
  itemsCount: number
  createdAt: string
}

export interface CheckoutRequest {
  customerName: string
  phone: string
  email?: string
  city?: string
  address?: string
  comment?: string
  deliveryMethod: DeliveryMethod
  paymentMethod: PaymentMethod
  items: CartLine[]
  expectedTotal: number
  website?: string
  consent: boolean
  idempotencyKey: string
}

export interface CheckoutResponse {
  order: Order
  whatsappUrl: string
}
