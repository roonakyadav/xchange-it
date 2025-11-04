'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
    ArrowLeft,
    Send,
    Check,
    CheckCheck,
    MoreVertical,
    Smile
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateChatId } from '@/lib/chat-utils'
import type { Chat, Message, Profile } from '@/lib/types'

interface ChatRoomPageProps {
    chat: Chat
    initialMessages: Message[]
    otherUser: Profile | null
}

export function ChatRoomPage({ chat, initialMessages, otherUser }: ChatRoomPageProps) {
    const router = useRouter()
    const { user } = useAuthStore()

    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [newMessage, setNewMessage] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [otherUserTyping, setOtherUserTyping] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!user) throw new Error('Not authenticated')

            const supabase = createBrowserSupabaseClient()

            // First, ensure chat exists
            const { data: existingChat, error: chatError } = await supabase
                .from('chats')
                .select('id')
                .eq('id', chat.id)
                .single()

            if (chatError && chatError.code !== 'PGRST116') {
                throw new Error('Failed to check chat existence')
            }

            let chatId = chat.id

            // If chat doesn't exist, create it
            if (!existingChat) {
                const { data: newChat, error: createChatError } = await supabase
                    .from('chats')
                    .insert({
                        id: chat.id,
                        post_id: chat.post_id,
                        buyer_id: chat.buyer_id,
                        seller_id: chat.seller_id,
                    })
                    .select('id')
                    .single()

                if (createChatError) {
                    throw new Error('Failed to create chat')
                }

                chatId = newChat.id

                // Add participants
                await supabase
                    .from('chat_participants')
                    .insert([
                        { chat_id: chatId, user_id: chat.buyer_id },
                        { chat_id: chatId, user_id: chat.seller_id }
                    ])
            }

            // Send message
            const { data: message, error: messageError } = await supabase
                .from('messages')
                .insert({
                    chat_id: chatId,
                    sender_id: user.id,
                    content: content.trim(),
                })
                .select()
                .single()

            if (messageError) {
                throw new Error('Failed to send message')
            }

            return message as Message
        },
        onSuccess: (newMessage) => {
            setMessages(prev => [...prev, newMessage])
            setNewMessage('')
            // TODO: Invalidate chat list cache
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to send message')
        },
    })

    // Handle typing indicator
    const handleTyping = useCallback(() => {
        if (!user) return

        const supabase = createBrowserSupabaseClient()

        // Send typing event (ephemeral, not stored in DB)
        supabase.channel(`chat-${chat.id}`)
            .send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user.id, isTyping: true }
            })

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        // Set timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            supabase.channel(`chat-${chat.id}`)
                .send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { userId: user.id, isTyping: false }
                })
        }, 2000)
    }, [user, chat.id])

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user) return

        const supabase = createBrowserSupabaseClient()

        const channel = supabase
            .channel(`chat-${chat.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chat.id}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message
                    setMessages(prev => {
                        // Avoid duplicates
                        if (prev.some(msg => msg.id === newMessage.id)) {
                            return prev
                        }
                        return [...prev, newMessage]
                    })
                }
            )
            .on(
                'broadcast',
                { event: 'typing' },
                (payload) => {
                    if (payload.payload.userId !== user.id) {
                        setOtherUserTyping(payload.payload.isTyping)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, chat.id])

    const handleSendMessage = () => {
        if (!newMessage.trim()) return
        sendMessageMutation.mutate(newMessage)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">Please sign in to view messages</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Button
                            variant="ghost"
                            onClick={() => router.back()}
                            className="p-2"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={otherUser?.avatar_url || undefined} />
                                <AvatarFallback>
                                    {(otherUser?.username || otherUser?.full_name || 'U').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-medium text-sm">
                                    {otherUser?.full_name || otherUser?.username || 'Unknown User'}
                                </h3>
                                {otherUserTyping && (
                                    <p className="text-xs text-muted-foreground">typing...</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <Button variant="ghost" className="p-2">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Post Reference */}
            {chat.posts && (
                <div className="px-4 py-2 bg-muted/30 border-b border-border">
                    <p className="text-xs text-muted-foreground mb-1">Regarding:</p>
                    <p className="text-sm font-medium truncate">{chat.posts.title}</p>
                </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
                <div className="py-4 space-y-4">
                    <AnimatePresence initial={false}>
                        {messages.map((message, index) => {
                            const isOwnMessage = message.sender_id === user.id
                            const showAvatar = !isOwnMessage && (
                                index === 0 ||
                                messages[index - 1].sender_id !== message.sender_id ||
                                new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000 // 5 minutes
                            )

                            return (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} space-x-2`}
                                >
                                    {!isOwnMessage && showAvatar && (
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                            <AvatarImage src={otherUser?.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs">
                                                {(otherUser?.username || 'U').slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                    {!isOwnMessage && !showAvatar && <div className="w-8" />}

                                    <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-first' : ''}`}>
                                        <div
                                            className={`px-3 py-2 rounded-2xl ${isOwnMessage
                                                ? 'bg-primary text-primary-foreground ml-auto'
                                                : 'bg-muted'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                {message.content}
                                            </p>
                                        </div>

                                        <div className={`flex items-center mt-1 text-xs text-muted-foreground ${isOwnMessage ? 'justify-end' : 'justify-start'
                                            }`}>
                                            <span>{formatTime(message.created_at)}</span>
                                            {isOwnMessage && (
                                                <div className="ml-1">
                                                    {message.read_at ? (
                                                        <CheckCheck className="h-3 w-3 text-blue-500" />
                                                    ) : (
                                                        <Check className="h-3 w-3" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>

                    {otherUserTyping && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex justify-start space-x-2"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={otherUser?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                    {(otherUser?.username || 'U').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="bg-muted px-3 py-2 rounded-2xl">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t border-border bg-background p-4">
                <div className="flex items-end space-x-2">
                    <div className="flex-1">
                        <Input
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value)
                                handleTyping()
                            }}
                            onKeyPress={handleKeyPress}
                            placeholder="Type a message..."
                            className="min-h-[40px] resize-none"
                            disabled={sendMessageMutation.isPending}
                        />
                    </div>

                    <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        size="sm"
                        className="px-3"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
