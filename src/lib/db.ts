import { supabase } from './supabase'
import type { User, Post, Chat, Message, PostWithUser, ChatWithPost, ChatWithMessages } from '@/types'

// User operations
export async function getUser(username: string): Promise<User | null> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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

export async function insertUser(user: {
    name: string
    username: string
    avatar_url?: string
}): Promise<User> {
    const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single()

    if (error) {
        throw new Error(`Failed to create user: ${error.message}`)
    }

    return data
}

export async function updateUsernameEverywhere(oldUsername: string, newUsername: string): Promise<void> {
    // Update posts
    const { error: postsError } = await supabase
        .from('posts')
        .update({ username: newUsername })
        .eq('username', oldUsername)

    if (postsError) {
        throw new Error(`Failed to update posts: ${postsError.message}`)
    }

    // Update chats user1
    const { error: chats1Error } = await supabase
        .from('chats')
        .update({ user1: newUsername })
        .eq('user1', oldUsername)

    if (chats1Error) {
        throw new Error(`Failed to update chats user1: ${chats1Error.message}`)
    }

    // Update chats user2
    const { error: chats2Error } = await supabase
        .from('chats')
        .update({ user2: newUsername })
        .eq('user2', oldUsername)

    if (chats2Error) {
        throw new Error(`Failed to update chats user2: ${chats2Error.message}`)
    }

    // Update messages sender
    const { error: messagesError } = await supabase
        .from('messages')
        .update({ sender: newUsername })
        .eq('sender', oldUsername)

    if (messagesError) {
        throw new Error(`Failed to update messages: ${messagesError.message}`)
    }
}

// Post operations
export async function listPosts(options?: { limit?: number; cursor?: string }): Promise<PostWithUser[]> {
    let query = supabase
        .from('posts')
        .select(`
      *,
      users (
        username,
        name
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
    title: string
    description: string
    image_url: string
    username: string
    mode: 'selling' | 'requesting'
    location?: string
}): Promise<Post> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
        .from('posts')
        .select(`
      *,
      users (
        username,
        name
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
    user1: string
    user2: string
    postId?: string
}): Promise<Chat> {
    // First try to find existing chat
    const { data: existingChat, error: findError } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1.eq.${options.user1},user2.eq.${options.user2}),and(user1.eq.${options.user2},user2.eq.${options.user1})`)
        .single()

    if (findError && findError.code !== 'PGRST116') {
        throw new Error(`Failed to find chat: ${findError.message}`)
    }

    if (existingChat) {
        return existingChat
    }

    // Create new chat
    const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
            user1: options.user1,
            user2: options.user2,
            post_id: options.postId,
        })
        .select()
        .single()

    if (createError) {
        throw new Error(`Failed to create chat: ${createError.message}`)
    }

    return newChat
}

export async function listChats(username: string): Promise<ChatWithPost[]> {
    const { data, error } = await supabase
        .from('chats')
        .select(`
      *,
      posts (
        title,
        image_url
      )
    `)
        .or(`user1.eq.${username},user2.eq.${username}`)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to list chats: ${error.message}`)
    }

    return data || []
}

// Message operations
export async function listMessages(chatId: string): Promise<Message[]> {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

    if (error) {
        throw new Error(`Failed to list messages: ${error.message}`)
    }

    return data || []
}

export async function insertMessage(message: {
    chat_id: string
    sender: string
    body: string
}): Promise<Message> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
        .from('posts')
        .select(`
      *,
      users (
        username,
        name
      )
    `)
        .eq('mode', mode)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to get posts by mode: ${error.message}`)
    }

    return data || []
}

export async function getUserPosts(username: string): Promise<PostWithUser[]> {
    const { data, error } = await supabase
        .from('posts')
        .select(`
      *,
      users (
        username,
        name
      )
    `)
        .eq('username', username)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to get user posts: ${error.message}`)
    }

    return data || []
}

export async function deletePost(id: string): Promise<void> {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id)

    if (error) {
        throw new Error(`Failed to delete post: ${error.message}`)
    }
}

export async function deleteStorageFile(imageUrl: string): Promise<void> {
    // Extract file path from public URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/post-images/[filename]
    const urlParts = imageUrl.split('/post-images/')
    if (urlParts.length !== 2) {
        throw new Error('Invalid image URL format')
    }

    const filePath = `post-images/${urlParts[1]}`

    const { error } = await supabase.storage
        .from('post-images')
        .remove([filePath])

    if (error) {
        throw new Error(`Failed to delete storage file: ${error.message}`)
    }
}
