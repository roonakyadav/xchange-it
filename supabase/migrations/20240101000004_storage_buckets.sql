-- Storage Buckets Migration
-- Creates storage buckets for post images, avatars, and chat media
-- Uses proper Supabase Storage policies based on authenticated identity

-- Insert storage buckets with size limits and allowed mime types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('post-images', 'post-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('chat-media', 'chat-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for post-images bucket

-- Public can view post images
CREATE POLICY "public_view_post_images" ON storage.objects
    FOR SELECT USING (bucket_id = 'post-images');

-- Authenticated users can upload post images
-- Supabase automatically sets owner_id to auth.uid() on upload
CREATE POLICY "authenticated_upload_post_images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'post-images' AND 
        auth.role() = 'authenticated'
    );

-- Authenticated users can select their own uploaded post images
-- Required for upload metadata to be returned successfully
CREATE POLICY "authenticated_select_own_post_images" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'post-images' AND 
        auth.role() = 'authenticated' AND
        owner_id = (select auth.uid()::text)
    );

-- Users can delete only their own post images
CREATE POLICY "users_delete_own_post_images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'post-images' AND 
        auth.role() = 'authenticated' AND
        owner_id = (select auth.uid()::text)
    );

-- Storage RLS Policies for avatars bucket

-- Public can view avatars
CREATE POLICY "public_view_avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

-- Authenticated users can upload avatars
-- Supabase automatically sets owner_id to auth.uid() on upload
CREATE POLICY "authenticated_upload_avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated'
    );

-- Authenticated users can select their own uploaded avatars
-- Required for upload metadata to be returned successfully
CREATE POLICY "authenticated_select_own_avatars" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated' AND
        owner_id = (select auth.uid()::text)
    );

-- Users can delete only their own avatars
CREATE POLICY "users_delete_own_avatars" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated' AND
        owner_id = (select auth.uid()::text)
    );

-- Storage RLS Policies for chat-media bucket

-- PRIVACY TRADEOFF: Chat media is publicly readable for MVP simplicity
-- This means anyone with the direct URL can view chat images/videos
-- For production, implement participant-based RLS using chat_id in file path
-- or use signed URLs with expiration
CREATE POLICY "public_view_chat_media" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-media');

-- Authenticated users can upload chat media
-- Supabase automatically sets owner_id to auth.uid() on upload
CREATE POLICY "authenticated_upload_chat_media" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-media' AND 
        auth.role() = 'authenticated'
    );

-- Authenticated users can select their own uploaded chat media
-- Required for upload metadata to be returned successfully
CREATE POLICY "authenticated_select_own_chat_media" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'chat-media' AND 
        auth.role() = 'authenticated' AND
        owner_id = (select auth.uid()::text)
    );

-- Users can delete only their own chat media
CREATE POLICY "users_delete_own_chat_media" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-media' AND 
        auth.role() = 'authenticated' AND
        owner_id = (select auth.uid()::text)
    );
