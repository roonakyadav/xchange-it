'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useUser()

  useEffect(() => {
    if (loading) return

    // Check if user has seen welcome screen
    const hasSeenWelcome = localStorage.getItem('x_seen_welcome')

    if (!hasSeenWelcome) {
      router.push('/welcome')
      return
    }

    if (!user) {
      router.push('/auth')
      return
    }

    // User is logged in, redirect to feed
    router.push('/feed')
  }, [router, user, loading])

  return null
}
