// Local sync types - matches Supabase schema
export interface Habit {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  order_index: number;
  is_two_step: boolean;
  created_at: string;
  updated_at: string;
  schema_version: number;
}

export interface HabitEntry {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  value: number;
  fasting_hours?: number;
  note?: string;
  updated_at: string;
}

export interface Settings {
  user_id: string;
  ui_prefs: Record<string, unknown>;
  last_sync_at: string | null;
}

// Legacy types for migration
export interface LegacyHabitEntry {
  date: string;
  value: number;
}

export interface LegacyHabit {
  id: string;
  name: string;
  icon: string;
  color: string;
  isTwoStep: boolean;
  entries: Record<string, LegacyHabitEntry>;
}

export type ViewMode = 'month' | 'year';
