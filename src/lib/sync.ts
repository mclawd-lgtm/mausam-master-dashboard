import { supabase } from './supabase';

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

const STORAGE_KEY = 'master-mausam-data';

interface StorageData {
  habits: Habit[];
  entries: HabitEntry[];
  lastSync: string | null;
}

// Local storage helpers (for offline backup)
function getLocalStorage(): StorageData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { habits: [], entries: [], lastSync: null };
  } catch {
    return { habits: [], entries: [], lastSync: null };
  }
}

function setLocalStorage(data: StorageData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Generate a deterministic ID for entries (user_id + habit_id + date)
export function generateEntryId(userId: string, habitId: string, date: string): string {
  return `${userId}:${habitId}:${date}`;
}

// Parse entry ID back to components
export function parseEntryId(entryId: string): { userId: string; habitId: string; date: string } {
  const parts = entryId.split(':');
  return {
    userId: parts[0] || '',
    habitId: parts[1] || '',
    date: parts[2] || '',
  };
}

// ==================== SUPABASE OPERATIONS ====================

// Deduplicate habits by name, keeping the most recent one
function deduplicateHabits(habits: Habit[]): Habit[] {
  const seen = new Map<string, Habit>();
  habits.forEach(habit => {
    const existing = seen.get(habit.name);
    if (!existing || new Date(habit.updated_at) > new Date(existing.updated_at)) {
      seen.set(habit.name, habit);
    }
  });
  return Array.from(seen.values()).sort((a, b) => a.order_index - b.order_index);
}

export async function getHabits(userId: string): Promise<Habit[]> {
  try {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });
    
    if (error) throw error;
    
    // Deduplicate by name
    const habits = deduplicateHabits(data || []);
    
    // Update local cache with deduplicated data
    const local = getLocalStorage();
    local.habits = habits;
    setLocalStorage(local);
    
    return habits;
  } catch (err) {
    console.warn('[Sync] Failed to fetch habits from Supabase, using local:', err);
    // Fallback to localStorage with deduplication
    const local = getLocalStorage();
    const habits = deduplicateHabits(local.habits.filter(h => h.user_id === userId));
    return habits.sort((a, b) => a.order_index - b.order_index);
  }
}

export async function getHabit(userId: string, habitId: string): Promise<Habit | undefined> {
  try {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data || undefined;
  } catch (err) {
    const local = getLocalStorage();
    return local.habits.find(h => h.id === habitId && h.user_id === userId);
  }
}

export async function saveHabit(userId: string, habit: Partial<Habit> & { id: string }): Promise<Habit> {
  const now = new Date().toISOString();
  
  // Get existing data for defaults
  const local = getLocalStorage();
  const existing = local.habits.find(h => h.id === habit.id);
  
  const fullHabit: Habit = {
    user_id: userId,
    name: habit.name || existing?.name || 'New Habit',
    icon: habit.icon || existing?.icon || '⭐',
    color: habit.color || existing?.color || '#3b82f6',
    order_index: habit.order_index ?? existing?.order_index ?? local.habits.length,
    is_two_step: habit.is_two_step ?? existing?.is_two_step ?? false,
    created_at: existing?.created_at || now,
    updated_at: now,
    schema_version: habit.schema_version ?? existing?.schema_version ?? 1,
    ...habit,
  } as Habit;

  // Update local storage first (optimistic)
  const idx = local.habits.findIndex(h => h.id === habit.id);
  if (idx >= 0) {
    local.habits[idx] = fullHabit;
  } else {
    local.habits.push(fullHabit);
  }
  setLocalStorage(local);

  // Try to sync to Supabase
  try {
    const { error } = await supabase
      .from('habits')
      .upsert(fullHabit, { onConflict: 'id' });
    
    if (error) throw error;
  } catch (err) {
    console.warn('[Sync] Failed to save habit to Supabase:', err);
  }

  return fullHabit;
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  // Update local first
  const local = getLocalStorage();
  local.habits = local.habits.filter(h => !(h.id === habitId && h.user_id === userId));
  local.entries = local.entries.filter(e => !(e.habit_id === habitId && e.user_id === userId));
  setLocalStorage(local);

  try {
    // Delete from Supabase
    await supabase.from('habit_entries').delete().eq('habit_id', habitId).eq('user_id', userId);
    await supabase.from('habits').delete().eq('id', habitId).eq('user_id', userId);
  } catch (err) {
    console.warn('[Sync] Failed to delete habit from Supabase:', err);
  }
}

