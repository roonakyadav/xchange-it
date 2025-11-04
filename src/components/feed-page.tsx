'use client'

import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomNav } from '@/components/bottom-nav'
import { PostCard } from '@/components/post-card'
import type { Post } from '@/lib/types'

async function fetchPosts({ pageParam, type }: { pageParam: string | null; type: string }) {
    const params = new URLSearchParams()
    if (type !== 'all') params.set('type', type)
    if (pageParam) params.set('cursor', pageParam)

    const response = await fetch(`/api/posts?${params}`)
    if (!response.ok) throw new Error('Failed to fetch posts')
    return response.json()
}

function PostSkeleton() {
    return (
        <div className="p-4 border-b border-border">
            <div className="flex items-start space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </div>
        </div>
    )
}

export function FeedPage() {
    const [activeTab, setActiveTab] = useState('all')

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error,
    } = useInfiniteQuery({
        queryKey: ['posts', activeTab],
        queryFn: ({ pageParam }) => fetchPosts({ pageParam, type: activeTab }),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    })

    const posts = data?.pages.flatMap(page => page.posts) || []

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3">
                    <h1 className="text-xl font-bold text-accent">Xchange</h1>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="listing">Listings</TabsTrigger>
                        <TabsTrigger value="request">Requests</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="pb-20">
                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <PostSkeleton key={i} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="p-4 text-center text-destructive">
                        Failed to load posts. Please try again.
                    </div>
                ) : posts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        No posts found.
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {posts.map((post: Post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                        {isFetchingNextPage && (
                            <div className="space-y-4 p-4">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <PostSkeleton key={i} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {hasNextPage && !isFetchingNextPage && (
                    <div className="p-4 text-center">
                        <button
                            onClick={() => fetchNextPage()}
                            className="text-accent hover:underline"
                        >
                            Load more
                        </button>
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    )
}
