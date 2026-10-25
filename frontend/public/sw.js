// Speeds up repeat visits only: pages and /api always go to the network, so prices, stock and orders stay live.
const ASSETS = 'gl-assets-v1'
const IMAGES = 'gl-images-v1'
const LIMITS = { [ASSETS]: 120, [IMAGES]: 300 }

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (!(key in LIMITS)) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

async function trim(name) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  for (const request of keys.slice(0, Math.max(0, keys.length - LIMITS[name]))) await cache.delete(request)
}

async function put(name, request, response) {
  if (!response.ok || response.status !== 200) return
  const cache = await caches.open(name)
  await cache.put(request, response)
  await trim(name)
}

// Build files carry a content hash in the name, so a cached copy never goes stale.
async function cacheFirst(event) {
  const cached = await caches.match(event.request, { cacheName: ASSETS })
  if (cached) return cached
  const response = await fetch(event.request)
  event.waitUntil(put(ASSETS, event.request, response.clone()))
  return response
}

// Product photos show instantly from the cache and refresh in the background.
async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request, { cacheName: IMAGES })
  const network = fetch(event.request).then((response) => {
    event.waitUntil(put(IMAGES, event.request, response.clone()))
    return response
  })
  if (cached) {
    event.waitUntil(network.catch(() => undefined))
    return cached
  }
  return network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event))
  } else if (url.pathname.startsWith('/uploads/') && /\.(webp|png|jpe?g|gif)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event))
  }
})
