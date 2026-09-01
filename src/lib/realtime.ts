import { createClient } from './supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Message } from '@/types'

let supabase: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!supabase) {
    supabase = createClient()
  }
  return supabase
}

export interface TypingUser {
    user: string
    typing: boolean
}

export interface PresenceState {
    [key: string]: TypingUser[]
}

// Message realtime subscription for specific chat
export function subscribeToMessages(
    chatId: string,
    onMessage: (message: Message, eventType: 'INSERT' | 'UPDATE') => void,
    currentUserId?: string
): RealtimeChannel {
    console.log(`Setting up realtime subscription for chat ${chatId}`)

    const channel = getClient()
        .channel(`messages-${chatId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`,
            },
            async (payload: RealtimePostgresChangesPayload<Message>) => {
                console.log('Realtime INSERT message received:', payload)
                if (payload.new) {
                    const message = payload.new as Message
                    console.log('New message:', message)

                    // If we have a current user, check if sender is blocked
                    if (currentUserId && message.sender_id !== currentUserId) {
                        try {
                            const { isUserBlocked } = await import('./db')
                            const blocked = await isUserBlocked(currentUserId, message.sender_id)
                            if (blocked) {
                                console.log('Ignoring message from blocked user')
                                // Ignore messages from blocked users
                                return
                            }
                        } catch (error) {
                            // Block check failed silently - allow message through
                        }
                    }

                    console.log('Calling onMessage callback for INSERT')
                    onMessage(message, 'INSERT')
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
            (payload: RealtimePostgresChangesPayload<Message>) => {
                console.log('Realtime UPDATE message received:', payload)
                if (payload.new) {
                    const message = payload.new as Message
                    console.log('Updated message:', message)
                    onMessage(message, 'UPDATE')
                }
            }
        )
        .subscribe((status) => {
            console.log(`Realtime subscription status for chat ${chatId}:`, status)
        })

    return channel
}

// Typing indicator with presence
export function subscribeToTyping(
    chatId: string,
    currentUserId: string,
    onPresenceUpdate: (state: PresenceState) => void
): RealtimeChannel {
    const channel = getClient().channel(`presence-typing-${chatId}`, {
        config: {
            presence: {
                key: currentUserId,
            },
        },
    })

    channel
        .on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState() as PresenceState
            onPresenceUpdate(presenceState)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('User joined:', key, newPresences)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('User left:', key, leftPresences)
        })
        .subscribe()

    return channel
}

// Update typing status
export function updateTypingStatus(
    channel: RealtimeChannel,
    isTyping: boolean,
    userId: string
): void {
    channel.track({
        user: userId,
        typing: isTyping,
    })
}

// Chat updates subscription (for unread counters, last message, new chats, re-activation)
export function subscribeToChatUpdates(
    userId: string,
    onChatUpdate: () => void
): RealtimeChannel {
    console.log(`🔄 [CHAT_SUBSCRIBE] Setting up chat updates for user: ${userId}`)

    const channel = getClient()
        .channel(`chats-${userId}`)
        // Listen for new chats involving this user
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
                filter: `user1_id=eq.${userId}`,
            },
            (payload) => {
                console.log('🆕 [CHAT_INSERT] New chat for user1:', payload.new?.id)
                onChatUpdate()
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
                filter: `user2_id=eq.${userId}`,
            },
            (payload) => {
                console.log('🆕 [CHAT_INSERT] New chat for user2:', payload.new?.id)
                onChatUpdate()
            }
        )
        // Listen for chat updates (last message, unread counts, deleted flag changes)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'chats',
                filter: `user1_id=eq.${userId}`,
            },
            (payload) => {
                console.log('🔄 [CHAT_UPDATE] Chat update for user1:', payload.new?.id, {
                    last_message: payload.new?.last_message?.substring(0, 20) + '...',
                    unread_user1: payload.new?.unread_user1,
                    unread_user2: payload.new?.unread_user2,
                    deleted_by_user1: payload.new?.deleted_by_user1,
                    deleted_by_user2: payload.new?.deleted_by_user2
                })
                onChatUpdate()
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'chats',
                filter: `user2_id=eq.${userId}`,
            },
            (payload) => {
                console.log('🔄 [CHAT_UPDATE] Chat update for user2:', payload.new?.id, {
                    last_message: payload.new?.last_message?.substring(0, 20) + '...',
                    unread_user1: payload.new?.unread_user1,
                    unread_user2: payload.new?.unread_user2,
                    deleted_by_user1: payload.new?.deleted_by_user1,
                    deleted_by_user2: payload.new?.deleted_by_user2
                })
                onChatUpdate()
            }
        )
        // Listen for new messages to update chat list
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            },
            (payload) => {
                console.log("📩 [MESSAGE_INSERT] Message inserted, chat_id:", payload.new?.chat_id)
                // Trigger update for chat list when any message is inserted
                // The ChatList component will filter to only show relevant chats
                onChatUpdate()
            }
        )
        // Listen for message read status updates to update preview
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
            },
            (payload) => {
                console.log("♻ [MESSAGE_UPDATE] Message update, id:", payload.new?.id, "is_read:", payload.new?.is_read)
                // Trigger update when is_read changes (for "Seen ..." preview updates)
                onChatUpdate()
            }
        )
        .subscribe((status) => {
            console.log(`🔌 [CHAT_SUBSCRIBE] Subscription status: ${status}`)
        })

    return channel
}
