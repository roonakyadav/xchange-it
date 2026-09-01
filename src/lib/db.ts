import { createClient } from './supabase/client'
import { formatTimeAgo } from './time'
import type { User, Post, Chat, Message, PostWithUser, ChatWithPost, ChatWithMessages, SavedPost, Feedback, UserStats, ChatPreview } from '@/types'

let supabase: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!supabase) {
    supabase = createClient()
  }
  return supabase
}

// User operations
export async function getUserById(userId: string): Promise<User | null> {
    const { data, error } = await getClient()
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw new Error(`Failed to get user: ${error.message}`)
    }

    return data
}

export async function getUserByUsername(username: string): Promise<User | null> {
    const { data, error } = await getClient()
        .from('users')
        .select('*')
        .eq('username', username)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw new Error(`Failed to get user: ${error.message}`)
    }

    return data
}

export async function isUsernameTaken(username: string): Promise<boolean> {
    const { data, error } = await getClient()
        .from('users')
        .select('username')
        .eq('username', username)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return false // Not found
        throw new Error(`Failed to check username: ${error.message}`)
    }

    return !!data
}

// Post operations
export async function listPosts(options?: { limit?: number; cursor?: string }): Promise<PostWithUser[]> {
    let query = getClient()
        .from('posts')
        .select(`
      *,
      users (
        username,
        name,
        avatar_url
      )
    `)
        .order('created_at', { ascending: false })

    if (options?.limit) {
        query = query.limit(options.limit)
    }

    if (options?.cursor) {
        query = query.lt('created_at', options.cursor)
    }

    const { data, error } = await query

    if (error) {
        throw new Error(`Failed to list posts: ${error.message}`)
    }

    return data || []
}

export async function insertPost(post: {
    user_id: string
    title: string
    description: string
    image_url: string
    mode: 'selling' | 'requesting'
    category?: string
    tags?: string[]
}): Promise<Post> {
    const { data, error } = await getClient()
        .from('posts')
        .insert(post)
        .select()
        .single()

    if (error) {
        throw new Error(`Failed to create post: ${error.message}`)
    }

    return data
}

export async function getPost(id: string): Promise<PostWithUser | null> {
    const { data, error } = await getClient()
        .from('posts')
        .select(`
      *,
      users (
        username,
        name,
        avatar_url
      )
    `)
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw new Error(`Failed to get post: ${error.message}`)
    }

    return data
}

// Chat operations
export async function getOrCreateChat(options: {
    user1_id: string
    user2_id: string
    postId?: string
}): Promise<Chat> {
    // First try to find existing chat
    const { data: existingChat, error: findError } = await getClient()
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${options.user1_id},user2_id.eq.${options.user2_id}),and(user1_id.eq.${options.user2_id},user2_id.eq.${options.user1_id})`)
        .eq('post_id', options.postId || null)
        .single()

    if (findError && findError.code !== 'PGRST116') {
        throw new Error(`Failed to find chat: ${findError.message}`)
    }

    if (existingChat) {
        return existingChat
    }

    // Create new chat
    const { data: newChat, error: createError } = await getClient()
        .from('chats')
        .insert({
            user1_id: options.user1_id,
            user2_id: options.user2_id,
            post_id: options.postId,
        })
        .select()
        .single()

    if (createError) {
        throw new Error(`Failed to create chat: ${createError.message}`)
    }

    return newChat
}

export async function listChats(userId: string): Promise<ChatWithPost[]> {
    const { data, error } = await getClient()
        .from('chats')
        .select(`
      *,
      posts (
        title,
        image_url
      )
    `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to list chats: ${error.message}`)
    }

    return data || []
}

// Message operations
export async function insertMessage(message: {
    chat_id: string
    sender_id: string
    body: string
}): Promise<Message> {
    const { data, error } = await getClient()
        .from('messages')
        .insert(message)
        .select()
        .single()

    if (error) {
        throw new Error(`Failed to create message: ${error.message}`)
    }

    return data
}

