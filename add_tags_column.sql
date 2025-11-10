-- Add tags column to posts table (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'posts'
        AND column_name = 'tags'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE posts ADD COLUMN tags TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Tags column added to posts table';
    ELSE
        RAISE NOTICE 'Tags column already exists in posts table';
    END IF;
END $$;
