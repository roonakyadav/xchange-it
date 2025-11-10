'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { getChatById, sendMessage, markThreadRead } from '@/lib/db'
import { subscribeToTyping, updateTypingStatus } from '@/lib/realtime'
import { formatTimeAgo } from '@/lib/time'
import { useUser } from '@/hooks/useUser'
import { useChatMessages } from '@/hooks/useChatMessages'
import { uploadChatMedia } from '@/lib/chatUtils'
import { supabase } from '@/lib/supabase'
import TypingDots from './TypingDots'
import MediaViewer from './MediaViewer'

import type { ChatWithPost, Message } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ChatThreadProps {
    chatId: string
}

interface MessageGroup {
    sender: string
    messages: Message[]
    timestamp: string
}

interface SwipeableMessageProps {
    message: Message
    user: any
    onReply: (message: Message) => void
}

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ message, user, onReply }) => {
    const controls = useAnimation()
    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 400
    const triggerDistance = screenWidth * 0.25

    const handleDragEnd = async (event: any, info: any) => {
        const offset = info.offset.x
        const isMine = message.sender === user.username

        if (!isMine && offset > triggerDistance) {
            controls.start({ x: 0, transition: { type: "spring", stiffness: 700, damping: 32 } })
            onReply(message)
        } else {
            controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } })
        }
    }

    return (
        <div>
            {/* If this message is a reply */}
            {message.reply_preview && (
                <div className={`mb-1 px-3 py-2 rounded-lg text-xs bg-gray-800 text-gray-300 max-w-[70%] whitespace-pre-wrap break-words leading-snug ${message.sender === user.username ? 'ml-auto text-right' : 'text-left'}`}>
                    {message.reply_preview.length > 80 ? message.reply_preview.slice(0, 80) + '…' : message.reply_preview}
                </div>
            )}

            {/* Actual message bubble */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                onDragEnd={handleDragEnd}
                animate={controls}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="w-full flex items-end"
            >
                <div
                    className={`inline-block px-3 py-2 rounded-2xl max-w-[75%] whitespace-pre-wrap break-words leading-relaxed
                        ${message.sender === user.username
                            ? 'bg-red-500 text-white self-end text-right'
                            : 'bg-gray-700 text-white self-start text-left'}
                    `}
                >
                    {message.body}
                </div>
            </motion.div>
        </div>
    )
}