// New functions for feed filters and profile management
export async function getPostsByMode(mode: 'selling' | 'requesting'): Promise<PostWithUser[]> {
    const { data, error } = await getClient()
        .from('posts')
        .select(`
      *,
      users (
        username,
        name,
        avatar_url
      )
    `)
        .eq('mode', mode)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to get posts by mode: ${error.message}`)
    }

    return data || []
}

export async function getUserPosts(userId: string): Promise<PostWithUser[]> {
    const { data, error } = await getClient()
        .from('posts')
        .select(`
      *,
      users (
        username,
        name,
        avatar_url
      )
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to get user posts: ${error.message}`)
    }

    return data || []
}

export async function deletePost(id: string): Promise<void> {
    console.log('Calling Supabase delete for post ID:', id)
    const { data, error } = await getClient()
        .from('posts')
        .delete()
        .eq('id', id)
        .select()

    console.log('Supabase delete response:', { data, error })

    if (error) {
        console.error('Supabase delete error:', error)
        throw new Error(`Failed to delete post: ${error.message}`)
    }

    if (!data || data.length === 0) {
        console.warn('No post was deleted, post ID may not exist:', id)
    } else {
        console.log('Successfully deleted post:', data)
    }
}

export async function deleteStorageFile(imageUrl: string): Promise<void> {
    // Extract file path from public URL
    // URL format: https://[project].getClient().co/storage/v1/object/public/post-images/[filename]
    console.log('Extracting filename from URL:', imageUrl)
    const urlParts = imageUrl.split('/post-images/')
    if (urlParts.length !== 2) {
        console.error('Invalid image URL format, could not find /post-images/ in URL')
        throw new Error('Invalid image URL format')
    }

    const filename = urlParts[1]
    console.log('Extracted filename:', filename)

    console.log('Calling Supabase storage remove for file:', filename)
    const { data, error } = await getClient().storage
        .from('post-images')
        .remove([filename])

    console.log('Supabase storage remove response:', { data, error })

    if (error) {
        console.error('Supabase storage remove error:', error)
        throw new Error(`Failed to delete storage file: ${error.message}`)
    }

    console.log('Successfully deleted storage file')
}

export async function deletePostCascade(postId: string) {
    console.log('Starting cascade deletion for post:', postId)

    // First get all chat IDs linked to this post
    const { data: chats, error: chatsFetchError } = await getClient()
        .from('chats')
        .select('id')
        .eq('post_id', postId)

    if (chatsFetchError) {
        console.error('Failed to fetch chats for post:', chatsFetchError)
        throw new Error(`Failed to fetch chats: ${chatsFetchError.message}`)
    }

    const chatIds = chats?.map(chat => chat.id) || []

    // Delete all messages linked to these chats
    if (chatIds.length > 0) {
        console.log('Deleting messages linked to chats for this post...')
        const { error: messagesError } = await getClient()
            .from('messages')
            .delete()
            .in('chat_id', chatIds)

        if (messagesError) {
            console.error('Failed to delete messages:', messagesError)
            throw new Error(`Failed to delete messages: ${messagesError.message}`)
        }
    }

    // Then delete all chats linked to this post
    console.log('Deleting chats linked to this post...')
    const { error: chatsError } = await getClient()
        .from('chats')
        .delete()
        .eq('post_id', postId)

    if (chatsError) {
        console.error('Failed to delete chats:', chatsError)
        throw new Error(`Failed to delete chats: ${chatsError.message}`)
    }

    // Finally delete the post
    console.log('Deleting post from database...')
    const { data, error: postError } = await getClient()
        .from('posts')
        .delete()
        .eq('id', postId)
        .select()

    if (postError) {
        console.error('Failed to delete post:', postError)
        throw new Error(`Failed to delete post: ${postError.message}`)
    }

    console.log('Cascade deletion completed successfully')
    return data
}

export async function deletePostAndImage(postId: string, imageUrl?: string): Promise<void> {
    console.log('Starting deletion of post:', postId, 'and image:', imageUrl)

    try {
        // Delete the image first (ignore if missing)
        if (imageUrl) {
            console.log('Deleting image file...')
            try {
                await deleteStorageFile(imageUrl)
                console.log('Image deleted successfully')
            } catch (imageError) {
                console.warn('Image deletion failed or image not found:', imageError)
                // Continue with post deletion even if image deletion fails
            }
        }

        // Use cascade deletion for post and related data
        await deletePostCascade(postId)

    } catch (err: unknown) {
        console.error('Delete failed:', err)
        throw new Error(err instanceof Error ? err.message : 'Failed to delete post')
    }
}

export async function deleteAccount(userId: string): Promise<void> {
    console.log('Starting account deletion for user ID:', userId)

    // Get user data first
    const { data: user, error: userFetchError } = await getClient()
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

    if (userFetchError || !user) {
        throw new Error(`User not found: ${userFetchError?.message || 'User does not exist'}`)
    }

    try {
        // Delete user's avatar file if it exists
        if (user.avatar_url) {
            console.log('Deleting user avatar...')
            try {
                await deleteStorageFile(user.avatar_url)
                console.log('User avatar deleted')
            } catch (avatarError) {
                console.warn('Failed to delete avatar, continuing:', avatarError)
            }
        }

        // Delete user from users table (this will cascade to posts, chats, messages due to foreign keys)
        console.log('Deleting user account...')
        const { error: userError } = await getClient()
            .from('users')
            .delete()
            .eq('id', userId)

        if (userError) {
            console.error('Error deleting user:', userError)
            throw new Error(`Failed to delete user: ${userError.message}`)
        }

        // Sign out from Supabase Auth
        await getClient().auth.signOut()
        
        console.log('User account deleted successfully')

    } catch (error) {
        console.error('Critical error during account deletion:', error)
        throw error
    }
}

// Chat and messaging helpers
export async function getChatsForUser(userId: string): Promise<ChatWithPost[]> {
    const { data, error } = await getClient()
        .from('chats')
        .select(`
      *,
      posts (
        title,
        image_url
      )
    `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('updated_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to get chats for user: ${error.message}`)
    }

    return data || []
}

