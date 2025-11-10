'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PostMenu from '@/components/PostMenu'
import EditPostModal from '@/components/EditPostModal'
import ClientOnly from '@/components/ClientOnly'
import { useUser } from '@/hooks/useUser'
import { getPostsByMode } from '@/lib/db'
import type { PostWithUser } from '@/types'

interface Post extends PostWithUser {
    category?: string
}

export default function Feed() {
    const router = useRouter()
    const { user, loading: userLoading } = useUser()
    const [posts, setPosts] = useState<Post[]>([])
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMode, setSelectedMode] = useState<'selling' | 'requesting'>('selling')
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')
    const [selectedPost, setSelectedPost] = useState<any>(null)
    const [showEditModal, setShowEditModal] = useState(false)

    useEffect(() => {
        if (userLoading) return

        fetchPosts()
    }, [router, selectedMode, user, userLoading])

    // Listen for mode changes from NavDesktop
    useEffect(() => {
        const handleModeChange = (event: CustomEvent<'selling' | 'requesting'>) => {
            setSelectedMode(event.detail)
        }

        window.addEventListener('feed-mode-change', handleModeChange as EventListener)
        return () => window.removeEventListener('feed-mode-change', handleModeChange as EventListener)
    }, [])

    // Listen for search changes from NavDesktop
    useEffect(() => {
        const handleSearchChange = (event: CustomEvent<string>) => {
            setSearchTerm(event.detail)
        }

        window.addEventListener('feed-search-change', handleSearchChange as EventListener)
        return () => window.removeEventListener('feed-search-change', handleSearchChange as EventListener)
    }, [])

    // Listen for category changes from NavDesktop
    useEffect(() => {
        const handleCategoryChange = (event: CustomEvent<string>) => {
            setActiveCategory(event.detail)
        }

        window.addEventListener('feed-category-change', handleCategoryChange as EventListener)
        return () => window.removeEventListener('feed-category-change', handleCategoryChange as EventListener)
    }, [])

    // Filter posts based on search term and category
    useEffect(() => {
        let filtered = posts

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim()
            filtered = filtered.filter(post => {
                const titleMatch = post.title.toLowerCase().includes(term)
                const descriptionMatch = post.description.toLowerCase().includes(term)
                const tagsMatch = post.tags?.some(tag => tag.toLowerCase().includes(term)) || false

                return titleMatch || descriptionMatch || tagsMatch
            })
        }

        // Apply category filter
        if (activeCategory !== 'All') {
            filtered = filtered.filter(post => post.category === activeCategory)
        }

        setFilteredPosts(filtered)
    }, [posts, searchTerm, activeCategory])

    const fetchPosts = async () => {
        try {
            const data = await getPostsByMode(selectedMode)
            setPosts(data)
        } catch (error) {
            console.error('Error fetching posts:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatTimeAgo = (dateString: string) => {
        const now = new Date()
        const postDate = new Date(dateString)
        const diffInHours = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60))

        if (diffInHours < 1) return 'Just now'
        if (diffInHours < 24) return `${diffInHours}h ago`
        const diffInDays = Math.floor(diffInHours / 24)
        if (diffInDays < 7) return `${diffInDays}d ago`
        return postDate.toLocaleDateString()
    }

    const onEditPost = (post: any) => {
        console.log('📝 [FEED] onEditPost called with post:', post)
        setSelectedPost(post)
        setShowEditModal(true)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black p-4">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-gray-900 rounded-lg overflow-hidden animate-pulse">
                                <div className="relative w-full bg-gray-800" style={{ paddingBottom: '100%' }}></div>
                                <div className="p-4 space-y-2">
                                    <div className="h-4 bg-gray-800 rounded"></div>
                                    <div className="h-3 bg-gray-800 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }



    return (
        <div className="min-h-screen bg-black flex flex-col pb-16 md:pb-0">
            {/* Feed */}
            <div className="flex-1 pt-[110px] md:pt-0">



                <div className="max-w-6xl mx-auto px-4 py-6">
                    {posts.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <p className="text-gray-400 text-lg mb-4">No posts yet</p>
                            <Link
                                href="/post/new"
                                className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-lg font-medium transition-colors inline-block"
                            >
                                Create the first post
                            </Link>
                        </motion.div>
                    ) : filteredPosts.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <p className="text-gray-400 text-lg">No posts found</p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPosts.map((post, index) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/post/${post.id}`)}
                                >
                                    <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                                        <Image
                                            src={post.image_url}
                                            alt={post.title}
                                            fill
                                            className="object-cover absolute inset-0"
                                        />
                                        <PostMenu
                                            postId={post.id}
                                            imageUrl={post.image_url}
                                            username={post.username}
                                            currentUser={user?.username}
                                            onPostDeleted={() => fetchPosts()}
                                            onPostEdit={onEditPost}
                                            post={post}
                                        />
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${post.mode === 'selling'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {post.mode === 'selling' ? 'Selling' : 'Requesting'}
                                            </span>
                                            <span className="text-xs text-gray-500">{formatTimeAgo(post.created_at)}</span>
                                        </div>
                                        <h3 className="font-semibold text-lg mb-1 line-clamp-1">{post.title}</h3>
                                        <p className="text-gray-400 text-sm mb-2 line-clamp-2">{post.description}</p>
                                        {post.tags && post.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {post.tags.slice(0, 3).map((tag, tagIndex) => (
                                                    <span
                                                        key={tagIndex}
                                                        className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {post.tags.length > 3 && (
                                                    <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full">
                                                        +{post.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span>@{post.users?.username || 'unknown'}</span>
                                            {post.price && (
                                                <span className="text-sm font-bold bg-emerald-600 text-white px-2 py-1 rounded-full">
                                                    {post.price}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                <BottomNav />

                {/* Edit Post Modal */}
                {showEditModal && selectedPost && (
                    <EditPostModal
                        post={selectedPost}
                        onClose={() => {
                            setShowEditModal(false)
                            setSelectedPost(null)
                        }}
                        onUpdate={() => fetchPosts()}
                    />
                )}
            </div>
        </div>
    )
}
