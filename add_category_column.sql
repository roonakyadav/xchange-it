-- Add category column to posts table
ALTER TABLE posts ADD COLUMN category TEXT DEFAULT 'Others';
