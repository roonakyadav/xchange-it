'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { getChatById, sendMessage, markThreadRead } from '@/lib/db'
import { subscribeToTyping, updateTypingStatus } from '@/lib/realtime'
import { formatTimeAgo } from '@/lib/time'
import { useUser } from '@/hooks/useUser'
import { useChatMessages } from '@/hooks/useChatMessages'
import { uploadChatMedia } from '@/lib/chatUtils'
import { createClient } from '@/lib/supabase/client'
import TypingDots from './TypingDots'
import MediaViewer from './MediaViewer'

import type { ChatWithPost, Message } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ChatThreadProps {
    chatId: string
}



export default function ChatThread({ chatId }: ChatThreadProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useUser()
    const { messages, upsertMessages } = useChatMessages(chatId, user?.id)
    const [chat, setChat] = useState<ChatWithPost | null>(null)
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [otherUserTyping, setOtherUserTyping] = useState(false)

    const [isMobile, setIsMobile] = useState(false)
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
    const inputRef = useRef<HTMLInputElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Simple scroll to bottom function
    const scrollToBottom = useCallback(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
    }, [])

    // Auto-scroll to bottom when user sends a message (only if near bottom)
    // Don't auto-scroll for incoming messages to avoid interrupting reading
    const handleSendMessage = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || sending || !user) return

        const messageText = newMessage.trim()
        setNewMessage('')
        setSending(true)

        try {
            await sendMessage({
                chatId,
                senderId: user.id,
                body: messageText,
            })

            // Auto-scroll after sending (only if user is near bottom)
            const container = messagesContainerRef.current
            if (container) {
                const { scrollTop, scrollHeight, clientHeight } = container
                const distanceFromBottom = scrollHeight - scrollTop - clientHeight

                // Only auto-scroll if user is within 300px of bottom
                if (distanceFromBottom < 300) {
                    setTimeout(scrollToBottom, 100)
                }
            }

            // Stop typing indicator
            setIsTyping(false)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, false, user.id)
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
            // Keep focus on desktop after sending
            if (!isMobile) {
                requestAnimationFrame(() => inputRef.current?.focus())
            }
        }
    }

    // Scroll to bottom on initial load
    useEffect(() => {
        if (messages.length > 0 && !loading) {
            setTimeout(scrollToBottom, 200)
        }
    }, [messages.length, loading, scrollToBottom])

    // Force scroll to bottom if redirected from message button
    useEffect(() => {
        const shouldScroll = searchParams.get('scrollToBottom') === 'true'
        if (shouldScroll && messages.length > 0 && !loading) {
            // Use a shorter delay for immediate scroll
            setTimeout(scrollToBottom, 100)
        }
    }, [searchParams, messages.length, loading, scrollToBottom])
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const messageChannelsRef = useRef<RealtimeChannel[]>([])

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])





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
        markThreadRead(chatId, user.id).catch(console.error)
    }, [chatId, user, router])

    // Mark unread messages as read when window becomes visible (debounced)
    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        const handleVisibilityChange = () => {
            if (!document.hidden && user) {
                clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    markThreadRead(chatId, user.id).catch(console.error)
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

        const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id

        // Subscribe to typing indicators
        const typingChannel = subscribeToTyping(chatId, user.id, (state) => {
            const otherUserTyping = Object.values(state).some(users =>
                users.some(u => u.user === otherUserId && u.typing)
            )
            setOtherUserTyping(otherUserTyping)
        })

        messageChannelsRef.current = [typingChannel]

        return () => {
            messageChannelsRef.current.forEach(channel => channel.unsubscribe())
            messageChannelsRef.current = []
        }
    }, [chatId, user, chat, upsertMessages])

    // Listen for chat deletion events to clean up subscriptions
    useEffect(() => {
        const handleChatDeleted = (event: CustomEvent<{ chatId: string }>) => {
            if (event.detail.chatId === chatId) {
                messageChannelsRef.current.forEach(channel => {
                    channel.unsubscribe()
                })
                messageChannelsRef.current = []
            }
        }

        window.addEventListener('chat-deleted', handleChatDeleted as EventListener)
        return () => window.removeEventListener('chat-deleted', handleChatDeleted as EventListener)
    }, [chatId])



    const handleTyping = useCallback(() => {
        if (!isTyping) {
            setIsTyping(true)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, true, user!.id)
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
                    updateTypingStatus(channel, false, user!.id)
                }
            })
        }, 1500)
    }, [isTyping, user])



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage(e)
        }
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
            const supabase = createClient()
            const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id
            const mediaUrl = await uploadChatMedia(file, user.id, otherUserId, setUploadProgress)

            // Send media message
            await supabase.from('messages').insert([{
                chat_id: chatId,
                sender_id: user.id,
                body: `[MEDIA]${mediaUrl}`,
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



    if (loading) {
        return (
            <div className="flex flex-col h-full bg-[#0b0b0b]">
                {/* Header Skeleton */}
                <div className="p-6 border-b border-gray-800/50 bg-[#0b0b0b]/80 backdrop-blur-xl">
                    <div className="animate-pulse flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                        <div className="flex-1">
                            <div className="h-5 bg-gray-700 rounded w-24 mb-1"></div>
                            <div className="h-3 bg-gray-700 rounded w-16"></div>
                        </div>
                    </div>
                </div>

                {/* Messages Skeleton */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`animate-pulse ${i % 2 === 0 ? 'ml-auto' : 'mr-auto'}`}
                        >
                            <div className={`h-12 bg-gray-700 rounded-2xl ${i % 2 === 0 ? 'w-32' : 'w-24'}`}></div>
                        </motion.div>
                    ))}
                </div>

                {/* Input Skeleton */}
                <div className="p-6 border-t border-gray-800/50 bg-[#0b0b0b]/80 backdrop-blur-xl">
                    <div className="animate-pulse flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                        <div className="flex-1 h-12 bg-gray-700 rounded-2xl"></div>
                        <div className="w-20 h-12 bg-gray-700 rounded-2xl"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!chat || !user) return null

    const otherUser = chat.user1_id === user.id ? chat.user2 : chat.user1

    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 sticky top-0 z-10 bg-black border-b border-gray-800 p-3 md:p-4">
                <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            {otherUser?.avatar_url ? (
                                <img
                                    src={otherUser.avatar_url}
                                    alt={otherUser.username}
                                    className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shadow-lg"
                                />
                            ) : (
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                    <span className="text-white font-bold text-base md:text-lg">
                                        {otherUser?.username?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                </div>
                            )}
                            {/* Online indicator */}
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded-full border-2 border-black"></div>
                        </div>

                        {/* User Info - Ensure name is always visible */}
                        <div className="min-w-0 flex-1">
                            <h2 className="font-semibold text-white text-base md:text-lg truncate">@{otherUser?.username || 'Unknown'}</h2>
                            {otherUserTyping ? (
                                <div className="flex items-center space-x-1">
                                    <TypingDots />
                                    <span className="text-xs text-gray-400">typing...</span>
                                </div>
                            ) : messages.length > 0 ? (
                                <span className="text-xs text-gray-500 truncate">
                                    Active {formatTimeAgo(messages[messages.length - 1].created_at)}
                                </span>
                            ) : (
                                <span className="text-xs text-gray-500">Say hi 👋</span>
                            )}
                        </div>
                    </div>

                    {/* Menu Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </motion.button>
                </div>
            </div>

            {/* Scrollable Messages - Fixed height calculation */}
            <div
                ref={messagesContainerRef}
                id="messages-container"
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth"
                style={{
                    maxHeight: 'calc(100vh - 140px)', // Account for header + input bar
                    WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                }}
            >
                {/* Messages */}
                <AnimatePresence>
                    {messages.map((message) => {
                        const isMine = message.sender_id === user.id

                        return (
                            <motion.div
                                key={message.id}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                            >
                                <div
                                    className={`max-w-[70%] break-words px-4 py-2 text-sm rounded-2xl shadow-md ${isMine
                                        ? 'bg-red-600 text-white rounded-br-sm shadow-[0_0_8px_rgba(255,0,60,0.3)]'
                                        : 'bg-[#141414] text-gray-200 rounded-bl-sm'
                                        }`}
                                >
                                    {message.body.startsWith('[MEDIA]') ? (
                                        (() => {
                                            const mediaUrl = message.body.replace('[MEDIA]', '')
                                            const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov') || mediaUrl.includes('.avi')

                                            return isVideo ? (
                                                <video
                                                    src={mediaUrl}
                                                    controls
                                                    className="max-w-full rounded-2xl border border-gray-600 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    style={{ maxHeight: '300px' }}
                                                    onClick={() => setMediaViewer({ isOpen: true, mediaUrl, isVideo: true })}
                                                />
                                            ) : (
                                                <img
                                                    src={mediaUrl}
                                                    alt="shared media"
                                                    className="max-w-full rounded-2xl border border-gray-600 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    style={{ maxHeight: '300px' }}
                                                    onClick={() => setMediaViewer({ isOpen: true, mediaUrl, isVideo: false })}
                                                />
                                            )
                                        })()
                                    ) : (
                                        <p className="whitespace-pre-wrap break-words">
                                            {message.body}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>

                {/* Typing Indicator */}
                {otherUserTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                        <div className="bg-[#141414] text-gray-200 rounded-2xl rounded-bl-sm px-4 py-2">
                            <TypingDots />
                        </div>
                    </motion.div>
                )}

                {/* Empty State */}
                {messages.length === 0 && !otherUserTyping && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex items-center justify-center"
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Start a conversation</h3>
                            <p className="text-gray-400">Send a message to @{otherUser?.username || 'Unknown'}</p>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar - Mobile Optimized */}
            <div className="flex-shrink-0 sticky bottom-0 bg-black border-t border-gray-800 p-2 md:p-3 flex items-end gap-2"
                style={{
                    paddingBottom: isMobile ? 'max(8px, env(safe-area-inset-bottom))' : '12px'
                }}>
                {/* Upload Progress */}
                {uploading && (
                    <div className="absolute -top-12 left-2 right-2 flex items-center space-x-3 text-gray-400">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-2 bg-red-500 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <span className="text-sm">{uploadProgress}%</span>
                    </div>
                )}

                {/* File Upload Button */}
                <button
                    type="button"
                    className="p-2 rounded-full hover:bg-gray-900 transition-colors touch-manipulation flex-shrink-0"
                    onClick={(e) => {
                        e.preventDefault()
                        // Trigger file input using ref
                        fileInputRef.current?.click()
                    }}
                    onTouchStart={(e) => {
                        e.preventDefault()
                        // Trigger file input using ref
                        fileInputRef.current?.click()
                    }}
                >
                    <Plus className="w-5 h-5 text-gray-400" />
                </button>

                {/* Hidden File Input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading}
                />

                {/* Message Input */}
                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Message..."
                        value={newMessage}
                        onChange={(e) => {
                            setNewMessage(e.target.value)
                            handleTyping()
                        }}
                        onKeyDown={handleKeyDown}

                        className="w-full bg-gray-900 rounded-full px-4 py-3 md:py-2 text-sm text-white outline-none border border-gray-800 focus:border-red-500 transition-colors touch-manipulation"
                        disabled={sending || uploading}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        inputMode="text"
                        style={{
                            WebkitAppearance: 'none',
                            WebkitTapHighlightColor: 'transparent'
                        }}
                    />
                </div>

                {/* Send Button */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendMessage}
                    onTouchStart={(e) => {
                        e.preventDefault()
                        handleSendMessage(e)
                    }}
                    disabled={!newMessage.trim() || sending || uploading}
                    className={`px-4 py-3 md:py-2 rounded-full text-white font-medium transition-all touch-manipulation flex-shrink-0 ${newMessage.trim() && !sending && !uploading
                        ? 'bg-red-600 hover:bg-red-700 active:bg-red-700'
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        }`}
                    style={{
                        WebkitTapHighlightColor: 'transparent',
                        minWidth: '60px'
                    }}
                >
                    {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <span className="text-sm">Send</span>
                    )}
                </motion.button>
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
