import { supabase } from './supabase'
import bcrypt from 'bcryptjs'
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

export async function authenticateUser(username: string, password: string): Promise<{ user: User | null; error: 'user_not_found' | 'wrong_password' | null }> {
    const user = await getUser(username)
    if (!user) {
        return { user: null, error: 'user_not_found' }
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
        return { user: null, error: 'wrong_password' }
    }

    return { user, error: null }
}

export async function insertUser(user: {
    name: string
    username: string
    password: string
    avatar_url?: string
}): Promise<User> {
    // Hash the password
    const passwordHash = await bcrypt.hash(user.password, 12)

    const { data, error } = await supabase
        .from('users')
        .insert({
            name: user.name,
            username: user.username,
            password_hash: passwordHash,
            avatar_url: user.avatar_url
        })
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
    console.log('Calling Supabase delete for post ID:', id)
    const { data, error } = await supabase
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
    // URL format: https://[project].supabase.co/storage/v1/object/public/post-images/[filename]
    console.log('Extracting filename from URL:', imageUrl)
    const urlParts = imageUrl.split('/post-images/')
    if (urlParts.length !== 2) {
        console.error('Invalid image URL format, could not find /post-images/ in URL')
        throw new Error('Invalid image URL format')
    }

    const filename = urlParts[1]
    console.log('Extracted filename:', filename)

    console.log('Calling Supabase storage remove for file:', filename)
    const { data, error } = await supabase.storage
        .from('post-images')
        .remove([filename])

    console.log('Supabase storage remove response:', { data, error })

    if (error) {
        console.error('Supabase storage remove error:', error)
        throw new Error(`Failed to delete storage file: ${error.message}`)
    }

    console.log('Successfully deleted storage file')
}

export async function deletePostAndImage(postId: string, imageUrl: string): Promise<void> {
    console.log('Starting deletion of post:', postId, 'and image:', imageUrl)

    // Delete the image first
    console.log('Deleting image file...')
    await deleteStorageFile(imageUrl)
    console.log('Image deleted successfully')

    // Then delete the post
    console.log('Deleting post from database...')
    await deletePost(postId)
    console.log('Post deleted successfully')
}

export async function deleteAccount(userId: string): Promise<void> {
    console.log('Starting account deletion for user ID:', userId)

    // Get user data first
    const { data: user, error: userFetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

    if (userFetchError || !user) {
        throw new Error(`User not found: ${userFetchError?.message || 'User does not exist'}`)
    }

    const username = user.username

    try {
        // 1. Delete all messages by this user (using sender username)
        console.log('Deleting user messages...')
        try {
            const { error: messagesError } = await supabase
                .from('messages')
                .delete()
                .eq('sender', username)

            if (messagesError) {
                console.error('Error deleting messages:', messagesError)
            } else {
                console.log('User messages deleted')
            }
        } catch (messagesError) {
            console.error('Error deleting messages:', messagesError)
        }

        // 2. Delete all chats where user participated
        console.log('Deleting user chats...')
        try {
            const { error: chatsError } = await supabase
                .from('chats')
                .delete()
                .or(`user1.eq.${username},user2.eq.${username}`)

            if (chatsError) {
                console.error('Error deleting chats:', chatsError)
            } else {
                console.log('User chats deleted')
            }
        } catch (chatsError) {
            console.error('Error deleting chats:', chatsError)
        }

        // 3. Delete all user's posts and their images (using username)
        console.log('Deleting user posts...')
        try {
            const { data: userPosts, error: postsFetchError } = await supabase
                .from('posts')
                .select('id, image_url')
                .eq('username', username)

            if (postsFetchError) {
                console.error('Error fetching user posts:', postsFetchError)
            } else {
                for (const post of userPosts || []) {
                    console.log('Deleting post:', post.id)
                    try {
                        await deletePostAndImage(post.id, post.image_url)
                    } catch (postError) {
                        console.error('Error deleting post:', post.id, postError)
                    }
                }
                console.log('All user posts deleted')
            }
        } catch (postsError) {
            console.error('Error in posts deletion process:', postsError)
        }

        // 4. Delete user's avatar file if it exists
        if (user.avatar_url) {
            console.log('Deleting user avatar...')
            try {
                await deleteStorageFile(user.avatar_url)
                console.log('User avatar deleted')
            } catch (avatarError) {
                console.warn('Failed to delete avatar, continuing:', avatarError)
            }
        }

        // 5. Delete user from users table
        console.log('Deleting user account...')
        const { error: userError } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)

        if (userError) {
            console.error('Error deleting user:', userError)
            throw new Error(`Failed to delete user: ${userError.message}`)
        }
        console.log('User account deleted successfully')

    } catch (error) {
        console.error('Critical error during account deletion:', error)
        throw error
    }
}
