'use client'

import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

interface Chat {
    id: string
    user1: string
    user2: string
    post_id: string
    posts: {
        title: string
        users: {
            username: string
            name: string
        } | null
    } | null
}

interface Message {
    id: string
    chat_id: string
    sender_username: string
    content: string
    created_at: string
}

export default function Chat() {
    const router = useRouter()
    const params = useParams()
    const { user, loading: userLoading } = useUser()
    const [chat, setChat] = useState<Chat | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (userLoading) return
        if (!user) {
            router.push('/auth')
            return
        }

        if (params.id) {
            fetchChat(params.id as string)
        }
    }, [params.id, router, user, userLoading])

    const fetchChat = async (chatId: string) => {
        try {
            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .select(`
          id,
          user1,
          user2,
          post_id,
          posts (
            title,
            users (
              username,
              name
            )
          )
        `)
                .eq('id', chatId)
                .single()

            if (chatError) throw chatError

            // Check if user is part of this chat
            if (!user || (chatData.user1 !== user.username && chatData.user2 !== user.username)) {
                toast.error('You are not part of this chat')
                router.push('/feed')
                return
            }

            setChat(chatData as unknown as Chat)

            // Fetch messages
            await fetchMessages(chatId)

            // Subscribe to real-time messages
            const channel = supabase
                .channel(`chat-${chatId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `chat_id=eq.${chatId}`
                    },
                    (payload) => {
                        setMessages(prev => [...prev, payload.new as Message])
                        scrollToBottom()
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        } catch (error) {
            console.error('Error fetching chat:', error)
            toast.error('Chat not found')
            router.push('/feed')
        } finally {
            setLoading(false)
        }
    }

    const fetchMessages = async (chatId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true })

            if (error) throw error
            setMessages(data || [])
            scrollToBottom()
        } catch (error) {
            console.error('Error fetching messages:', error)
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!newMessage.trim() || !chat || !user) return

        setSending(true)

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    chat_id: chat.id,
                    sender_username: user.username,
                    content: newMessage.trim()
                })

            if (error) throw error

            setNewMessage('')
        } catch (error) {
            console.error('Error sending message:', error)
            toast.error('Failed to send message')
        } finally {
            setSending(false)
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const getOtherUser = () => {
        if (!chat || !user) return null
        return chat.user1 === user.username ? chat.user2 : chat.user1
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black p-4">
                <div className="max-w-2xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-16 bg-gray-800 rounded-lg"></div>
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className={`h-12 ${i % 2 === 0 ? 'ml-auto w-3/4' : 'w-2/3'} bg-gray-800 rounded-lg`}></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!chat || !user) return null

    const otherUser = getOtherUser()

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-black/80 backdrop-blur-sm border-b border-gray-800 p-4 z-10">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                    <div className="text-center">
                        <h1 className="text-lg font-semibold">Chat with @{otherUser}</h1>
                        {chat.posts && (
                            <p className="text-sm text-gray-400">About: {chat.posts.title}</p>
                        )}
                    </div>
                    <div></div>
                </div>
            </div>

            <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <p className="text-gray-400">No messages yet. Start the conversation!</p>
                        </motion.div>
                    ) : (
                        messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${message.sender_username === user.username ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.sender_username === user.username
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-800 text-white'
                                        }`}
                                >
                                    <p className="text-sm">{message.content}</p>
                                    <p className={`text-xs mt-1 ${message.sender_username === user.username ? 'text-red-200' : 'text-gray-400'
                                        }`}>
                                        {formatTime(message.created_at)}
                                    </p>
                                </div>
                            </motion.div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="border-t border-gray-800 p-4">
                    <form onSubmit={handleSendMessage} className="flex gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500 transition-colors"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
