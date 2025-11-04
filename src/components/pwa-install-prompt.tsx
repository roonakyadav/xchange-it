'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Download, Smartphone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[]
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed'
        platform: string
    }>
    prompt(): Promise<void>
}

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)

    useEffect(() => {
        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        const isInWebAppiOS = (window.navigator as any).standalone === true

        setIsStandalone(isStandalone || isInWebAppiOS)

        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        setIsIOS(iOS)

        // Listen for the beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)

            // Show prompt after a delay and some user interaction
            setTimeout(() => {
                const hasDismissed = localStorage.getItem('pwa-install-dismissed')
                const hasInstalled = localStorage.getItem('pwa-installed')

                if (!hasDismissed && !hasInstalled && !isStandalone) {
                    setShowPrompt(true)
                }
            }, 3000)
        }

        // Listen for successful installation
        const handleAppInstalled = () => {
            setDeferredPrompt(null)
            setShowPrompt(false)
            localStorage.setItem('pwa-installed', 'true')
            console.log('PWA was installed')
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.addEventListener('appinstalled', handleAppInstalled)

        // Show iOS install instructions if needed
        if (iOS && !isStandalone && !isInWebAppiOS) {
            const hasShownIOSPrompt = localStorage.getItem('ios-install-shown')
            if (!hasShownIOSPrompt) {
                setTimeout(() => setShowPrompt(true), 5000)
            }
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
            window.removeEventListener('appinstalled', handleAppInstalled)
        }
    }, [])

    const handleInstallClick = async () => {
        if (!deferredPrompt) return

        try {
            await deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice

            if (outcome === 'accepted') {
                localStorage.setItem('pwa-installed', 'true')
                console.log('User accepted the install prompt')
            } else {
                console.log('User dismissed the install prompt')
            }

            setDeferredPrompt(null)
            setShowPrompt(false)
        } catch (error) {
            console.error('Install prompt failed:', error)
        }
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem('pwa-install-dismissed', 'true')
    }

    const handleIOSInstall = () => {
        setShowPrompt(false)
        localStorage.setItem('ios-install-shown', 'true')
    }

    // Don't show if already installed or dismissed
    if (isStandalone) return null

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
                >
                    <Card className="bg-background border-border shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                        <Download className="h-4 w-4 text-primary-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">Install Xchange</h3>
                                        <p className="text-xs text-muted-foreground">Add to Home Screen</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDismiss}
                                    className="h-6 w-6 p-0"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>

                            {isIOS ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        Tap the share button <span className="inline-block w-5 h-5 bg-muted rounded align-middle mx-1">⎋</span>
                                        and select "Add to Home Screen"
                                    </p>
                                    <div className="flex space-x-2">
                                        <Button
                                            onClick={handleIOSInstall}
                                            size="sm"
                                            className="flex-1"
                                        >
                                            <Smartphone className="h-4 w-4 mr-2" />
                                            Got it
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-1">
                                        <Badge variant="secondary" className="text-xs">
                                            ⚡ Fast Loading
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                            📱 Offline Access
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                            🔔 Push Notifications
                                        </Badge>
                                    </div>
                                    <div className="flex space-x-2">
                                        <Button
                                            variant="outline"
                                            onClick={handleDismiss}
                                            size="sm"
                                            className="flex-1"
                                        >
                                            Not now
                                        </Button>
                                        <Button
                                            onClick={handleInstallClick}
                                            size="sm"
                                            className="flex-1"
                                        >
                                            Install
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
