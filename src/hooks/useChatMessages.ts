import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getChatMessages, markThreadRead } from '@/lib/db'
import type { Message } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useChatMessages(chatId: string, currentUserId?: string) {
    const [byId, setById] = useState<Record<string, Message>>({})
    const [order, setOrder] = useState<string[]>([])
    const [isSubscribed, setIsSubscribed] = useState(false)
    const channelRef = useRef<RealtimeChannel | null>(null)
    const hasSetupRef = useRef(false)

    const messages = order.map(id => byId[id]).filter(Boolean)

    const upsertMessages = useCallback((incoming: Message | Message[]) => {
        const messages = Array.isArray(incoming) ? incoming : [incoming]
        const incomingCount = messages.length

        setById(prevById => {
            const nextById = { ...prevById }
            messages.forEach(msg => {
                nextById[msg.id] = msg
            })
            // console.log('🧩 UPSERT count', incomingCount, 'store size', Object.keys(nextById).length)
            return nextById
        })

        setOrder(prevOrder => {
            const nextOrder = [...prevOrder]
            messages.forEach(msg => {
                if (!nextOrder.includes(msg.id)) {
                    // For new messages, append to end (assuming chronological order)
                    nextOrder.push(msg.id)
                }
            })
            // Sort by created_at to ensure correct order
            nextOrder.sort((a, b) => {
                const msgA = byId[a] || messages.find(m => m.id === a)
                const msgB = byId[b] || messages.find(m => m.id === b)
                if (!msgA || !msgB) return 0
                return new Date(msgA.created_at).getTime() - new Date(msgB.created_at).getTime()
            })
            return nextOrder
        })
    }, [byId])

    const loadMessages = useCallback(async () => {
        if (!chatId) return

        try {
            const messageData = await getChatMessages(chatId)
            upsertMessages(messageData)
        } catch (error) {
            console.error('Failed to load messages:', error)
        }
    }, [chatId, upsertMessages])

    // Setup realtime subscription
    useEffect(() => {
        if (!chatId || !currentUserId || hasSetupRef.current) return

        console.log(`🔄 [SETUP_REALTIME] Setting up realtime subscription for chat ${chatId}`)

        const supabase = createClient()
        // Clean up existing subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
        }

        const channel = supabase.channel(`messages-${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chatId}`,
                },
                async (payload) => {
                    console.log('📩 [MESSAGE_INSERT]', payload.new?.id, 'chat_id:', payload.new?.chat_id)
                    const msg = payload.new as Message
                    if (!msg) return

                    // Verify this message belongs to our chat
                    if (String(msg.chat_id) !== String(chatId)) {
                        console.log('🚫 [MESSAGE_INSERT] Ignoring message for different chat:', msg.chat_id, 'vs', chatId)
                        return
                    }

                    console.log('✅ [MESSAGE_INSERT] Adding message to local state')
                    upsertMessages(msg)

                    // Auto-mark read if from other user and page visible
                    if (msg.sender_id !== currentUserId && document.visibilityState === 'visible') {
                        console.log('🔖 [MESSAGE_INSERT] Auto-marking thread as read')
                        try {
                            await markThreadRead(chatId, currentUserId)
                        } catch (error) {
                            console.error('❌ [MESSAGE_INSERT] Failed to mark thread read:', error)
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chatId}`,
                },
                (payload) => {
                    console.log('🔄 [MESSAGE_UPDATE]', payload.new?.id, 'chat_id:', payload.new?.chat_id, 'is_read:', payload.new?.is_read)
                    const msg = payload.new as Message
                    if (!msg) return

                    // Verify this message belongs to our chat
                    if (String(msg.chat_id) !== String(chatId)) {
                        console.log('🚫 [MESSAGE_UPDATE] Ignoring update for different chat:', msg.chat_id, 'vs', chatId)
                        return
                    }

                    console.log('✅ [MESSAGE_UPDATE] Updating message in local state')
                    upsertMessages(msg)
                }
            )
            .subscribe((status) => {
                console.log('🔌 [REALTIME_STATUS]', status)
                setIsSubscribed(status === 'SUBSCRIBED')
                if (status === 'SUBSCRIBED') {
                    hasSetupRef.current = true
                    // Load initial messages after subscription is established
                    loadMessages()
                }
            })

        channelRef.current = channel

        return () => {
            if (channelRef.current) {
                console.log('Cleaning up realtime subscription for chat:', chatId)
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
                setIsSubscribed(false)
                hasSetupRef.current = false
            }
        }
    }, [chatId, currentUserId, upsertMessages, setIsSubscribed, loadMessages])

    return {
        messages,
        upsertMessages,
        loadMessages,
        isSubscribed
    }
}
