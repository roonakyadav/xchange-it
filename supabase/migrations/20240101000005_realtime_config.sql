-- Realtime Configuration Migration
-- Enables realtime for required tables (messages, chats)
-- Required for real-time chat functionality

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable realtime for chats table
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- Note: posts table is not enabled for realtime in this migration
-- It can be added later if real-time feed updates are needed