export async function getChatById(id: string): Promise<ChatWithPost | null> {
    const { data, error } = await getClient()
        .from('chats')
        .select(`
      *,
      posts (
        title,
        image_url
      ),
      user1:users!chats_user1_id_fkey (
        id,
        username,
        name,
        avatar_url
      ),
      user2:users!chats_user2_id_fkey (
        id,
        username,
        name,
        avatar_url
      )
    `)
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw new Error(`Failed to get chat: ${error.message}`)
    }

    return data
}

export async function listMessages(chatId: string, options?: { limit?: number; before?: string }): Promise<Message[]> {
    let query = getClient()
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

    if (options?.limit) {
        query = query.limit(options.limit)
    }

    if (options?.before) {
        query = query.lt('created_at', options.before)
    }

    const { data, error } = await query

    if (error) {
        throw new Error(`Failed to list messages: ${error.message}`)
    }

    return data || []
}

export async function sendMessage({ chatId, senderId, body }: { chatId: string; senderId: string; body: string }): Promise<Message> {
    console.log('📤 [SEND_MESSAGE] chatId:', chatId, 'senderId:', senderId, 'body length:', body.length)

    // First ensure the chat exists and get its details
    const chat = await getChatById(chatId)
    if (!chat) {
        throw new Error('Chat not found')
    }

    // Insert the message
    const { data: message, error: messageError } = await getClient()
        .from('messages')
        .insert({
            chat_id: chatId,
            sender_id: senderId,
            body,
            // Don't set is_read or read_at for new messages - they get marked as read when recipient opens chat
        })
        .select()
        .single()

    if (messageError) {
        console.error('❌ [SEND_MESSAGE] Failed to insert message:', messageError)
        throw new Error(`Failed to send message: ${messageError.message}`)
    }

    console.log('✅ [SEND_MESSAGE] Message inserted:', message.id)

    // Update chat with last message info (deterministic upsert)
    const updateData: {
        last_message: string
        last_sender_id: string
        updated_at: string
        unread_user1?: number
        unread_user2?: number
    } = {
        last_message: body,
        last_sender_id: senderId,
        updated_at: new Date().toISOString()
    }

    // Update unread counts
    if (chat.user1_id === senderId) {
        updateData.unread_user2 = (chat.unread_user2 || 0) + 1
    } else {
        updateData.unread_user1 = (chat.unread_user1 || 0) + 1
    }

    const { error: chatError } = await getClient()
        .from('chats')
        .update(updateData)
        .eq('id', chatId)

    if (chatError) {
        console.error('❌ [SEND_MESSAGE] Failed to update chat:', chatError)
        // Don't throw here - message was sent successfully, just log the error
    } else {
        console.log('✅ [SEND_MESSAGE] Chat updated with last message')
    }

    return message
}

