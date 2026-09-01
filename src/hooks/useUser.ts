'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'

export function useUser() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Get initial session
        const initializeUser = async () => {
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                
                if (session?.user) {
                    // Fetch user profile from public.users
                    const { data: profile, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', session.user.id)
                        .single()

                    if (error) {
                        console.error('Error fetching user profile:', error)
                    } else if (profile) {
                        setUser(profile)
                    }
                }
            } catch (error) {
                console.error('Error initializing user:', error)
            } finally {
                setLoading(false)
            }
        }

        initializeUser()

        // Listen for auth changes
        const supabase = createClient()
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                // Fetch user profile from public.users
                const { data: profile, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()

                if (error) {
                    console.error('Error fetching user profile:', error)
                    setUser(null)
                } else if (profile) {
                    setUser(profile)
                }
            } else {
                setUser(null)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const logout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        setUser(null)
        router.push('/auth')
    }

    return {
        user,
        loading,
        logout,
        isAuthenticated: !!user
    }
}
