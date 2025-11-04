'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useUIStore } from '@/lib/store'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BottomNav } from '@/components/bottom-nav'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
    ArrowLeft,
    MessageCircle,
    Clock,
    Check,
    CheckCheck
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { Chat } from '@/lib/types'

export function ChatListPage() {
    const router = useRouter()
    const { user } = useAuthStore()
    const { setAuthModalOpen } = useUIStore()

    // Fetch user's chats
    const { data: chats, isLoading, refetch } = useQuery({
        queryKey: ['user-chats', user?.id],
        queryFn: async () => {
            if (!user) return []

            const supabase = createBrowserSupabaseClient()

            // Get chats with last message and unread count
            const { data, error } = await supabase
                .from('chats')
                .select(`
          *,
          posts (
            id,
            title,
            images,
            profiles (
              username,
              full_name,
              avatar_url
            )
          ),
          messages (
            id,
            content,
            sender_id,
            read_at,
            created_at
          )
        `)
                .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
                .order('updated_at', { ascending: false })

            if (error) throw error

            // Process chats to add computed fields
            const processedChats: Chat[] = data.map(chat => {
                const otherUserId = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id
                const otherUser = chat.posts?.profiles

                // Get last message
                const messages = chat.messages || []
                const lastMessage = messages.sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0]

                // Count unread messages
                const unreadCount = messages.filter((msg: any) =>
                    msg.sender_id !== user.id && !msg.read_at
                ).length

                return {
                    ...chat,
                    other_user: otherUser,
                    last_message: lastMessage,
                    unread_count: unreadCount
                }
            })

            return processedChats
        },
        enabled: !!user,
    })

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user) return

        const supabase = createBrowserSupabaseClient()

        const channel = supabase
            .channel('chat-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=in.(${chats?.map(c => c.id).join(',') || ''})`
                },
                () => {
                    refetch()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, chats, refetch])

    if (!user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground mb-4">Please sign in to view your messages</p>
                        <Button onClick={() => setAuthModalOpen(true)}>Sign In</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

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
                    <h1 className="text-lg font-semibold">Messages</h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="pb-20">
                {isLoading ? (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <div className="flex items-center space-x-3">
                                        <Skeleton className="h-12 w-12 rounded-full" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-1/3" />
                                            <Skeleton className="h-4 w-2/3" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : chats && chats.length > 0 ? (
                    <div className="divide-y divide-border">
                        {chats.map((chat) => (
                            <ChatListItem key={chat.id} chat={chat} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-12">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No messages yet</p>
                        <p className="text-sm">Start a conversation by messaging someone about their post</p>
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    )
}

function ChatListItem({ chat }: { chat: Chat }) {
    const router = useRouter()

    const handleClick = () => {
        router.push(`/chat/${chat.id}`)
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else if (diffInHours < 168) { // 7 days
            return date.toLocaleDateString([], { weekday: 'short' })
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
        }
    }

    const truncateMessage = (message: string, maxLength: number = 50) => {
        return message.length > maxLength ? message.substring(0, maxLength) + '...' : message
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
        >
            <button
                onClick={handleClick}
                className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={chat.other_user?.avatar_url || undefined} />
                            <AvatarFallback>
                                {(chat.other_user?.username || chat.other_user?.full_name || 'U').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        {chat.unread_count && chat.unread_count > 0 && (
                            <Badge
                                variant="destructive"
                                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                            >
                                {chat.unread_count > 9 ? '9+' : chat.unread_count}
                            </Badge>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium truncate">
                                {chat.other_user?.full_name || chat.other_user?.username || 'Unknown User'}
                            </h3>
                            {chat.last_message && (
                                <span className="text-xs text-muted-foreground">
                                    {formatTime(chat.last_message.created_at)}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                {chat.posts && (
                                    <p className="text-xs text-muted-foreground truncate mb-1">
                                        Re: {chat.posts.title}
                                    </p>
                                )}
                                {chat.last_message ? (
                                    <div className="flex items-center space-x-2">
                                        <p className="text-sm text-muted-foreground truncate">
                                            {chat.last_message.sender_id === chat.buyer_id ? 'You: ' : ''}
                                            {truncateMessage(chat.last_message.content)}
                                        </p>
                                        {chat.last_message.sender_id === chat.buyer_id && (
                                            <div className="flex-shrink-0">
                                                {chat.last_message.read_at ? (
                                                    <CheckCheck className="h-3 w-3 text-blue-500" />
                                                ) : (
                                                    <Check className="h-3 w-3 text-muted-foreground" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No messages yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </button>
        </motion.div>
    )
}
