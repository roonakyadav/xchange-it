'use client'

import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

export default function ClientProviders({
    children,
}: {
    children: React.ReactNode
}) {
    useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                localStorage.setItem('sb-auth-token', session.access_token)
            }
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
