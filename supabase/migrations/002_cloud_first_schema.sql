-- Mausam Master Dashboard - Cloud-First Schema
-- Updated for fixed user ID mode (no Supabase Auth required)
-- Run this in Supabase SQL Editor

-- ============================================
-- HABITS MODULE (Cloud Source of Truth)
-- ============================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS habit_entries CASCADE;
DROP TABLE IF EXISTS habits CASCADE;
DROP TABLE IF EXISTS sync_log CASCADE;

-- Habits table (no auth dependency)
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,  -- Fixed user ID, no FK constraint
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(10) DEFAULT '✓',
    color VARCHAR(7) DEFAULT '#3b82f6',
    order_index INTEGER DEFAULT 0,
    is_two_step BOOLEAN DEFAULT false,
    target_value INTEGER DEFAULT 1,
    unit VARCHAR(50),
    category VARCHAR(50) DEFAULT 'general',
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit entries (daily tracking) - cloud source of truth
CREATE TABLE IF NOT EXISTS habit_entries (
    id TEXT PRIMARY KEY,  -- Format: user_id:habit_id:date
    user_id UUID NOT NULL,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    value INTEGER DEFAULT 0,
    note TEXT,
    fasting_hours INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Habits indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_order ON habits(user_id, order_index);

-- Habit entries indexes
CREATE INDEX IF NOT EXISTS idx_habit_entries_user_id ON habit_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_id ON habit_entries(habit_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_habits_updated_at ON habits;
CREATE TRIGGER update_habits_updated_at
    BEFORE UPDATE ON habits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_habit_entries_updated_at ON habit_entries;
CREATE TRIGGER update_habit_entries_updated_at
    BEFORE UPDATE ON habit_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Optional - for testing)
-- ============================================

-- Insert default habits for fixed user
-- Note: This uses a fixed UUID. Change if your app uses a different one.
-- Default: 895cd28a-37ea-443c-b7bb-eca88c857d05

INSERT INTO habits (id, user_id, name, icon, color, order_index, is_two_step, category) VALUES
    ('11111111-1111-1111-1111-111111111111', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Fasting', '🍽️', '#f59e0b', 0, false, 'health'),
    ('22222222-2222-2222-2222-222222222222', '895cd28a-37ea-443c-b7bb-eca88c857d05', '5 Ltr Water', '💧', '#3b82f6', 1, false, 'health'),
    ('33333333-3333-3333-3333-333333333333', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'No Eat Outside', '🏠', '#10b981', 2, false, 'health'),
    ('44444444-4444-4444-4444-444444444444', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Running', '🏃', '#f97316', 3, false, 'fitness'),
    ('55555555-5555-5555-5555-555555555555', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Exercise', '💪', '#a855f7', 4, false, 'fitness'),
    ('66666666-6666-6666-6666-666666666666', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Protein', '🥩', '#eab308', 5, false, 'nutrition'),
    ('77777777-7777-7777-7777-777777777777', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Meditation', '🧘', '#ec4899', 6, false, 'wellness'),
    ('88888888-8888-8888-8888-888888888888', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Vitamins 2 Times', '💊', '#06b6d4', 7, true, 'health'),
    ('99999999-9999-9999-9999-999999999999', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Reading', '📚', '#6366f1', 8, false, 'learning'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '895cd28a-37ea-443c-b7bb-eca88c857d05', '2 Brush', '🪥', '#14b8a6', 9, true, 'health'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'Travel', '✈️', '#f43f5e', 10, false, 'lifestyle'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '895cd28a-37ea-443c-b7bb-eca88c857d05', 'No Fap', '🚫', '#8b5cf6', 11, false, 'discipline')
ON CONFLICT (id) DO NOTHING;
