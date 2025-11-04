import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ChatRoomPage } from '@/components/chat-room-page'
import type { Chat, Message } from '@/lib/types'

interface PageProps {
    params: Promise<{ id: string }>
}

async function getChat(chatId: string, userId: string) {
    const supabase = await createServerSupabaseClient()

    const { data: chat, error } = await supabase
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
      )
    `)
        .eq('id', chatId)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .single()

    if (error || !chat) {
        return null
    }

    return chat as Chat
}

async function getMessages(chatId: string, userId: string, cursor?: string) {
    const supabase = await createServerSupabaseClient()

    let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(50)

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data: messages, error } = await query

    if (error) {
        console.error('Error fetching messages:', error)
        return []
    }

    // Mark messages as read
    const unreadMessageIds = messages
        .filter(msg => msg.sender_id !== userId && !msg.read_at)
        .map(msg => msg.id)

    if (unreadMessageIds.length > 0) {
        await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadMessageIds)
    }

    return messages.reverse() as Message[]
}

async function getOtherUser(chat: Chat, userId: string) {
    const otherUserId = chat.buyer_id === userId ? chat.seller_id : chat.buyer_id

    const supabase = await createServerSupabaseClient()
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single()

    if (error) {
        console.error('Error fetching other user:', error)
        return null
    }

    return profile
}

export async function generateMetadata({ params }: PageProps) {
    const { id } = await params

    // We can't get the user here, so we'll use a generic title
    return {
        title: 'Chat - Xchange',
    }
}

export default async function ChatRoom({ params }: PageProps) {
    const { id } = await params

    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <p className="text-muted-foreground">Please sign in to view messages</p>
                </div>
            </div>
        )
    }

    const chat = await getChat(id, user.id)
    if (!chat) {
        notFound()
    }

    const messages = await getMessages(id, user.id)
    const otherUser = await getOtherUser(chat, user.id)

    return (
        <ChatRoomPage
            chat={chat}
            initialMessages={messages}
            otherUser={otherUser}
        />
    )
}
