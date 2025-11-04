// PWA utilities for service worker registration and management

export function registerServiceWorker() {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                })

                console.log('[PWA] Service Worker registered:', registration.scope)

                // Handle updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New version available
                                console.log('[PWA] New version available')

                                // Optional: Show update prompt
                                if (confirm('A new version of Xchange is available. Reload to update?')) {
                                    window.location.reload()
                                }
                            }
                        })
                    }
                })

                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    console.log('[PWA] Message from SW:', event.data)
                })

            } catch (error) {
                console.error('[PWA] Service Worker registration failed:', error)
            }
        })
    } else {
        console.warn('[PWA] Service Workers not supported')
    }
}

export function unregisterServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister()
                console.log('[PWA] Service Worker unregistered')
            }
        })
    }
}

export function isPWAInstalled(): boolean {
    if (typeof window === 'undefined') return false

    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isInWebAppiOS = (window.navigator as any).standalone === true

    return isStandalone || isInWebAppiOS
}

export function isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export function addOnlineOfflineListeners(
    onOnline?: () => void,
    onOffline?: () => void
) {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
        console.log('[PWA] Online')
        onOnline?.()
    }

    const handleOffline = () => {
        console.log('[PWA] Offline')
        onOffline?.()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
    }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.warn('[PWA] Notifications not supported')
        return 'denied'
    }

    if (Notification.permission === 'granted') {
        return 'granted'
    }

    if (Notification.permission === 'denied') {
        return 'denied'
    }

    const permission = await Notification.requestPermission()
    return permission
}

// Send message to service worker
export function sendMessageToSW(message: any) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(message)
    }
}

// Check for app updates
export async function checkForUpdates() {
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
            await registration.update()
            console.log('[PWA] Checked for updates')
        }
    }
}
