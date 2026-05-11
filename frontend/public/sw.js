const CACHE_NAME = 'lexisync-v4'
const RUNTIME_CACHE = 'lexisync-runtime-v4'

const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/study',
  '/words',
  '/settings',
  '/profile',
  '/login',
  '/register',
  '/manifest.json',
  '/icon-192.svg',
]

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isNextAsset(url) {
  return url.pathname.startsWith('/_next/')
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed (some pages may need auth):', err.message)
      })
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  if (isApiRequest(url)) return

  if (isNextAsset(url)) {
    // Prefer fresh assets after deploy while keeping offline fallback.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Navigation requests should be network-first to avoid stale UI in mobile PWA.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          return caches.match('/dashboard')
        })
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response

          const clone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/dashboard')
          }
          return new Response('Offline', { status: 503 })
        })
    })
  )
})