// Send message to a user, creating chat if it doesn't exist
export async function sendMessageToUser({
    senderId,
    recipientId,
    body,
    postId
}: {
    senderId: string
    recipientId: string
    body: string
    postId?: string
}): Promise<{ message: Message; chat: Chat }> {
    console.log('📤 [SEND_MESSAGE_TO_USER] senderId:', senderId, 'recipientId:', recipientId, 'body length:', body.length)

    // Get or create chat
    const chat = await getOrCreateChat({
        user1_id: senderId,
        user2_id: recipientId,
        postId
    })

    console.log('✅ [SEND_MESSAGE_TO_USER] Chat ready:', chat.id)

    // Send message using existing chat
    const message = await sendMessage({
        chatId: chat.id,
        senderId,
        body
    })

    console.log('✅ [SEND_MESSAGE_TO_USER] Message sent successfully')
    return { message, chat }
}

export async function markDelivered(chatId: string, messageIds: string[]): Promise<void> {
    const { error } = await getClient()
        .from('messages')
        .update({ delivered_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .in('id', messageIds)
        .is('delivered_at', null)

    if (error) {
        throw new Error(`Failed to mark messages as delivered: ${error.message}`)
    }
}

export async function markThreadRead(chatId: string, myUserId: string) {
    console.log('🔖 [MARK_THREAD_READ] chatId:', chatId, 'user:', myUserId)

    // Use SECURITY DEFINER function to mark messages as read
    // This bypasses RLS to allow marking messages from other participants as read
    const { data, error } = await getClient()
        .rpc('mark_messages_read', {
            chat_id: chatId,
            reader_id: myUserId
        })

    if (error) {
        console.error('❌ [MARK_THREAD_READ] Failed to mark messages as read:', error)
        throw new Error(`Failed to mark thread read: ${error.message}`)
    }

    console.log(`✅ [MARK_THREAD_READ] Marked ${data || 0} messages as read`)
}

export async function deleteChatForMe(chatId: string, myUserId: string, user1Id: string, user2Id: string) {
    const field = myUserId === user1Id ? 'deleted_by_user1' : 'deleted_by_user2';
    console.log("🗑 deleteChatForMe", chatId, field);
    return getClient().from('chats').update({ [field]: true }).eq('id', chatId);
}

export async function deleteChat(chatId: string, currentUserId: string): Promise<void> {
    // First get the chat to determine which user field to update
    const { data: chat, error: fetchError } = await getClient()
        .from('chats')
        .select('user1_id, user2_id')
        .eq('id', chatId)
        .single()

    if (fetchError) {
        throw new Error(`Failed to fetch chat: ${fetchError.message}`)
    }

    if (!chat) {
        throw new Error('Chat not found')
    }

    // Determine which field to update based on current user
    const updateField = chat.user1_id === currentUserId ? 'deleted_by_user1' : 'deleted_by_user2'

    const { error } = await getClient()
        .from('chats')
        .update({ [updateField]: true })
        .eq('id', chatId)

    if (error) {
        throw new Error(`Failed to delete chat: ${error.message}`)
    }
}



// Chat preview functions for chat list
export async function getVisibleChats(userId: string): Promise<ChatPreview[]> {
    console.log(`👀 [GET_VISIBLE_CHATS] Fetching visible chats for user: ${userId}`)

    // Get all chats for user that are not deleted by current user
    // Use a more efficient query that gets chats with their last message in one go
    const { data: chats, error: chatsError } = await getClient()
        .from('chats')
        .select(`
            *,
            posts (
                title,
                image_url
            )
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('updated_at', { ascending: false, nullsFirst: false })

    if (chatsError) {
        console.error('❌ [GET_VISIBLE_CHATS] Failed to get chats:', chatsError)
        throw new Error(`Failed to get chats: ${chatsError.message}`)
    }

    if (!chats || chats.length === 0) {
        console.log('ℹ️ [GET_VISIBLE_CHATS] No chats found for user')
        return []
    }

    console.log(`📋 [GET_VISIBLE_CHATS] Found ${chats.length} total chats, filtering visible ones...`)

    // Filter chats based on visibility rules and get message data
    const visibleChats: ChatPreview[] = []

    for (const chat of chats) {
        // Check if chat is deleted by current user
        const isDeletedByMe = (chat.user1_id === userId && chat.deleted_by_user1) ||
            (chat.user2_id === userId && chat.deleted_by_user2)

        if (isDeletedByMe) {
            console.log(`🚫 [GET_VISIBLE_CHATS] Skipping deleted chat: ${chat.id}`)
            continue
        }

        const otherUserId = chat.user1_id === userId ? chat.user2_id : chat.user1_id

        // Get all messages for this chat to calculate unread counts
        const { data: messages, error: messagesError } = await getClient()
            .from('messages')
            .select('*')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })

        if (messagesError) {
            console.error(`❌ [GET_VISIBLE_CHATS] Error getting messages for chat ${chat.id}:`, messagesError)
            continue
        }

        // Skip chats with no messages (shouldn't happen with proper upsert, but safety check)
        if (!messages || messages.length === 0) {
            console.log(`⚠️ [GET_VISIBLE_CHATS] Skipping chat ${chat.id} with no messages`)
            continue
        }

        // Get the last message
        const lastMessage = messages[0]

        // Calculate unread counts using the stored unread counters from the chat table
        // This is more efficient than recalculating from all messages
        const unreadCount = chat.user1_id === userId ? (chat.unread_user1 || 0) : (chat.unread_user2 || 0)
        const outgoingPendingCount = chat.user1_id === userId ? (chat.unread_user2 || 0) : (chat.unread_user1 || 0)

        console.log(`✅ [GET_VISIBLE_CHATS] Including chat ${chat.id} with ${messages.length} messages, unread: ${unreadCount}`)

        visibleChats.push({
            ...chat,
            lastMessage,
            unreadCount,
            outgoingPendingCount,
            otherUser: otherUserId,
        })
    }

    console.log(`🎯 [GET_VISIBLE_CHATS] Returning ${visibleChats.length} visible chats`)
    return visibleChats
}

export async function getChatMessages(chatId: string): Promise<Message[]> {
    const { data, error } = await getClient()
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true, nullsFirst: false })

    if (error) {
        throw new Error(`Failed to get messages: ${error.message}`)
    }

    return data || []
}

export function computePreview(myUserId: string, messages: Message[]): string {
    if (!messages || messages.length === 0) return 'Say hi 👋'

    const unreadIncoming = messages.filter(m => m.sender_id !== myUserId && !m.is_read).length
    const unreadOutgoing = messages.filter(m => m.sender_id === myUserId && !m.is_read).length
    const last = messages[messages.length - 1]

    // Priority 1: unreadIncoming > 0 → bold "{unreadIncoming} unread messages"
    if (unreadIncoming > 0) {
        return `**${unreadIncoming} unread message${unreadIncoming > 1 ? 's' : ''}**`
    }

    // Priority 2: last.sender_id != myUserId → last.body (truncate)
    if (last && last.sender_id !== myUserId) {
        return last.body.length > 50 ? last.body.substring(0, 50) + '...' : last.body
    }

    // Priority 3: unreadOutgoing > 0 → "{unreadOutgoing} messages sent"
    if (unreadOutgoing > 0) {
        return `${unreadOutgoing} message${unreadOutgoing > 1 ? 's' : ''} sent`
    }

    // Priority 4: last.read_at exists → "Seen {timeAgo(last.read_at)}"
    if (last?.read_at) {
        return `Seen ${formatTimeAgo(last.read_at)}`
    }

    // Fallback
    return last?.body || 'Say hi 👋'
}

// Legacy function for backward compatibility
export async function getChatPreviews(userId: string): Promise<ChatPreview[]> {
    return getVisibleChats(userId)
}

// Saved Posts operations
export async function savePost(userId: string, postId: string): Promise<SavedPost> {
    try {
        const { data, error } = await getClient()
            .from('saved_posts')
            .insert({
                user_id: userId,
                post_id: postId
            })
            .select()
            .single()

        if (error) {
            // If table doesn't exist yet, throw a more specific error
            if (error.code === '42P01') {
                throw new Error('Saved posts feature is not available yet. Please run the database migrations.')
            }
            throw new Error(`Failed to save post: ${error.message}`)
        }

        return data
    } catch (error) {
        console.error('Error in savePost:', error)
        throw error
    }
}

export async function unsavePost(userId: string, postId: string): Promise<void> {
    try {
        const { error } = await getClient()
            .from('saved_posts')
            .delete()
            .eq('user_id', userId)
            .eq('post_id', postId)

        if (error) {
            // If table doesn't exist yet, throw a more specific error
            if (error.code === '42P01') {
                throw new Error('Saved posts feature is not available yet. Please run the database migrations.')
            }
            throw new Error(`Failed to unsave post: ${error.message}`)
        }
    } catch (error) {
        console.error('Error in unsavePost:', error)
        throw error
    }
}

export async function getSavedPosts(userId: string): Promise<SavedPost[]> {
    try {
        const { data, error } = await getClient()
            .from('saved_posts')
            .select(`
                *,
                posts!inner (
                    id,
                    user_id,
                    title,
                    description,
                    image_url,
                    mode,
                    price,
                    category,
                    tags,
                    created_at,
                    users!inner (
                        username,
                        name,
                        avatar_url
                    )
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) {
            // If table doesn't exist yet, return empty array
            if (error.code === '42P01') {
                console.warn('saved_posts table does not exist yet, returning empty array')
                return []
            }
            throw new Error(`Failed to get saved posts: ${error.message}`)
        }

        console.log('Saved posts data:', data) // Debug log
        return data || []
    } catch (error) {
        console.error('Error in getSavedPosts:', error)
        // Return empty array on any error to prevent crashes
        return []
    }
}

export async function isPostSaved(userId: string, postId: string): Promise<boolean> {
    try {
        const { data, error } = await getClient()
            .from('saved_posts')
            .select('id')
            .eq('user_id', userId)
            .eq('post_id', postId)
            .single()

        if (error) {
            // If table doesn't exist yet, return false
            if (error.code === '42P01') {
                console.warn('saved_posts table does not exist yet, returning false')
                return false
            }
            if (error.code === 'PGRST116') return false // Not found
            throw new Error(`Failed to check if post is saved: ${error.message}`)
        }

        return !!data
    } catch (error) {
        console.error('Error in isPostSaved:', error)
        // Return false on any error to prevent crashes
        return false
    }
}

// User blocking functionality
export async function isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    try {
        const { data, error } = await getClient()
            .from('blocked_users')
            .select('*')
            .eq('blocker_id', blockerId)
            .eq('blocked_id', blockedId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') return false // Not found
            throw new Error(`Failed to check if user is blocked: ${error.message}`)
        }

        return !!data
    } catch (error) {
        console.error('Error in isUserBlocked:', error)
        return false
    }
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await getClient()
        .from('blocked_users')
        .insert({
            blocker_id: blockerId,
            blocked_id: blockedId
        })

    if (error) {
        throw new Error(`Failed to block user: ${error.message}`)
    }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await getClient()
        .from('blocked_users')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)

    if (error) {
        throw new Error(`Failed to unblock user: ${error.message}`)
    }
}

