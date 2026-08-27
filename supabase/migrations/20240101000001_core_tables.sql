-- Core Tables Migration
-- Creates the fundamental application tables with UUID-based relationships
-- Tables: posts, chats, messages, blocked_users

-- Create posts table
-- ON DELETE CASCADE: When user is deleted, all their posts are deleted
-- This is intentional: posts are meaningless without their author
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('selling', 'requesting')),
    price TEXT,
    category TEXT DEFAULT 'Others',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chats table
-- ON DELETE CASCADE for user1_id, user2_id: When a user is deleted, chats they participate in are deleted
-- This is intentional: conversations are meaningless without both participants
-- ON DELETE CASCADE for post_id: When a post is deleted, associated chats are deleted
-- This is intentional: chats about a deleted post serve no purpose
-- ON DELETE SET NULL for last_sender_id: When last sender is deleted, reference is cleared but chat preserved
-- This allows the chat to remain even if one participant is deleted
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message TEXT,
    last_sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    unread_user1 INTEGER DEFAULT 0,
    unread_user2 INTEGER DEFAULT 0,
    deleted_by_user1 BOOLEAN DEFAULT false,
    deleted_by_user2 BOOLEAN DEFAULT false,
    UNIQUE(user1_id, user2_id, post_id)
);

-- Create messages table
-- ON DELETE CASCADE for chat_id: When a chat is deleted, all messages are deleted
-- This is intentional: messages are meaningless without their chat
-- ON DELETE CASCADE for sender_id: When a user is deleted, their messages are deleted
-- This is intentional: messages from deleted users are removed for privacy
-- ON DELETE SET NULL for reply_to_id: When a replied-to message is deleted, reference is cleared
-- This allows the reply to remain even if the original message is deleted
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'media')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT false,
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    reply_preview TEXT
);

-- Create blocked_users table (for future blocking feature)
-- ON DELETE CASCADE for blocker_id: When blocker is deleted, their blocks are deleted
-- ON DELETE CASCADE for blocked_id: When blocked user is deleted, blocks involving them are deleted
-- This is intentional: blocks are meaningless if either party is deleted
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts table

-- Public can read all posts
CREATE POLICY "public_read_posts" ON public.posts
    FOR SELECT USING (true);

-- Authenticated users can create posts
CREATE POLICY "authenticated_insert_posts" ON public.posts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own posts
CREATE POLICY "users_update_own_posts" ON public.posts
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own posts
CREATE POLICY "users_delete_own_posts" ON public.posts
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for chats table

-- Users can read chats they participate in
CREATE POLICY "users_read_own_chats" ON public.chats
    FOR SELECT USING (
        user1_id = auth.uid() OR
        user2_id = auth.uid()
    );

-- Authenticated users can create chats they participate in
CREATE POLICY "authenticated_insert_chats" ON public.chats
    FOR INSERT WITH CHECK (
        user1_id = auth.uid() OR
        user2_id = auth.uid()
    );

-- Users can update chats they participate in (for soft delete, unread updates)
CREATE POLICY "users_update_own_chats" ON public.chats
    FOR UPDATE USING (
        user1_id = auth.uid() OR
        user2_id = auth.uid()
    )
    WITH CHECK (
        user1_id = auth.uid() OR
        user2_id = auth.uid()
    );

-- RLS Policies for messages table

-- Users can read messages in chats they participate in
CREATE POLICY "users_read_own_messages" ON public.messages
    FOR SELECT USING (
        chat_id IN (
            SELECT id FROM public.chats
            WHERE user1_id = auth.uid() OR user2_id = auth.uid()
        )
    );

-- Authenticated users can insert messages in chats they participate in
CREATE POLICY "authenticated_insert_messages" ON public.messages
    FOR INSERT WITH CHECK (
        chat_id IN (
            SELECT id FROM public.chats
            WHERE user1_id = auth.uid() OR user2_id = auth.uid()
        ) AND
        sender_id = auth.uid()
    );

-- Users can update messages they sent (for read receipts)
CREATE POLICY "users_update_own_messages" ON public.messages
    FOR UPDATE USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

-- RLS Policies for blocked_users table

-- Users can read their own blocks
CREATE POLICY "users_read_own_blocks" ON public.blocked_users
    FOR SELECT USING (blocker_id = auth.uid());

-- Authenticated users can create blocks
CREATE POLICY "authenticated_insert_blocks" ON public.blocked_users
    FOR INSERT WITH CHECK (blocker_id = auth.uid());

-- Users can delete their own blocks
CREATE POLICY "users_delete_own_blocks" ON public.blocked_users
    FOR DELETE USING (blocker_id = auth.uid());

-- Set replica identity for messages (required for realtime)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
