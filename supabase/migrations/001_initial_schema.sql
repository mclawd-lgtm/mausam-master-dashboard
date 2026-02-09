-- Mausam Master Dashboard - Initial Schema
-- Run this in Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- ============================================
-- HABITS MODULE
-- ============================================

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Habit entries (daily tracking)
CREATE TABLE IF NOT EXISTS habit_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    value INTEGER DEFAULT 0,
    note TEXT,
    fasting_hours INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, habit_id, date)
);

-- ============================================
-- GOLD RATES MODULE
-- ============================================

-- Gold rates cache
CREATE TABLE IF NOT EXISTS gold_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    gold_24k_per_gram DECIMAL(10,2),
    gold_22k_per_gram DECIMAL(10,2),
    silver_per_kg DECIMAL(10,2),
    gold_24k_change DECIMAL(10,2),
    gold_22k_change DECIMAL(10,2),
    silver_change DECIMAL(10,2),
    city_rates JSONB,
    source VARCHAR(100),
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS MODULE
-- ============================================

-- Tasks table
CREATE TABLE IF NOT EXISTS user_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'inbox', -- inbox, assigned, in_progress, blocked, review, done
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    tags JSONB,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SETTINGS MODULE
-- ============================================

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ui_prefs JSONB DEFAULT '{}',
    health_prefs JSONB DEFAULT '{}',
    notification_prefs JSONB DEFAULT '{}',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SYNC LOG
-- ============================================

-- Sync log for debugging
CREATE TABLE IF NOT EXISTS sync_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    table_name VARCHAR(100),
    operation VARCHAR(20), -- insert, update, delete
    record_id UUID,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_entries ENABLE TABLE habit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Habits: Users can only access their own habits
CREATE POLICY "Users can CRUD own habits"
    ON habits FOR ALL
    USING (auth.uid() = user_id);

-- Habit entries: Users can only access their own entries
CREATE POLICY "Users can CRUD own habit entries"
    ON habit_entries FOR ALL
    USING (auth.uid() = user_id);

-- Gold rates: Public read, admin write
CREATE POLICY "Gold rates are publicly readable"
    ON gold_rates FOR SELECT
    USING (true);

CREATE POLICY "Only authenticated users can insert gold rates"
    ON gold_rates FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Tasks: Users can only access their own tasks
CREATE POLICY "Users can CRUD own tasks"
    ON user_tasks FOR ALL
    USING (auth.uid() = user_id);

-- Settings: Users can only access their own settings
CREATE POLICY "Users can CRUD own settings"
    ON user_settings FOR ALL
    USING (auth.uid() = user_id);

-- Sync log: Users can only access their own logs
CREATE POLICY "Users can view own sync logs"
    ON sync_log FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================

-- Habits indexes
CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habits_order ON habits(user_id, order_index);

-- Habit entries indexes
CREATE INDEX idx_habit_entries_user_id ON habit_entries(user_id);
CREATE INDEX idx_habit_entries_date ON habit_entries(user_id, date);
CREATE INDEX idx_habit_entries_habit_id ON habit_entries(habit_id);

-- Gold rates indexes
CREATE INDEX idx_gold_rates_date ON gold_rates(date);

-- Tasks indexes
CREATE INDEX idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX idx_user_tasks_status ON user_tasks(user_id, status);
CREATE INDEX idx_user_tasks_priority ON user_tasks(user_id, priority);

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

CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON habits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habit_entries_updated_at BEFORE UPDATE ON habit_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tasks_updated_at BEFORE UPDATE ON user_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default habits template (these will be copied for new users)
INSERT INTO habits (id, name, icon, color, order_index, is_two_step, category) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Fasting', '🍽️', '#f59e0b', 0, false, 'health'),
    ('00000000-0000-0000-0000-000000000002', '5 Ltr Water', '💧', '#3b82f6', 1, false, 'health'),
    ('00000000-0000-0000-0000-000000000003', 'No Eat Outside', '🍔', '#ef4444', 2, false, 'health'),
    ('00000000-0000-0000-0000-000000000004', 'Running', '🏃', '#10b981', 3, false, 'fitness'),
    ('00000000-0000-0000-0000-000000000005', 'Exercise', '💪', '#8b5cf6', 4, false, 'fitness'),
    ('00000000-0000-0000-0000-000000000006', 'Protein', '🥩', '#f97316', 5, false, 'nutrition'),
    ('00000000-0000-0000-0000-000000000007', 'Meditation', '🧘', '#ec4899', 6, false, 'wellness'),
    ('00000000-0000-0000-0000-000000000008', 'Vitamins 2 Times', '💊', '#06b6d4', 7, false, 'health'),
    ('00000000-0000-0000-0000-000000000009', 'Reading', '📚', '#6366f1', 8, false, 'learning'),
    ('00000000-0000-0000-0000-000000000010', '2 Brush', '🪥', '#14b8a6', 9, false, 'health'),
    ('00000000-0000-0000-0000-000000000011', 'Travel', '🚗', '#84cc16', 10, false, 'lifestyle'),
    ('00000000-0000-0000-0000-000000000012', 'No Fap', '🚫', '#dc2626', 11, false, 'discipline')
ON CONFLICT DO NOTHING;
