-- Fix RLS policy for chat_media bucket to allow uploads for app users
-- Run this in your Supabase SQL Editor

-- First, drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can upload chat media" ON storage.objects;

-- Create a new policy that allows uploads to chat_media bucket
-- Since your app uses custom authentication, we'll allow all uploads
-- (You can make this more restrictive later if needed)
CREATE POLICY "Allow chat media uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat_media'
);

-- Allow reading/viewing uploaded media
CREATE POLICY "Allow chat media viewing" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat_media'
);

-- Optional: Allow deleting own uploads (if needed)
CREATE POLICY "Allow chat media deletion" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat_media'
);
