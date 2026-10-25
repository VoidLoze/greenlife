import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'
import { useT } from '@/i18n'

const RELOAD_FLAG = 'gl-chunk-reload'

/** After a deploy the old page asks for script files that no longer exist; one reload fetches the new ones. */
export function isStaleBundleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically|Unable to preload CSS/i.test(message)
}

export function reloadOnceForNewVersion() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return false
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  window.location.reload()
  return true
}

export function clearReloadFlag() {
  sessionStorage.removeItem(RELOAD_FLAG)
}

export function RouteError() {
  const error = useRouteError()
  const { t } = useT()
  const stale = isStaleBundleError(error)

  useEffect(() => {
    if (stale) reloadOnceForNewVersion()
    else console.error(error)
  }, [error, stale])

  return (
    <div className="container" style={{ padding: '80px 20px' }}>
      <div className="empty">
        <div className="empty-icon">🌿</div>
        <h3>{stale ? t.siteUpdated : t.somethingWrong}</h3>
        <p className="muted">{stale ? t.siteUpdatedHint : t.somethingWrongHint}</p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              clearReloadFlag()
              window.location.reload()
            }}
          >
            {t.reloadPage}
          </button>
          <Link to="/" className="btn btn-ghost" reloadDocument>
            {t.home}
          </Link>
        </div>
      </div>
    </div>
  )
}
