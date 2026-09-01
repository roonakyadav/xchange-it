-- Table Privileges Migration
-- Grants least-privilege access to PostgreSQL roles matching existing RLS policies
-- This migration fixes 403 permission denied errors by granting table-level privileges
-- RLS policies remain enabled and continue to enforce row-level security

-- Grant privileges on public.users table
-- anon: SELECT (public can read profiles per "public_read_users" policy)
-- authenticated: SELECT, UPDATE, DELETE (users can manage their own profile)
-- Note: INSERT is NOT granted to anon/authenticated - profile creation is handled by auth trigger
GRANT SELECT ON TABLE public.users TO anon, authenticated;
GRANT UPDATE, DELETE ON TABLE public.users TO authenticated;

-- Grant privileges on public.posts table
-- anon: SELECT (public can read all posts per "public_read_posts" policy)
-- authenticated: SELECT, INSERT, UPDATE, DELETE (users can manage their own posts)
GRANT SELECT ON TABLE public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.posts TO authenticated;

-- Grant privileges on public.chats table
-- authenticated: SELECT, INSERT, UPDATE (users can read, create, and update chats they participate in)
-- Note: DELETE is NOT granted - application uses soft deletion via UPDATE (deleted_by_user1/2 flags)
GRANT SELECT, INSERT, UPDATE ON TABLE public.chats TO authenticated;

-- Grant privileges on public.messages table
-- authenticated: SELECT, INSERT, UPDATE (users can read, send, and update messages in their chats)
-- Note: DELETE is NOT granted - cascade deletion handles message cleanup
GRANT SELECT, INSERT, UPDATE ON TABLE public.messages TO authenticated;

-- Grant privileges on public.saved_posts table
-- authenticated: SELECT, INSERT, DELETE (users can manage their own saved posts)
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_posts TO authenticated;

-- Grant privileges on public.feedback table
-- authenticated: SELECT, INSERT (users can read and create their own feedback)
-- Note: UPDATE and DELETE are NOT granted - application does not use these operations
GRANT SELECT, INSERT ON TABLE public.feedback TO authenticated;

-- Grant privileges on public.blocked_users table
-- authenticated: SELECT, INSERT, DELETE (users can manage their own blocks)
GRANT SELECT, INSERT, DELETE ON TABLE public.blocked_users TO authenticated;
