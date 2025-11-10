-- Alternative: Make chat_media bucket public to bypass RLS
-- Run this in your Supabase SQL Editor

-- Update the bucket to be public (this bypasses RLS policies)
UPDATE storage.buckets
SET public = true
WHERE id = 'chat_media';

-- Note: With public = true, anyone can access files in this bucket
-- This is simpler but less secure than using RLS policies
-- Consider this for testing, then implement proper policies later