export default function ChatThread({ chatId }: ChatThreadProps) {
    const router = useRouter()
    const { user } = useUser()
    const { messages, upsertMessages } = useChatMessages(chatId, user?.username)
    const [chat, setChat] = useState<ChatWithPost | null>(null)
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [otherUserTyping, setOtherUserTyping] = useState(false)
    const [inputFocused, setInputFocused] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [mediaViewer, setMediaViewer] = useState<{
        isOpen: boolean
        mediaUrl: string
        isVideo: boolean
    }>({
        isOpen: false,
        mediaUrl: '',
        isVideo: false
    })
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const messageChannelsRef = useRef<RealtimeChannel[]>([])

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, []) // Empty dependency array - only run once on mount

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom()
        }
    }, [messages.length])

    // Load chat
    useEffect(() => {
        if (!user) return

        const loadChat = async () => {
            try {
                const chatData = await getChatById(chatId)
                if (!chatData) {
                    router.push('/chats')
                    return
                }
                setChat(chatData)
                setLoading(false)
            } catch (error) {
                console.error('Failed to load chat:', error)
                router.push('/chats')
            }
        }

        loadChat()

        // Mark thread as read on open
        markThreadRead(chatId, user.username).catch(console.error)
    }, [chatId, user, router])

    // Mark unread messages as read when window becomes visible (debounced)
    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        const handleVisibilityChange = () => {
            if (!document.hidden && user) {
                // Debounce for 300ms to avoid excessive calls
                clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    markThreadRead(chatId, user.username).catch(console.error)
                }, 300)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            clearTimeout(timeoutId)
        }
    }, [chatId, user])

    // Set up typing and read status subscriptions
    useEffect(() => {
        if (!user || !chat) return

        console.log('Setting up typing subscriptions for chat:', chatId)
        const otherUser = chat.user1 === user.username ? chat.user2 : chat.user1

        // Subscribe to typing indicators
        const typingChannel = subscribeToTyping(chatId, user.username, (state) => {
            const otherUserTyping = Object.values(state).some(users =>
                users.some(u => u.user === otherUser && u.typing)
            )
            setOtherUserTyping(otherUserTyping)
        })

        messageChannelsRef.current = [typingChannel]

        return () => {
            console.log('Cleaning up typing subscriptions for chat:', chatId)
            messageChannelsRef.current.forEach(channel => channel.unsubscribe())
            messageChannelsRef.current = []
        }
    }, [chatId, user, chat, upsertMessages])

    // Listen for chat deletion events to clean up subscriptions
    useEffect(() => {
        const handleChatDeleted = (event: CustomEvent<{ chatId: string }>) => {
            if (event.detail.chatId === chatId) {
                console.log('Chat deleted, cleaning up subscriptions for chat:', chatId)
                // Clean up real-time subscriptions
                messageChannelsRef.current.forEach(channel => {
                    channel.unsubscribe()
                })
                messageChannelsRef.current = []
            }
        }

        window.addEventListener('chat-deleted', handleChatDeleted as EventListener)
        return () => window.removeEventListener('chat-deleted', handleChatDeleted as EventListener)
    }, [chatId])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleTyping = useCallback(() => {
        if (!isTyping) {
            setIsTyping(true)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, true, user!.username)
                }
            })
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, false, user!.username)
                }
            })
        }, 1500)
    }, [isTyping, user])

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || sending || !user) return

        const messageText = newMessage.trim()
        setNewMessage('')
        setSending(true)

        try {
            const realMessage = await sendMessage({
                chatId,
                sender: user.username,
                body: messageText,
            })

            if (replyingTo) {
                realMessage.reply_to_id = replyingTo.id;
                realMessage.reply_preview = replyingTo.body;
            }

            setReplyingTo(null);

            // The hook will handle adding the message via real-time subscription
            // Scroll to bottom after sending
            setTimeout(scrollToBottom, 100)

            // Stop typing indicator
            setIsTyping(false)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, false, user.username)
                }
            })

            // Clear typing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }

        } catch (error) {
            console.error('Failed to send message:', error)
            // Re-add message to input if failed
            setNewMessage(messageText)
        } finally {
            setSending(false)
            // Keep focus on desktop after sending, but not on mobile
            if (!isMobile) {
                requestAnimationFrame(() => inputRef.current?.focus())
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && replyingTo) {
            e.preventDefault()
            setReplyingTo(null)
            return
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage(e)
            if (!isMobile) {
                requestAnimationFrame(() => inputRef.current?.focus())
            }
        }
    }

    const groupMessages = (messages: Message[]): MessageGroup[] => {
        const groups: MessageGroup[] = []
        let currentGroup: MessageGroup | null = null

        messages.forEach((message) => {
            const messageTime = new Date(message.created_at)
            const shouldGroup = currentGroup &&
                currentGroup.sender === message.sender &&
                (messageTime.getTime() - new Date(currentGroup.timestamp).getTime()) < 2 * 60 * 1000 // 2 minutes

            if (shouldGroup && currentGroup) {
                currentGroup.messages.push(message)
            } else {
                if (currentGroup) {
                    groups.push(currentGroup)
                }
                currentGroup = {
                    sender: message.sender,
                    messages: [message],
                    timestamp: message.created_at,
                }
            }
        })

        if (currentGroup) {
            groups.push(currentGroup)
        }

        return groups
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user || !chat) return

        // Validate file type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert('Please select an image or video file')
            return
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB')
            return
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            const otherUser = chat.user1 === user.username ? chat.user2 : chat.user1
            const mediaUrl = await uploadChatMedia(file, user.username, otherUser, setUploadProgress)

            // Send media message
            await supabase.from('messages').insert([{
                chat_id: chatId,
                sender: user.username, // Use username as sender (matches database schema)
                body: `[MEDIA]${mediaUrl}`, // Prefix to identify media messages
            }])

            // Scroll to bottom after sending
            setTimeout(scrollToBottom, 100)

        } catch (error) {
            console.error('Media upload failed:', error)
            alert('Failed to upload media. Please try again.')
        } finally {
            setUploading(false)
            setUploadProgress(0)
            // Reset file input
            e.target.value = ''
        }
    }

    const getMessageStatus = (message: Message) => {
        if (message.read_at) return 'read'
        if (message.delivered_at) return 'delivered'
        return 'sent'
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-black">
                <div className="p-4 border-b border-gray-800">
                    <div className="animate-pulse">
                        <div className="h-6 bg-gray-700 rounded w-32"></div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pb-20">
                    <div className="p-4 space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={`animate-pulse ${i % 2 === 0 ? 'ml-auto' : 'mr-auto'}`}>
                                <div className={`h-12 bg-gray-700 rounded-2xl ${i % 2 === 0 ? 'w-32' : 'w-24'}`}></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="sticky bottom-0 z-50 bg-black border-t border-gray-800 p-4">
                    <div className="flex space-x-2">
                        <div className="flex-1 h-12 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse"></div>
                        <div className="w-20 h-12 bg-gray-700 rounded-2xl animate-pulse"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!chat || !user) return null

    const otherUser = chat.user1 === user.username ? chat.user2 : chat.user1
    const messageGroups = groupMessages(messages)

    return (
        <div className="flex flex-col h-full bg-black">
            {/* Header */}
            <div className="sticky top-0 bg-black/80 backdrop-blur-sm border-b border-gray-800 p-4 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                                {otherUser.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h2 className="font-medium text-white">@{otherUser}</h2>
                            {otherUserTyping ? (
                                <div className="flex items-center space-x-1">
                                    <TypingDots />
                                    <span className="text-xs text-gray-400">typing...</span>
                                </div>
                            ) : messages.length > 0 ? (
                                <span className="text-xs text-gray-500">
                                    {formatTimeAgo(messages[messages.length - 1].created_at)}
                                </span>
                            ) : null}
                        </div>
                    </div>

                </div>
            </div>

            {/* Messages - Scrollable area */}
            <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isMobile ? 'pb-24' : 'pb-20'} scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent`}>
                <div className="flex flex-col w-full px-3">
                    <AnimatePresence>
                        {messages.map((message, index) => (
                            <motion.div
                                key={message.id}
                                className={`flex w-full mb-2 ${message.sender === user.username ? 'justify-end' : 'justify-start'}`}
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.25}
                                onDragEnd={(e, info) => {
                                    const offset = info.offset.x
                                    const trigger = window.innerWidth * 0.25
                                    if (offset > trigger && message.sender !== user.username) {
                                        setReplyingTo(message)
                                    }
                                }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.02 }}
                            >
                                <div className="max-w-[80%]">
                                    {message.reply_preview && (
                                        <div className={`text-xs text-gray-400 mb-1 px-3 py-1 rounded-lg bg-gray-800/70
                                            ${message.sender === user.username ? 'text-right ml-auto' : 'text-left'}`}>
                                            {message.reply_preview}
                                        </div>
                                    )}

                                    {message.body.startsWith('[MEDIA]') ? (
                                        <div className={`flex ${message.sender === user.username ? 'justify-end' : 'justify-start'} mb-2`}>
                                            {(() => {
                                                const mediaUrl = message.body.replace('[MEDIA]', '')
                                                const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov') || mediaUrl.includes('.avi')

                                                return isVideo ? (
                                                    <video
                                                        src={mediaUrl}
                                                        controls
                                                        className="max-w-[70%] rounded-2xl border border-gray-700 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                        style={{ maxHeight: '300px' }}
                                                        onClick={() => setMediaViewer({ isOpen: true, mediaUrl, isVideo: true })}
                                                    />
                                                ) : (
                                                    <img
                                                        src={mediaUrl}
                                                        alt="uploaded media"
                                                        className="max-w-[70%] rounded-2xl border border-gray-700 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                        style={{ maxHeight: '300px' }}
                                                        onClick={() => setMediaViewer({ isOpen: true, mediaUrl, isVideo: false })}
                                                    />
                                                )
                                            })()}
                                        </div>
                                    ) : (
                                        <div
                                            className={`chat-bubble ${message.sender === user.username
                                                ? 'bg-red-500 text-white ml-auto rounded-tr-none'
                                                : 'bg-gray-700 text-white mr-auto rounded-tl-none'
                                                }`}
                                        >
                                            {message.body}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Typing indicator */}
                    {otherUserTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start"
                        >
                            <div className="bg-gray-700 rounded-2xl px-4 py-2">
                                <TypingDots />
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Message Input - Fixed on mobile, fixed on desktop (lg+) */}
            <div
                className={
                    isMobile
                        ? 'fixed bottom-0 left-0 right-0 z-50 bg-black border-t-2 border-gray-700 p-4'
                        : 'lg:fixed lg:bottom-0 lg:left-0 lg:right-0 lg:z-50 lg:bg-black border-t-2 border-gray-700 p-4'
                }
                style={{ paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined }}
            >
                <form onSubmit={handleSendMessage} className="flex flex-col space-y-2">
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-gray-800/80 border border-gray-700 rounded-xl p-2 mb-2 animate-slideDown">
                            <div>
                                <p className="text-xs text-gray-400">Replying to @{replyingTo.sender}</p>
                                <p className="text-sm text-gray-300 truncate max-w-[280px]">{replyingTo.body}</p>
                            </div>
                            <button
                                onClick={() => setReplyingTo(null)}
                                className="text-gray-500 hover:text-white"
                                aria-label="cancel reply"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    {/* Upload Progress Bar */}
                    {uploading && (
                        <div className="w-full flex items-center gap-2 text-gray-400 px-1 py-1">
                            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-2 bg-red-500 transition-all duration-150"
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                            <span className="text-xs">{uploadProgress}%</span>
                        </div>
                    )}

                    <div className="flex items-center space-x-2">
                        {/* Upload Button */}
                        <label className="relative flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-full w-10 h-10 cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            {uploading ? (
                                <Loader2 className="animate-spin w-5 h-5" />
                            ) : (
                                <Plus className="w-5 h-5" />
                            )}
                            <input
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={uploading}
                            />
                        </label>

                        {/* Message Input */}
                        <textarea
                            ref={inputRef}
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value)
                                handleTyping()
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-50"
                            rows={1}
                            disabled={sending || uploading}
                            aria-label="Type your message"
                        />

                        {/* Send Button */}
                        <button
                            type="button"
                            disabled={!newMessage.trim() || sending || uploading}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleSendMessage}
                            className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-6 py-3 rounded-2xl font-medium transition-colors disabled:cursor-not-allowed"
                            aria-label="Send message"
                        >
                            {sending ? '...' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Media Viewer Modal */}
            <MediaViewer
                isOpen={mediaViewer.isOpen}
                onClose={() => setMediaViewer({ isOpen: false, mediaUrl: '', isVideo: false })}
                mediaUrl={mediaViewer.mediaUrl}
                isVideo={mediaViewer.isVideo}
            />
        </div>
    )
}
