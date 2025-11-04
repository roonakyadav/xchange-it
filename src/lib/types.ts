export interface Profile {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    bio: string | null
    location: string | null
    links: {
        website?: string
        twitter?: string
        github?: string
        telegram?: string
    }
    created_at: string
    updated_at: string
}

export interface Post {
    id: string
    user_id: string
    type: 'listing' | 'request'
    title: string
    description: string | null
    category: string | null
    price: number | null
    currency: string
    images: string[]
    location: string | null
    tags: string[]
    is_active: boolean
    created_at: string
    updated_at: string
    profiles: Profile
}

export interface Comment {
    id: string
    user_id: string
    post_id: string
    content: string
    created_at: string
    updated_at: string
    profiles: Profile
}

export interface Chat {
    id: string
    post_id: string
    buyer_id: string
    seller_id: string
    created_at: string
    updated_at: string
    posts?: Post
    other_user?: Profile
    last_message?: Message
    unread_count?: number
}

export interface ChatParticipant {
    id: string
    chat_id: string
    user_id: string
    created_at: string
}

export interface Message {
    id: string
    chat_id: string
    sender_id: string
    content: string
    read_at: string | null
    created_at: string
}

export interface WishlistItem {
    id: string
    user_id: string
    post_id: string
    created_at: string
    posts: Post
}

export interface Rating {
    id: string
    rater_id: string
    rated_user_id: string
    rating: number
    review: string | null
    created_at: string
}

export interface Report {
    id: string
    reporter_id: string
    reported_user_id: string | null
    reported_post_id: string | null
    reason: string
    description: string | null
    status: 'pending' | 'resolved' | 'dismissed'
    created_at: string
    updated_at: string
}

export interface Transaction {
    id: string
    buyer_id: string
    seller_id: string
    post_id: string
    amount: number
    currency: string
    status: 'pending' | 'completed' | 'cancelled'
    created_at: string
    updated_at: string
}

export interface Notification {
    id: string
    user_id: string
    type: string
    title: string
    message: string | null
    data: Record<string, any>
    is_read: boolean
    created_at: string
}
