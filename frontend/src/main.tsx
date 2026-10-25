import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { clearReloadFlag, reloadOnceForNewVersion } from './components/RouteError'
import { setupPwa } from './lib/pwa'
import { queryClient } from './lib/queryClient'
import './styles/base.css'
import './styles/store.css'

// The app restores scroll itself (Layout): the browser's own restoration fights with lazily loaded pages.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

setupPwa()

window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault()
})
// A page that stayed up for a while has loaded fine: a later deploy may reload it once again.
window.setTimeout(clearReloadFlag, 30_000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
