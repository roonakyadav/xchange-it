import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ProfilePage } from '@/components/profile-page'
import type { Profile, Post, WishlistItem } from '@/lib/types'

interface PageProps {
    params: Promise<{ username: string }>
    searchParams: Promise<{ tab?: string }>
}

async function getProfile(username: string) {
    const supabase = await createServerSupabaseClient()

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single()

    if (error || !profile) {
        return null
    }

    return profile as Profile
}

async function getUserPosts(userId: string, type?: 'listing' | 'request', cursor?: string) {
    const supabase = await createServerSupabaseClient()

    let query = supabase
        .from('posts')
        .select(`
      *,
      profiles (
        username,
        full_name,
        avatar_url
      )
    `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)

    if (type) {
        query = query.eq('type', type)
    }

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data: posts, error } = await query

    if (error) {
        console.error('Error fetching user posts:', error)
        return []
    }

    return posts as Post[]
}

async function getUserWishlist(userId: string, cursor?: string) {
    const supabase = await createServerSupabaseClient()

    let query = supabase
        .from('wishlist')
        .select(`
      *,
      posts (
        *,
        profiles (
          username,
          full_name,
          avatar_url
        )
      )
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data: wishlist, error } = await query

    if (error) {
        console.error('Error fetching user wishlist:', error)
        return []
    }

    return wishlist as WishlistItem[]
}

async function getUserStats(userId: string) {
    const supabase = await createServerSupabaseClient()

    const [postsResult, wishlistResult] = await Promise.all([
        supabase
            .from('posts')
            .select('type', { count: 'exact' })
            .eq('user_id', userId)
            .eq('is_active', true),
        supabase
            .from('wishlist')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
    ])

    const posts = postsResult.data || []
    const wishlistCount = wishlistResult.count || 0

    const listings = posts.filter(p => p.type === 'listing').length
    const requests = posts.filter(p => p.type === 'request').length

    return {
        posts: posts.length,
        listings,
        requests,
        wishlist: wishlistCount
    }
}

export async function generateMetadata({ params }: PageProps) {
    const { username } = await params
    const profile = await getProfile(username)

    if (!profile) {
        return {
            title: 'Profile Not Found',
        }
    }

    return {
        title: `${profile.full_name || profile.username} (@${profile.username}) - Xchange`,
        description: profile.bio || `View ${profile.full_name || profile.username}'s profile on Xchange`,
        openGraph: {
            title: `${profile.full_name || profile.username} (@${profile.username})`,
            description: profile.bio || `View ${profile.full_name || profile.username}'s profile on Xchange`,
            images: profile.avatar_url ? [profile.avatar_url] : [],
        },
    }
}

export default async function UserProfilePage({ params, searchParams }: PageProps) {
    const { username } = await params
    const { tab = 'posts' } = await searchParams

    const profile = await getProfile(username)

    if (!profile) {
        notFound()
    }

    const stats = await getUserStats(profile.id)

    let posts: Post[] = []
    let wishlist: WishlistItem[] = []

    if (tab === 'posts') {
        posts = await getUserPosts(profile.id)
    } else if (tab === 'listings') {
        posts = await getUserPosts(profile.id, 'listing')
    } else if (tab === 'requests') {
        posts = await getUserPosts(profile.id, 'request')
    } else if (tab === 'wishlist') {
        wishlist = await getUserWishlist(profile.id)
    }

    return (
        <ProfilePage
            profile={profile}
            stats={stats}
            initialTab={tab}
            initialPosts={posts}
            initialWishlist={wishlist}
        />
    )
}