export async function reorderHabits(userId: string, habitIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  const local = getLocalStorage();
  
  habitIds.forEach((id, index) => {
    const habit = local.habits.find(h => h.id === id && h.user_id === userId);
    if (habit) {
      habit.order_index = index;
      habit.updated_at = now;
    }
  });
  
  setLocalStorage(local);

  // Sync to Supabase
  try {
    const updates = habitIds.map((id, index) => ({
      id,
      user_id: userId,
      order_index: index,
      updated_at: now,
    }));
    
    const { error } = await supabase.from('habits').upsert(updates, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    console.warn('[Sync] Failed to reorder habits on Supabase:', err);
  }
}

export async function getHabitEntries(userId: string, options?: { habitId?: string; date?: string }): Promise<HabitEntry[]> {
  try {
    let query = supabase
      .from('habit_entries')
      .select('*')
      .eq('user_id', userId);
    
    if (options?.habitId) {
      query = query.eq('habit_id', options.habitId);
    }
    if (options?.date) {
      query = query.eq('date', options.date);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    const entries = data || [];
    
    // Update local cache
    const local = getLocalStorage();
    local.entries = entries;
    setLocalStorage(local);
    
    return entries;
  } catch (err) {
    console.warn('[Sync] Failed to fetch entries from Supabase, using local:', err);
    const local = getLocalStorage();
    let entries = local.entries.filter(e => e.user_id === userId);
    
    if (options?.habitId) {
      entries = entries.filter(e => e.habit_id === options.habitId);
    }
    if (options?.date) {
      entries = entries.filter(e => e.date === options.date);
    }
    
    return entries;
  }
}

export async function getHabitEntry(userId: string, habitId: string, date: string): Promise<HabitEntry | undefined> {
  const entryId = generateEntryId(userId, habitId, date);
  
  try {
    const { data, error } = await supabase
      .from('habit_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data || undefined;
  } catch (err) {
    const local = getLocalStorage();
    return local.entries.find(e => e.id === entryId && e.user_id === userId);
  }
}

export async function saveHabitEntry(
  userId: string,
  habitId: string,
  date: string,
  entryData: { value: number; fasting_hours?: number; note?: string }
): Promise<HabitEntry> {
  const entryId = generateEntryId(userId, habitId, date);
  const now = new Date().toISOString();
  
  const entry: HabitEntry = {
    id: entryId,
    user_id: userId,
    habit_id: habitId,
    date,
    value: entryData.value,
    fasting_hours: entryData.fasting_hours,
    note: entryData.note,
    updated_at: now,
  };

  // Update local first (optimistic)
  const local = getLocalStorage();
  const idx = local.entries.findIndex(e => e.id === entryId);
  if (idx >= 0) {
    local.entries[idx] = entry;
  } else {
    local.entries.push(entry);
  }
  setLocalStorage(local);

  // Sync to Supabase
  try {
    const { error } = await supabase
      .from('habit_entries')
      .upsert(entry, { onConflict: 'id' });
    
    if (error) throw error;
  } catch (err) {
    console.warn('[Sync] Failed to save entry to Supabase:', err);
  }

  return entry;
}

export async function deleteHabitEntry(userId: string, habitId: string, date: string): Promise<void> {
  const entryId = generateEntryId(userId, habitId, date);
  
  // Update local first
  const local = getLocalStorage();
  local.entries = local.entries.filter(e => e.id !== entryId);
  setLocalStorage(local);

  try {
    await supabase.from('habit_entries').delete().eq('id', entryId).eq('user_id', userId);
  } catch (err) {
    console.warn('[Sync] Failed to delete entry from Supabase:', err);
  }
}

// ==================== SYNC FUNCTIONS ====================

export async function performSync(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // This triggers a background sync of all local changes
    const local = getLocalStorage();
    
    // Sync habits
    for (const habit of local.habits) {
      try {
        await supabase.from('habits').upsert(habit, { onConflict: 'id' });
      } catch (err) {
        errors.push(`Failed to sync habit ${habit.id}`);
      }
    }
    
    // Sync entries
    for (const entry of local.entries) {
      try {
        await supabase.from('habit_entries').upsert(entry, { onConflict: 'id' });
      } catch (err) {
        errors.push(`Failed to sync entry ${entry.id}`);
      }
    }
    
    return { success: errors.length === 0, errors };
  } catch (err) {
    return { success: false, errors: [String(err)] };
  }
}

export async function pullFromServer(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch all habits and entries from Supabase
    const [habitsRes, entriesRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId),
      supabase.from('habit_entries').select('*').eq('user_id', userId),
    ]);
    
    if (habitsRes.error) throw habitsRes.error;
    if (entriesRes.error) throw entriesRes.error;
    
    // Update local storage with server data
    setLocalStorage({
      habits: habitsRes.data || [],
      entries: entriesRes.data || [],
      lastSync: new Date().toISOString(),
    });
    
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function fullSync(userId: string): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // First, push local changes
    const syncResult = await performSync();
    if (!syncResult.success) {
      errors.push(...syncResult.errors);
    }
    
    // Then, pull server data
    const pullResult = await pullFromServer(userId);
    if (!pullResult.success && pullResult.error) {
      errors.push(pullResult.error);
    }
    
    return { success: errors.length === 0, errors };
  } catch (err) {
    return { success: false, errors: [String(err)] };
  }
}

export function triggerBackgroundSync(): void {
  // Trigger sync in background
  performSync().catch(console.error);
}

export async function getSettings(_userId: string): Promise<null> {
  return null;
}

export async function saveSettings(_userId: string, _settings: unknown): Promise<null> {
  return null;
}
