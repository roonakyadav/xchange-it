-- Indexes and Triggers Migration
-- Creates performance indexes and database triggers

-- Create indexes for posts
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_mode ON public.posts(mode);

-- Create indexes for chats
CREATE INDEX IF NOT EXISTS idx_chats_user1_id ON public.chats(user1_id);
CREATE INDEX IF NOT EXISTS idx_chats_user2_id ON public.chats(user2_id);
CREATE INDEX IF NOT EXISTS idx_chats_post_id ON public.chats(post_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Create indexes for saved_posts
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON public.saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON public.saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_created_at ON public.saved_posts(created_at DESC);

-- Create indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Create indexes for blocked_users
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON public.blocked_users(blocked_id);

-- Create function to bump chat updated_at when message is inserted
CREATE OR REPLACE FUNCTION public.bump_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chats
    SET 
        updated_at = NOW(),
        last_message = NEW.body,
        last_sender_id = NEW.sender_id
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call bump_chat_updated_at on message insert
DROP TRIGGER IF EXISTS trg_messages_after_insert ON public.messages;
CREATE TRIGGER trg_messages_after_insert
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.bump_chat_updated_at();

-- Set replica identity for chats (required for realtime full row updates)
ALTER TABLE public.chats REPLICA IDENTITY FULL;
