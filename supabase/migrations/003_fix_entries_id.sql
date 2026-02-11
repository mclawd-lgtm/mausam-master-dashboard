-- Fix habit_entries table structure for cloud-first sync

-- First, drop existing entries (we're starting fresh)
DELETE FROM habit_entries;

-- Alter the id column to TEXT
ALTER TABLE habit_entries DROP CONSTRAINT IF EXISTS habit_entries_pkey;
ALTER TABLE habit_entries ALTER COLUMN id TYPE TEXT;
ALTER TABLE habit_entries ADD PRIMARY KEY (id);

-- Make sure user_id column exists and is correct type
ALTER TABLE habit_entries ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Verify the structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'habit_entries' ORDER BY ordinal_position;
