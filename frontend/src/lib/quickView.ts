import { useCallback, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

export const QUICK_VIEW_PARAM = 'product'

export interface QuickViewState {
  quickView?: boolean
}

/**
 * Opens the product window on top of the current page. The slug lives in the URL so the window can be shared
 * and the browser Back button closes it.
 */
export function useOpenQuickView() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (slug: string) => {
      const params = new URLSearchParams(location.search)
      params.set(QUICK_VIEW_PARAM, slug)
      navigate({ pathname: location.pathname, search: `?${params}` }, { state: { quickView: true } satisfies QuickViewState, preventScrollReset: true })
    },
    [navigate, location.pathname, location.search],
  )
}

/** Plain left clicks open the window; ctrl/cmd/middle clicks keep the link behaviour (full page in a new tab). */
export function isPlainClick(e: MouseEvent) {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
