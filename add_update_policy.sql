-- Re-enable RLS (if disabled)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Add the missing UPDATE policy for edit functionality
-- (Other policies should already exist)
DO $$
BEGIN
    -- Check if update policy exists, create if not
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'posts'
        AND policyname = 'anon_update_posts'
    ) THEN
        CREATE POLICY "anon_update_posts" ON "public"."posts"
        FOR UPDATE USING (true) WITH CHECK (true);
        RAISE NOTICE 'Created anon_update_posts policy';
    ELSE
        RAISE NOTICE 'anon_update_posts policy already exists';
    END IF;
END $$;
