'use client'

import { useState } from 'react'

interface ClientOnlyProps {
    children: React.ReactNode
    fallback?: React.ReactNode
}

export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
    const [hasMounted] = useState(() => typeof window !== 'undefined')

    if (!hasMounted) {
        return <>{fallback}</>
    }

    return <>{children}</>
}
