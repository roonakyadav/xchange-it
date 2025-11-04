'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useUIStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomNav } from '@/components/bottom-nav'
import { PostCard } from '@/components/post-card'
import { toast } from 'sonner'
import {
    ArrowLeft,
    MapPin,
    Link as LinkIcon,
    MessageCircle,
    Flag,
    Heart,
    Package,
    ShoppingCart,
    Bookmark,
    ExternalLink
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { Profile, Post, WishlistItem } from '@/lib/types'

interface ProfilePageProps {
    profile: Profile
    stats: {
        posts: number
        listings: number
        requests: number
        wishlist: number
    }
    initialTab: string
    initialPosts: Post[]
    initialWishlist: WishlistItem[]
}

export function ProfilePage({
    profile,
    stats,
    initialTab,
    initialPosts,
    initialWishlist
}: ProfilePageProps) {
    const router = useRouter()
    const { user } = useAuthStore()
    const { setAuthModalOpen } = useUIStore()
    const [activeTab, setActiveTab] = useState(initialTab)

    // Posts query
    const { data: postsData, isLoading: postsLoading } = useQuery({
        queryKey: ['user-posts', profile.id, activeTab],
        queryFn: async () => {
            if (activeTab === 'wishlist') return null

            const type = activeTab === 'listings' ? 'listing' :
                activeTab === 'requests' ? 'request' : undefined

            const params = new URLSearchParams()
            if (type) params.set('type', type)

            const response = await fetch(`/api/posts?userId=${profile.id}&${params}`)
            if (!response.ok) throw new Error('Failed to fetch posts')
            return response.json()
        },
        initialData: activeTab !== 'wishlist' ? { posts: initialPosts } : null,
        enabled: activeTab !== 'wishlist',
    })

    // Wishlist query
    const { data: wishlistData, isLoading: wishlistLoading } = useQuery({
        queryKey: ['user-wishlist', profile.id],
        queryFn: async () => {
            const response = await fetch(`/api/wishlist?userId=${profile.id}`)
            if (!response.ok) throw new Error('Failed to fetch wishlist')
            return response.json()
        },
        initialData: activeTab === 'wishlist' ? { wishlist: initialWishlist } : null,
        enabled: activeTab === 'wishlist',
    })

    const handleMessage = () => {
        if (!user) {
            setAuthModalOpen(true)
            return
        }

        // TODO: Create chat with user
        toast.info('Messaging feature coming soon')
    }

    const handleReport = () => {
        if (!user) {
            setAuthModalOpen(true)
            return
        }

        // TODO: Report user
        toast.info('Report feature coming soon')
    }

    const posts = postsData?.posts || []
    const wishlist = wishlistData?.wishlist || []

    const isOwnProfile = user?.id === profile.id

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="p-2"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-semibold">Profile</h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="pb-20">
                {/* Profile Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="p-4 border-b border-border"
                >
                    <div className="flex items-start space-x-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={profile.avatar_url || undefined} alt={profile.username || undefined} />
                            <AvatarFallback className="text-2xl">
                                {(profile.username || profile.full_name || 'U').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                                <h2 className="text-xl font-bold">{profile.full_name || profile.username}</h2>
                                {!isOwnProfile && (
                                    <div className="flex space-x-2">
                                        <Button size="sm" onClick={handleMessage} className="h-8">
                                            <MessageCircle className="h-4 w-4 mr-1" />
                                            Message
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleReport} className="h-8">
                                            <Flag className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <p className="text-muted-foreground mb-2">@{profile.username}</p>

                            {profile.bio && (
                                <p className="text-sm mb-3 whitespace-pre-wrap">{profile.bio}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                                {profile.location && (
                                    <div className="flex items-center">
                                        <MapPin className="h-4 w-4 mr-1" />
                                        {profile.location}
                                    </div>
                                )}

                                {profile.links?.website && (
                                    <a
                                        href={profile.links.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center hover:text-accent transition-colors"
                                    >
                                        <LinkIcon className="h-4 w-4 mr-1" />
                                        Website
                                        <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                )}

                                {profile.links?.twitter && (
                                    <a
                                        href={`https://twitter.com/${profile.links.twitter.replace('@', '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center hover:text-accent transition-colors"
                                    >
                                        <LinkIcon className="h-4 w-4 mr-1" />
                                        Twitter
                                        <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                )}

                                {profile.links?.github && (
                                    <a
                                        href={`https://github.com/${profile.links.github}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center hover:text-accent transition-colors"
                                    >
                                        <LinkIcon className="h-4 w-4 mr-1" />
                                        GitHub
                                        <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                )}

                                {profile.links?.telegram && (
                                    <a
                                        href={`https://t.me/${profile.links.telegram.replace('@', '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center hover:text-accent transition-colors"
                                    >
                                        <LinkIcon className="h-4 w-4 mr-1" />
                                        Telegram
                                        <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="flex space-x-6">
                                <div className="text-center">
                                    <div className="font-bold text-lg">{stats.posts}</div>
                                    <div className="text-xs text-muted-foreground">Posts</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-lg">{stats.listings}</div>
                                    <div className="text-xs text-muted-foreground">Listings</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-lg">{stats.requests}</div>
                                    <div className="text-xs text-muted-foreground">Requests</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-lg">{stats.wishlist}</div>
                                    <div className="text-xs text-muted-foreground">Saved</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mx-4 mt-4">
                        <TabsTrigger value="posts" className="flex items-center space-x-1">
                            <Package className="h-4 w-4" />
                            <span className="hidden sm:inline">Posts</span>
                        </TabsTrigger>
                        <TabsTrigger value="listings" className="flex items-center space-x-1">
                            <ShoppingCart className="h-4 w-4" />
                            <span className="hidden sm:inline">Listings</span>
                        </TabsTrigger>
                        <TabsTrigger value="requests" className="flex items-center space-x-1">
                            <Heart className="h-4 w-4" />
                            <span className="hidden sm:inline">Requests</span>
                        </TabsTrigger>
                        <TabsTrigger value="wishlist" className="flex items-center space-x-1">
                            <Bookmark className="h-4 w-4" />
                            <span className="hidden sm:inline">Saved</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Posts Tab */}
                    <TabsContent value="posts" className="mt-4">
                        <PostsTab posts={posts} loading={postsLoading} />
                    </TabsContent>

                    {/* Listings Tab */}
                    <TabsContent value="listings" className="mt-4">
                        <PostsTab posts={posts} loading={postsLoading} />
                    </TabsContent>

                    {/* Requests Tab */}
                    <TabsContent value="requests" className="mt-4">
                        <PostsTab posts={posts} loading={postsLoading} />
                    </TabsContent>

                    {/* Wishlist Tab */}
                    <TabsContent value="wishlist" className="mt-4">
                        <WishlistTab wishlist={wishlist} loading={wishlistLoading} />
                    </TabsContent>
                </Tabs>
            </div>

            <BottomNav />
        </div>
    )
}

function PostsTab({ posts, loading }: { posts: Post[]; loading: boolean }) {
    if (loading) {
        return (
            <div className="space-y-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4">
                            <div className="flex space-x-3">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (posts.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-12">
                No posts found.
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {posts.map((post) => (
                <PostCard key={post.id} post={post} />
            ))}
        </div>
    )
}

function WishlistTab({ wishlist, loading }: { wishlist: WishlistItem[]; loading: boolean }) {
    if (loading) {
        return (
            <div className="space-y-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4">
                            <div className="flex space-x-3">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (wishlist.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-12">
                No saved posts.
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {wishlist.map((item) => (
                <PostCard key={item.id} post={item.posts} />
            ))}
        </div>
    )
}
