'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '@/components/BottomNav'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

interface Chat {
    id: string
    user1: string
    user2: string
    post_id: string
    posts: {
        title: string
        image_url: string
        users: {
            username: string
            name: string
        } | null
    } | null
    messages: {
        content: string
        created_at: string
        sender_username: string
    }[]
}

export default function Chats() {
    const router = useRouter()
    const { user, loading: userLoading } = useUser()
    const [chats, setChats] = useState<Chat[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (userLoading) return
        if (!user) {
            router.push('/auth')
            return
        }

        fetchChats(user.username)
    }, [router, user, userLoading])

    // Redirect to auth if not logged in
    if (!userLoading && !user) {
        router.push('/auth')
        return null
    }

    const fetchChats = async (username: string) => {
        try {
            const { data, error } = await supabase
                .from('chats')
                .select(`
          id,
          user1,
          user2,
          post_id,
          posts (
            title,
            image_url,
            users (
              username,
              name
            )
          ),
          messages (
            content,
            created_at,
            sender_username
          )
        `)
                .or(`user1.eq.${username},user2.eq.${username}`)
                .order('created_at', { foreignTable: 'messages', ascending: false })

            if (error) throw error

            // Process chats to get the latest message and other user info
            const processedChats = (data || []).map(chat => ({
                ...chat,
                messages: chat.messages?.sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ) || []
            }))

            setChats(processedChats as unknown as Chat[])
        } catch (error) {
            console.error('Error fetching chats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getOtherUser = (chat: Chat, currentUser: string) => {
        return chat.user1 === currentUser ? chat.user2 : chat.user1
    }

    const getLatestMessage = (chat: Chat) => {
        return chat.messages?.[0]
    }

    const formatTimeAgo = (dateString: string) => {
        const now = new Date()
        const messageDate = new Date(dateString)
        const diffInHours = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60))

        if (diffInHours < 1) return 'Just now'
        if (diffInHours < 24) return `${diffInHours}h ago`
        const diffInDays = Math.floor(diffInHours / 24)
        if (diffInDays < 7) return `${diffInDays}d ago`
        return messageDate.toLocaleDateString()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black p-4">
                <div className="max-w-2xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="bg-gray-900 rounded-lg p-4 flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gray-800 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="sticky top-0 bg-black/80 backdrop-blur-sm border-b border-gray-800 p-4 z-10">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                    <h1 className="text-xl font-bold">Chats</h1>
                    <div></div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4">
                {chats.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-16"
                    >
                        <p className="text-gray-400 text-lg mb-4">No chats yet</p>
                        <p className="text-gray-500">Start a conversation by messaging a seller!</p>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        {chats.map((chat, index) => {
                            const otherUser = getOtherUser(chat, user.username)
                            const latestMessage = getLatestMessage(chat)

                            return (
                                <motion.div
                                    key={chat.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-gray-900 rounded-lg p-4 cursor-pointer hover:bg-gray-800 transition-colors"
                                    onClick={() => router.push(`/chat/${chat.id}`)}
                                >
                                    <div className="flex items-center space-x-4">
                                        {/* Post Image */}
                                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                            <Image
                                                src={chat.posts?.image_url || '/placeholder.png'}
                                                alt={chat.posts?.title || 'Post'}
                                                width={48}
                                                height={48}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Chat Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-semibold text-white truncate">
                                                    Chat with @{otherUser}
                                                </h3>
                                                {latestMessage && (
                                                    <span className="text-xs text-gray-500">
                                                        {formatTimeAgo(latestMessage.created_at)}
                                                    </span>
                                                )}
                                            </div>

                                            {chat.posts && (
                                                <p className="text-sm text-gray-400 mb-1 truncate">
                                                    About: {chat.posts.title}
                                                </p>
                                            )}

                                            {latestMessage ? (
                                                <p className="text-sm text-gray-300 truncate">
                                                    {latestMessage.sender_username === user.username ? 'You: ' : ''}
                                                    {latestMessage.content}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-500">No messages yet</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    )
}
