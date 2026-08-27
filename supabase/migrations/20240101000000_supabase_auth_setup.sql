-- Supabase Auth Setup Migration
-- Creates the public.users table and sets up automatic profile creation
-- This migration integrates with Supabase Auth (auth.users table)

-- Create public.users table for application profile data
-- ON DELETE CASCADE: When auth user is deleted, all application data cascades
-- This includes posts, chats, messages, saved posts, feedback, and blocked_users
-- This is intentional: account deletion removes all user data for privacy
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    portfolio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table

-- Public can read basic profile info (username, name, avatar)
CREATE POLICY "public_read_users" ON public.users
    FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Users can delete their own account (cascades to auth.users)
CREATE POLICY "users_delete_own" ON public.users
    FOR DELETE USING (id = auth.uid());

-- Create trigger function to automatically create user profile on signup
-- SECURITY DEFINER allows the function to run with elevated privileges
-- search_path = '' prevents function from using unqualified table references
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = ''
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INTEGER := 0;
    user_name TEXT;
BEGIN
    -- Extract name from metadata or email prefix
    user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    
    -- Sanitize name: remove special characters, ensure not empty
    user_name := regexp_replace(user_name, '[^a-zA-Z0-9_]', '', 'g');
    IF user_name = '' OR user_name IS NULL THEN
        user_name := 'user';
    END IF;
    
    -- Truncate to reasonable length
    user_name := substring(user_name, 1, 30);
    
    -- Determine base username: prefer explicit username from metadata, else derived from email
    base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    
    -- Sanitize base username
    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
    IF base_username = '' OR base_username IS NULL THEN
        base_username := split_part(NEW.email, '@', 1);
    END IF;
    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
    IF base_username = '' OR base_username IS NULL THEN
        base_username := 'user';
    END IF;
    base_username := substring(base_username, 1, 30);
    
    final_username := base_username;
    
    -- Handle username collisions with retry strategy
    -- Use exception handling to catch unique constraint violations
    BEGIN
        INSERT INTO public.users (id, name, username)
        VALUES (NEW.id, user_name, final_username);
        RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
        -- Username collision, try with numeric suffix
        LOOP
            counter := counter + 1;
            final_username := base_username || counter;
            
            BEGIN
                INSERT INTO public.users (id, name, username)
                VALUES (NEW.id, user_name, final_username);
                RETURN NEW;
            EXCEPTION WHEN unique_violation THEN
                -- Continue trying with incremented counter
                CONTINUE;
            END;
        END LOOP;
    END;
END;
$$;

-- Create trigger to call handle_new_user when auth.users is created
-- This trigger runs after a new auth user is created via Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create index on username for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
