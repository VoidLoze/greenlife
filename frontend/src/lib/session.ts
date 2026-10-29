import type { DeliveryMethod, PaymentMethod } from '@/api/types'
import { useCartStore } from '@/store/cart'
import { useFavoritesStore } from '@/store/favorites'
import { queryClient } from './queryClient'

export interface SavedContact {
  customerName: string
  phone: string
  email: string
  city: string
  address: string
  deliveryMethod: DeliveryMethod
  paymentMethod: PaymentMethod
}

const LEGACY_CONTACT_PREFIX = 'gl-checkout-contact'
const GUEST_CONTACT_KEY = 'gl-guest-contact'
const ORDER_RECEIPT_PREFIX = 'gl-order-'

/**
 * A guest's details are remembered only for the current tab, so nothing personal outlives the visit on a shared
 * device. Signed-in shoppers are prefilled from their last order on the server instead.
 */
export function loadGuestContact(): Partial<SavedContact> {
  try {
    return JSON.parse(sessionStorage.getItem(GUEST_CONTACT_KEY) ?? '{}') as Partial<SavedContact>
  } catch {
    return {}
  }
}

export function saveGuestContact(contact: SavedContact) {
  sessionStorage.setItem(GUEST_CONTACT_KEY, JSON.stringify(contact))
}

export function saveOrderReceipt(number: string, receipt: unknown) {
  sessionStorage.setItem(`${ORDER_RECEIPT_PREFIX}${number}`, JSON.stringify(receipt))
}

export function loadOrderReceipt<T>(number: string): T | null {
  try {
    const raw = sessionStorage.getItem(`${ORDER_RECEIPT_PREFIX}${number}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function clearTabData() {
  migrateLegacyStorage()
  for (const key of Object.keys(sessionStorage)) {
    if (key === GUEST_CONTACT_KEY || key.startsWith(ORDER_RECEIPT_PREFIX)) sessionStorage.removeItem(key)
  }
}

const PRIVATE_QUERIES = new Set(['admin', 'my-orders', 'my-order', 'my-order-wa', 'quote', 'gift-pick'])

/**
 * Runs synchronously on every change of the signed-in account, before the UI re-renders:
 * an account that leaves takes its cart, favourites, recently viewed, contacts, receipts and private queries with it
 * (cart and lists stay saved on the server and come back on the next login); a guest's details are never prefilled
 * into an account.
 */
export function onAccountChange(previousUserId: number | null, nextUserId: number | null) {
  if (previousUserId === nextUserId) return
  if (previousUserId != null) {
    clearTabData()
    useCartStore.getState().clear()
    useCartStore.getState().closeDrawer()
    useFavoritesStore.getState().clear()
    queryClient.removeQueries({ predicate: (q) => PRIVATE_QUERIES.has(String(q.queryKey[0])) })
  }
  if (nextUserId != null) sessionStorage.removeItem(GUEST_CONTACT_KEY)
}

/** Earlier versions kept checkout contacts in localStorage. */
export function migrateLegacyStorage() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(LEGACY_CONTACT_PREFIX)) localStorage.removeItem(key)
  }
}
