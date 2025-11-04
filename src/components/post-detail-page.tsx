'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useAuthStore, useUIStore } from '@/lib/store'
import { formatTimeAgo, formatPrice, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomNav } from '@/components/bottom-nav'
import { toast } from 'sonner'
import {
    ArrowLeft,
    Heart,
    MessageCircle,
    Share,
    Flag,
    MapPin,
    ChevronLeft,
    ChevronRight,
    X,
    Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Post, Comment } from '@/lib/types'

interface PostDetailPageProps {
    post: Post
    initialComments: Comment[]
}

export function PostDetailPage({ post, initialComments }: PostDetailPageProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { user } = useAuthStore()
    const { setAuthModalOpen } = useUIStore()

    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [commentText, setCommentText] = useState('')

    // Wishlist query
    const { data: wishlistData, isLoading: wishlistLoading } = useQuery({
        queryKey: ['wishlist', post.id],
        queryFn: async () => {
            const response = await fetch(`/api/wishlist?postId=${post.id}`)
            if (!response.ok) throw new Error('Failed to check wishlist')
            return response.json()
        },
        enabled: !!user,
    })

    // Comments query with realtime
    const { data: commentsData, isLoading: commentsLoading } = useQuery({
        queryKey: ['comments', post.id],
        queryFn: async () => {
            const response = await fetch(`/api/comments?postId=${post.id}`)
            if (!response.ok) throw new Error('Failed to fetch comments')
            return response.json()
        },
        initialData: { comments: initialComments },
    })

    // Wishlist mutation
    const wishlistMutation = useMutation({
        mutationFn: async (action: 'add' | 'remove') => {
            const response = await fetch('/api/wishlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId: post.id, action }),
            })
            if (!response.ok) throw new Error('Failed to update wishlist')
            return response.json()
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['wishlist', post.id] })
            toast.success(
                data.action === 'added' ? 'Added to wishlist' : 'Removed from wishlist'
            )
        },
        onError: () => {
            toast.error('Failed to update wishlist')
        },
    })

    // Comment mutation
    const commentMutation = useMutation({
        mutationFn: async (content: string) => {
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId: post.id, content }),
            })
            if (!response.ok) throw new Error('Failed to add comment')
            return response.json()
        },
        onSuccess: () => {
            setCommentText('')
            queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
            toast.success('Comment added')
        },
        onError: () => {
            toast.error('Failed to add comment')
        },
    })

    // Realtime subscription for comments
    useEffect(() => {
        if (!user) return

        const supabase = createBrowserSupabaseClient()
        const channel = supabase
            .channel(`comments-${post.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments',
                    filter: `post_id=eq.${post.id}`,
                },
                (payload: any) => {
                    queryClient.invalidateQueries({ queryKey: ['comments', post.id] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [post.id, user, queryClient])

    const handleWishlistToggle = () => {
        if (!user) {
            setAuthModalOpen(true)
            return
        }

        const isWishlisted = wishlistData?.isWishlisted
        wishlistMutation.mutate(isWishlisted ? 'remove' : 'add')
    }

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) {
            setAuthModalOpen(true)
            return
        }

        if (!commentText.trim()) return

        commentMutation.mutate(commentText.trim())
    }

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: post.title,
                    text: post.description || post.title,
                    url: window.location.href,
                })
            } catch (error) {
                // User cancelled share
            }
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(window.location.href)
            toast.success('Link copied to clipboard')
        }
    }

    const handleReport = () => {
        if (!user) {
            setAuthModalOpen(true)
            return
        }

        // TODO: Implement report functionality
        toast.info('Report functionality coming soon')
    }

    const openLightbox = (index: number) => {
        setLightboxIndex(index)
        setLightboxOpen(true)
    }

    const closeLightbox = () => {
        setLightboxOpen(false)
    }

    const nextImage = () => {
        setLightboxIndex((prev) => (prev + 1) % post.images.length)
    }

    const prevImage = () => {
        setLightboxIndex((prev) => (prev - 1 + post.images.length) % post.images.length)
    }

    const comments = commentsData?.comments || []
    const isWishlisted = wishlistData?.isWishlisted || false

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
                    <h1 className="text-lg font-semibold">Post</h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="pb-20">
                {/* Post Content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Card className="border-0 border-b border-border rounded-none">
                        <CardContent className="p-4">
                            {/* User Info */}
                            <div className="flex items-start space-x-3 mb-4">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={post.profiles?.avatar_url || undefined} alt={post.profiles?.username || 'User'} />
                                    <AvatarFallback>
                                        {(post.profiles?.username || post.profiles?.full_name || 'U').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className="font-semibold text-sm">
                                            {post.profiles?.username || post.profiles?.full_name || 'Anonymous'}
                                        </span>
                                        <Badge variant={post.type === 'listing' ? 'default' : 'secondary'} className="text-xs">
                                            {post.type}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center text-xs text-muted-foreground">
                                        <span>{formatTimeAgo(post.created_at)}</span>
                                        {post.location && (
                                            <>
                                                <span className="mx-2">•</span>
                                                <div className="flex items-center">
                                                    <MapPin className="h-3 w-3 mr-1" />
                                                    {post.location}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Title */}
                            <h2 className="text-xl font-bold mb-2">{post.title}</h2>

                            {/* Price */}
                            {post.price && (
                                <div className="text-2xl font-bold text-accent mb-3">
                                    {formatPrice(post.price, post.currency)}
                                </div>
                            )}

                            {/* Description */}
                            {post.description && (
                                <p className="text-muted-foreground mb-4 whitespace-pre-wrap">
                                    {post.description}
                                </p>
                            )}

                            {/* Images */}
                            {post.images.length > 0 && (
                                <div className="mb-4">
                                    <div className="aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer" onClick={() => openLightbox(0)}>
                                        <img
                                            src={post.images[0]}
                                            alt={post.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {post.images.length > 1 && (
                                        <div className="grid grid-cols-4 gap-2 mt-2">
                                            {post.images.slice(1, 5).map((image, index) => (
                                                <div
                                                    key={index + 1}
                                                    className="aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer"
                                                    onClick={() => openLightbox(index + 1)}
                                                >
                                                    <img
                                                        src={image}
                                                        alt={`${post.title} ${index + 2}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ))}
                                            {post.images.length > 5 && (
                                                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                                                    <span className="text-sm text-muted-foreground">
                                                        +{post.images.length - 5}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tags */}
                            {post.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {post.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                            #{tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-4 border-t border-border">
                                <div className="flex items-center space-x-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleWishlistToggle}
                                        disabled={wishlistLoading || wishlistMutation.isPending}
                                        className={cn(
                                            "flex items-center space-x-1",
                                            isWishlisted && "text-accent"
                                        )}
                                    >
                                        {wishlistMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
                                        )}
                                        <span className="text-sm">Save</span>
                                    </Button>

                                    <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                                        <MessageCircle className="h-4 w-4" />
                                        <span className="text-sm">{comments.length}</span>
                                    </Button>

                                    <Button variant="ghost" size="sm" onClick={handleShare} className="flex items-center space-x-1">
                                        <Share className="h-4 w-4" />
                                        <span className="text-sm">Share</span>
                                    </Button>
                                </div>

                                <Button variant="ghost" size="sm" onClick={handleReport} className="flex items-center space-x-1 text-muted-foreground">
                                    <Flag className="h-4 w-4" />
                                    <span className="text-sm">Report</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Comments Section */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className="mt-4"
                >
                    <Card className="border-0">
                        <CardHeader>
                            <CardTitle className="text-lg">Comments ({comments.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Comment */}
                            <form onSubmit={handleCommentSubmit} className="space-y-2">
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder={user ? "Write a comment..." : "Sign in to comment"}
                                    className="w-full px-3 py-2 border border-border rounded-md bg-background resize-none"
                                    rows={3}
                                    maxLength={500}
                                    disabled={!user}
                                />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">
                                        {commentText.length}/500
                                    </span>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={!user || !commentText.trim() || commentMutation.isPending}
                                    >
                                        {commentMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        Comment
                                    </Button>
                                </div>
                            </form>

                            {/* Comments List */}
                            <div className="space-y-4">
                                {commentsLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="flex space-x-3">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/4" />
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-3/4" />
                                            </div>
                                        </div>
                                    ))
                                ) : comments.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-8">
                                        No comments yet. Be the first to comment!
                                    </div>
                                ) : (
                                    comments.map((comment: Comment) => (
                                        <motion.div
                                            key={comment.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex space-x-3"
                                        >
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                                                <AvatarFallback className="text-xs">
                                                    {(comment.profiles?.username || 'U').slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <span className="font-semibold text-sm">
                                                        {comment.profiles?.username || comment.profiles?.full_name || 'Anonymous'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatTimeAgo(comment.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {lightboxOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                        onClick={closeLightbox}
                    >
                        <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                                onClick={closeLightbox}
                            >
                                <X className="h-6 w-6" />
                            </Button>

                            {post.images.length > 1 && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                                        onClick={prevImage}
                                    >
                                        <ChevronLeft className="h-8 w-8" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                                        onClick={nextImage}
                                    >
                                        <ChevronRight className="h-8 w-8" />
                                    </Button>
                                </>
                            )}

                            <img
                                src={post.images[lightboxIndex]}
                                alt={`${post.title} ${lightboxIndex + 1}`}
                                className="max-w-full max-h-full object-contain"
                            />

                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded">
                                {lightboxIndex + 1} / {post.images.length}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNav />
        </div>
    )
}
