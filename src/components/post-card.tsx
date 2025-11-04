'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Heart, MessageCircle, Share, MapPin } from 'lucide-react'
import type { Post } from '@/lib/types'

interface PostCardProps {
    post: Post
    highlights?: Record<string, string[]>
}

export function PostCard({ post, highlights }: PostCardProps) {
    const user = post.profiles
    const displayName = user?.username || user?.full_name || 'Anonymous'
    const initials = displayName.slice(0, 2).toUpperCase()

    const highlightText = (text: string, highlightTerms: string[]) => {
        if (!highlightTerms || highlightTerms.length === 0) return text

        let result = text
        highlightTerms.forEach(term => {
            const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
            result = result.replace(regex, '<mark>$1</mark>')
        })
        return result
    }

    return (
        <Card className="border-0 border-b border-border rounded-none">
            <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.avatar_url || undefined} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                            <Link
                                href={`/u/${user?.username || post.user_id}`}
                                className="font-semibold text-sm hover:underline"
                            >
                                {displayName}
                            </Link>
                            <Badge variant={post.type === 'listing' ? 'default' : 'secondary'} className="text-xs">
                                {post.type}
                            </Badge>
                            {post.location && (
                                <div className="flex items-center text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {post.location}
                                </div>
                            )}
                        </div>

                        <Link href={`/post/${post.id}`}>
                            <h3
                                className="font-semibold text-base mb-1 hover:underline"
                                dangerouslySetInnerHTML={{
                                    __html: highlightText(post.title, highlights?.title || [])
                                }}
                            />
                        </Link>

                        {post.description && (
                            <p
                                className="text-sm text-muted-foreground mb-2 line-clamp-2"
                                dangerouslySetInnerHTML={{
                                    __html: highlightText(post.description, highlights?.description || [])
                                }}
                            />
                        )}

                        {post.price && (
                            <div className="text-lg font-bold text-accent mb-2">
                                {post.currency} {post.price.toFixed(2)}
                            </div>
                        )}

                        {post.images.length > 0 && (
                            <div className="mb-3">
                                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                                    <img
                                        src={post.images[0]}
                                        alt={post.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                                {post.images.length > 1 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        +{post.images.length - 1} more images
                                    </p>
                                )}
                            </div>
                        )}

                        {post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {post.tags.slice(0, 3).map((tag) => {
                                    const isHighlighted = highlights?.tags?.includes(tag)
                                    return (
                                        <Badge
                                            key={tag}
                                            variant={isHighlighted ? "default" : "outline"}
                                            className="text-xs"
                                        >
                                            {tag}
                                        </Badge>
                                    )
                                })}
                                {post.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                        +{post.tags.length - 3}
                                    </Badge>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center space-x-4">
                                <button className="flex items-center space-x-1 hover:text-accent transition-colors">
                                    <Heart className="h-4 w-4" />
                                    <span>0</span>
                                </button>
                                <button className="flex items-center space-x-1 hover:text-accent transition-colors">
                                    <MessageCircle className="h-4 w-4" />
                                    <span>0</span>
                                </button>
                                <button className="flex items-center space-x-1 hover:text-accent transition-colors">
                                    <Share className="h-4 w-4" />
                                </button>
                            </div>
                            <time className="text-xs">
                                {new Date(post.created_at).toLocaleDateString()}
                            </time>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
