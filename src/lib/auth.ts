import { createBrowserSupabaseClient } from './supabase'
import { useAuthStore } from './store'
import type { User, Session } from '@supabase/supabase-js'

export async function signInWithGoogle() {
    const supabase = createBrowserSupabaseClient()

    // Get the current origin, but handle mobile/localhost scenarios
    const getRedirectUrl = () => {
        const currentOrigin = window.location.origin

        // If we're on localhost, use localhost:3000 for consistency
        if (currentOrigin.includes('localhost')) {
            return 'http://localhost:3000/auth/callback'
        }

        // For other origins (including mobile IPs), use the current origin
        return `${currentOrigin}/auth/callback`
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: getRedirectUrl(),
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    })

    return { data, error }
}

export async function signInAnonymously() {
    const supabase = createBrowserSupabaseClient()

    try {
        const { data, error } = await supabase.auth.signInAnonymously()

        if (error) {
            // Check if anonymous sign-ins are disabled
            if (error.message?.includes('Anonymous sign-ins are disabled') ||
                error.message?.includes('anonymous sign-ins disabled')) {

                // Create local guest session
                const guestId = `guest-${crypto.randomUUID()}`
                const guestUser = {
                    id: guestId,
                    email: `guest@${guestId}.local`,
                    user_metadata: { guest: true }
                }

                // Store in localStorage for persistence
                localStorage.setItem('guest-session', JSON.stringify({
                    user: guestUser,
                    isGuest: true,
                    createdAt: new Date().toISOString()
                }))

                // Update Zustand store
                useAuthStore.getState().setUser(guestUser as unknown as User)
                useAuthStore.getState().setGuest(true)
                useAuthStore.getState().setLoading(false)

                return {
                    data: {
                        user: guestUser as unknown as User,
                        session: null
                    },
                    error: null
                }
            }
        }

        return { data, error }
    } catch (err) {
        // Fallback to guest mode on any error
        const guestId = `guest-${crypto.randomUUID()}`
        const guestUser = {
            id: guestId,
            email: `guest@${guestId}.local`,
            user_metadata: { guest: true }
        }

        localStorage.setItem('guest-session', JSON.stringify({
            user: guestUser,
            isGuest: true,
            createdAt: new Date().toISOString()
        }))

        useAuthStore.getState().setUser(guestUser as unknown as User)
        useAuthStore.getState().setGuest(true)
        useAuthStore.getState().setLoading(false)

        return {
            data: {
                user: guestUser as unknown as User,
                session: null
            },
            error: null
        }
    }
}

export async function signOut() {
    const supabase = createBrowserSupabaseClient()

    const { error } = await supabase.auth.signOut()

    return { error }
}

export async function getCurrentUser(): Promise<User | null> {
    const supabase = createBrowserSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()

    return user
}

export async function getCurrentSession(): Promise<Session | null> {
    const supabase = createBrowserSupabaseClient()

    const { data: { session } } = await supabase.auth.getSession()

    return session
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const supabase = createBrowserSupabaseClient()

    return supabase.auth.onAuthStateChange(callback)
}
