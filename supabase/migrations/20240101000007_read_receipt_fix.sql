-- Read Receipt Fix Migration
-- Creates a SECURITY DEFINER function to securely mark messages as read
-- This bypasses RLS to allow chat participants to mark messages they received as read
-- while preventing modification of message content or other fields

-- Create SECURITY DEFINER function for marking messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(chat_id UUID, reader_id UUID)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER;
    chat_record RECORD;
BEGIN
    -- Verify the caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to mark messages as read';
    END IF;
    
    -- Verify the caller matches the reader_id parameter
    IF auth.uid() != reader_id THEN
        RAISE EXCEPTION 'Caller ID does not match reader_id';
    END IF;
    
    -- Get the chat record and verify the caller is a participant
    SELECT * INTO chat_record
    FROM public.chats
    WHERE id = chat_id
    AND (user1_id = reader_id OR user2_id = reader_id);
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User is not a participant in this chat';
    END IF;
    
    -- Update messages sent by the OTHER participant
    -- Only update is_read and read_at fields - no other fields can be modified
    UPDATE public.messages
    SET is_read = true,
        read_at = NOW()
    WHERE chat_id = chat_id
    AND sender_id != reader_id  -- Only mark messages from other participant
    AND is_read = false;       -- Only mark unread messages
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Reset unread counter for the reader in the chat table
    IF chat_record.user1_id = reader_id THEN
        UPDATE public.chats
        SET unread_user1 = 0
        WHERE id = chat_id;
    ELSE
        UPDATE public.chats
        SET unread_user2 = 0
        WHERE id = chat_id;
    END IF;
    
    RETURN updated_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID) TO authenticated;