// Feedback operations
export async function submitFeedback(userId: string, rating: number, message?: string): Promise<Feedback> {
    const { data, error } = await getClient()
        .from('feedback')
        .insert({
            user_id: userId,
            rating,
            message
        })
        .select()
        .single()

    if (error) {
        throw new Error(`Failed to submit feedback: ${error.message}`)
    }

    return data
}

export async function getUserFeedback(userId: string): Promise<Feedback[]> {
    const { data, error } = await getClient()
        .from('feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to get user feedback: ${error.message}`)
    }

    return data || []
}

// User stats operations
export async function getUserStats(userId: string): Promise<UserStats> {
    // Get user data
    const { data: user, error: userError } = await getClient()
        .from('users')
        .select('username, created_at')
        .eq('id', userId)
        .single()

    if (userError) {
        throw new Error(`Failed to get user: ${userError.message}`)
    }

    // Get post count
    const { count: postCount, error: postError } = await getClient()
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

    if (postError) {
        throw new Error(`Failed to get post count: ${postError.message}`)
    }

    // For now, return basic stats. In a real app, you'd calculate views, likes, etc.
    return {
        totalPosts: postCount || 0,
        totalViews: 0, // Placeholder
        totalLikes: 0, // Placeholder
        totalComments: 0, // Placeholder
        joinDate: user?.created_at || new Date().toISOString(),
        lastActive: new Date().toISOString() // Placeholder
    }
}

// Update user profile with bio and portfolio
export async function updateUserProfile(userId: string, updates: {
    name?: string
    username?: string
    bio?: string
    portfolio?: string
    avatar_url?: string
}): Promise<User> {
    const { data, error } = await getClient()
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

    if (error) {
        throw new Error(`Failed to update user profile: ${error.message}`)
    }

    return data
}
