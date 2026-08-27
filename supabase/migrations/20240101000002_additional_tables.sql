-- Additional Tables Migration
-- Creates tables for saved posts and user feedback

-- Create saved_posts table
-- ON DELETE CASCADE for user_id: When user is deleted, their saved posts are deleted
-- This is intentional: saved posts are meaningless without the user
-- ON DELETE CASCADE for post_id: When post is deleted, it's removed from all users' saved lists
-- This is intentional: cannot save a post that no longer exists
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Create feedback table
-- ON DELETE CASCADE for user_id: When user is deleted, their feedback is deleted
-- This is intentional: feedback is meaningless without the user
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on additional tables
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_posts table

-- Users can read their own saved posts
CREATE POLICY "users_read_own_saved_posts" ON public.saved_posts
    FOR SELECT USING (user_id = auth.uid());

-- Authenticated users can create saved posts
CREATE POLICY "authenticated_insert_saved_posts" ON public.saved_posts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can delete their own saved posts
CREATE POLICY "users_delete_own_saved_posts" ON public.saved_posts
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for feedback table

-- Users can read their own feedback
CREATE POLICY "users_read_own_feedback" ON public.feedback
    FOR SELECT USING (user_id = auth.uid());

-- Authenticated users can create feedback
CREATE POLICY "authenticated_insert_feedback" ON public.feedback
    FOR INSERT WITH CHECK (user_id = auth.uid());
