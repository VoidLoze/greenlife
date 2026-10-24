import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { cartApi } from '@/api/endpoints'
import type { DeliveryMethod } from '@/api/types'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'

/**
 * Server-side pricing of the current cart. The server is the single source of truth for prices, partner tier,
 * stock caps and delivery fees, so the UI never computes totals on its own.
 */
export function useQuote(deliveryMethod: DeliveryMethod = 'PICKUP', enabled = true) {
  const lines = useCartStore((s) => s.lines)
  const userKey = useAuthStore((s) => (s.user ? `${s.user.id}:${s.user.partner}:${s.user.role}` : 'anon'))
  return useQuery({
    queryKey: ['quote', lines, deliveryMethod, userKey],
    queryFn: () => cartApi.quote(lines, deliveryMethod),
    enabled: enabled && lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useIsPartner() {
  return useAuthStore((s) => !!s.user && s.user.partner && s.user.enabled)
}
