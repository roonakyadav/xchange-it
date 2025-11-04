'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { onAuthStateChange } from '@/lib/auth'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        gcTime: 10 * 60 * 1000, // 10 minutes
                    },
                },
            })
    )

    const { setUser, setSession, setLoading } = useAuthStore()

    useEffect(() => {
        // Set up authentication state listener
        const { data: { subscription } } = onAuthStateChange((event, session) => {
            console.log('[Auth] State change:', event, session?.user?.id)

            if (event === 'SIGNED_IN' && session?.user) {
                setUser(session.user)
                setSession(session)
                setLoading(false)
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                setSession(null)
                setLoading(false)
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                setUser(session.user)
                setSession(session)
            }
        })

        // Check for existing session on mount
        const checkSession = async () => {
            try {
                const { getCurrentSession } = await import('@/lib/auth')
                const session = await getCurrentSession()

                if (session?.user) {
                    console.log('[Auth] Found existing session:', session.user.id)
                    setUser(session.user)
                    setSession(session)
                } else {
                    // Check for guest session in localStorage
                    const guestSession = localStorage.getItem('guest-session')
                    if (guestSession) {
                        try {
                            const { user } = JSON.parse(guestSession)
                            console.log('[Auth] Found guest session:', user.id)
                            setUser(user)
                            useAuthStore.getState().setGuest(true)
                        } catch (error) {
                            console.error('[Auth] Error parsing guest session:', error)
                            localStorage.removeItem('guest-session')
                        }
                    }
                }
            } catch (error) {
                console.error('[Auth] Error checking session:', error)
            } finally {
                setLoading(false)
            }
        }

        checkSession()

        return () => {
            subscription.unsubscribe()
        }
    }, [setUser, setSession, setLoading])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
