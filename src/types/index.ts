export type PostMode = 'selling' | 'requesting'

export interface User {
    id: string
    name: string
    username: string
    avatar_url?: string
    created_at: string
}

export interface Post {
    id: string
    title: string
    description: string
    image_url: string
    username: string
    mode: PostMode
    location?: string
    created_at: string
}

export interface Chat {
    id: string
    user1: string
    user2: string
    post_id?: string
    created_at: string
}

export interface Message {
    id: string
    chat_id: string
    sender: string
    body: string
    created_at: string
}

export interface PostWithUser extends Post {
    users: User | null
}

export interface ChatWithPost extends Chat {
    posts?: {
        title: string
        image_url: string
    } | null
}

export interface ChatWithMessages extends Chat {
    messages: Message[]
}
