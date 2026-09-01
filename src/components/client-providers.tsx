'use client'

import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function ClientProviders({
    children,
}: {
    children: React.ReactNode
}) {
    useEffect(() => {
        // Supabase Auth handles session management automatically
        // No need to manually store tokens in localStorage
        const supabase = createClient()
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            // Session changes are handled by the useUser hook
            // This listener is kept for any future side effects
        })

        return () => listener.subscription.unsubscribe()
    }, [])

    return (
        <>
            {children}
            <Toaster
                position="top-center"
                toastOptions={{
                    style: {
                        background: '#000',
                        color: '#fff',
                        border: '1px solid #333',
                    },
                }}
            />
        </>
    )
}
