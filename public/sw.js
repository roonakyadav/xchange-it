// Service Worker for Xchange PWA
const CACHE_NAME = 'xchange-v1.0.0'
const STATIC_CACHE = 'xchange-static-v1.0.0'
const API_CACHE = 'xchange-api-v1.0.0'
const IMAGE_CACHE = 'xchange-images-v1.0.0'

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/offline.html',
    '/manifest.json',
    '/globals.css'
]

// API endpoints that benefit from stale-while-revalidate
const API_ENDPOINTS = [
    '/api/search',
    '/api/posts'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Install event')

    event.waitUntil(
        (async () => {
            const cache = await caches.open(STATIC_CACHE)
            try {
                await cache.addAll(STATIC_ASSETS)
                console.log('[SW] Static assets cached')
            } catch (error) {
                console.log('[SW] Failed to cache some static assets:', error)
            }
        })()
    )

    // Force activation
    self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event')

    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys()

            for (const cacheName of cacheNames) {
                if (cacheName !== STATIC_CACHE &&
                    cacheName !== API_CACHE &&
                    cacheName !== IMAGE_CACHE &&
                    cacheName !== CACHE_NAME) {
                    await caches.delete(cacheName)
                    console.log('[SW] Deleted old cache:', cacheName)
                }
            }

            // Take control of all clients
            await self.clients.claim()
        })()
    )
})

// Fetch event - implement different caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests
    if (request.method !== 'GET') return

    // Skip external requests
    if (!url.origin.includes(self.location.origin) &&
        !url.origin.includes('supabase')) return

    // Handle different resource types
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE))
    } else if (isApiRequest(request)) {
        event.respondWith(staleWhileRevalidate(request, API_CACHE))
    } else if (isImageRequest(request)) {
        event.respondWith(cacheFirst(request, IMAGE_CACHE))
    } else {
        // For HTML pages, try network first, fallback to offline page
        event.respondWith(networkFirst(request))
    }
})

// Cache strategies
async function cacheFirst(request, cacheName) {
    try {
        const cachedResponse = await caches.match(request)
        if (cachedResponse) {
            return cachedResponse
        }

        const networkResponse = await fetch(request)
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName)
            cache.put(request, networkResponse.clone())
        }

        return networkResponse
    } catch (error) {
        console.log('[SW] Cache first failed:', error)
        return new Response('Offline', { status: 503 })
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)

    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone())
        }
        return networkResponse
    }).catch(() => {
        // Return cached response if network fails
        return cachedResponse || new Response('Offline', { status: 503 })
    })

    // Return cached response immediately if available, otherwise wait for network
    return cachedResponse || fetchPromise
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request)
        if (networkResponse.ok) {
            // Cache successful HTML responses
            const cache = await caches.open(CACHE_NAME)
            cache.put(request, networkResponse.clone())
        }
        return networkResponse
    } catch (error) {
        console.log('[SW] Network first failed:', error)

        // Try cache
        const cachedResponse = await caches.match(request)
        if (cachedResponse) {
            return cachedResponse
        }

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match('/offline.html')
            return offlineResponse || new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable'
            })
        }

        return new Response('Offline', { status: 503 })
    }
}

// Helper functions
function isStaticAsset(request) {
    const url = new URL(request.url)
    const pathname = url.pathname

    return (
        pathname.endsWith('.js') ||
        pathname.endsWith('.css') ||
        pathname.endsWith('.woff2') ||
        pathname.endsWith('.woff') ||
        pathname.endsWith('.ttf') ||
        pathname.includes('/_next/static/')
    )
}

function isApiRequest(request) {
    const url = new URL(request.url)
    return API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))
}

function isImageRequest(request) {
    const url = new URL(request.url)
    return (
        url.pathname.startsWith('/icons/') ||
        url.pathname.startsWith('/screenshots/') ||
        url.origin.includes('supabase') && (
            url.pathname.includes('/post-images/') ||
            url.pathname.includes('/avatars/')
        )
    )
}

// Background sync for offline actions (placeholder for future implementation)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag)

    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync())
    }
})

async function doBackgroundSync() {
    // Placeholder for background sync implementation
    console.log('[SW] Performing background sync')
}

// Push notifications (placeholder for future implementation)
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event)

    if (event.data) {
        const data = event.data.json()

        const options = {
            body: data.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            }
        }

        event.waitUntil(
            self.registration.showNotification(data.title || 'Xchange', options)
        )
    }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click:', event)

    event.notification.close()

    const url = event.notification.data?.url || '/'

    event.waitUntil(
        clients.openWindow(url)
    )
})

// Periodic background sync (placeholder)
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync:', event.tag)

    if (event.tag === 'content-sync') {
        event.waitUntil(syncContent())
    }
})

async function syncContent() {
    // Placeholder for content synchronization
    console.log('[SW] Syncing content')
}
