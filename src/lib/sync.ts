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

const STORAGE_KEY = 'master-mausam-data-v2';
const USER_ID = '895cd28a-37ea-443c-b7bb-eca88c857d05'; // Fixed user ID for Supabase

interface StorageData {
  habits: Habit[];
  entries: HabitEntry[];
  lastSync: string | null;
}

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

export function generateEntryId(userId: string, habitId: string, date: string): string {
  return `${userId}:${habitId}:${date}`;
}

export function parseEntryId(entryId: string): { userId: string; habitId: string; date: string } {
  const parts = entryId.split(':');
  return {
    userId: parts[0] || '',
    habitId: parts[1] || '',
    date: parts[2] || '',
  };
}

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

// Get habits from Supabase first, fallback to localStorage
export async function getHabits(): Promise<Habit[]> {
  try {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', USER_ID)
      .order('order_index', { ascending: true });
    
    if (error) throw error;
    
    const habits = deduplicateHabits(data || []);
    
    // Update local cache
    const local = getLocalStorage();
    local.habits = habits;
    setLocalStorage(local);
    
    return habits;
  } catch (err) {
    console.warn('[Sync] Supabase failed, using local:', err);
    const local = getLocalStorage();
    return deduplicateHabits(local.habits).sort((a, b) => a.order_index - b.order_index);
  }
}

export async function saveHabit(habit: Partial<Habit> & { id: string }): Promise<Habit> {
  const now = new Date().toISOString();
  const local = getLocalStorage();
  const existing = local.habits.find(h => h.id === habit.id);
  
  const fullHabit: Habit = {
    user_id: USER_ID,
    name: habit.name || existing?.name || 'New Habit',
    icon: habit.icon || existing?.icon || '⭐',
    color: habit.color || existing?.color || '#3b82f6',
    order_index: habit.order_index ?? existing?.order_index ?? local.habits.length,
    is_two_step: habit.is_two_step ?? existing?.is_two_step ?? false,
    created_at: existing?.created_at || now,
    updated_at: now,
    schema_version: 1,
    ...habit,
  } as Habit;

  // Update local first
  const idx = local.habits.findIndex(h => h.id === habit.id);
  if (idx >= 0) {
    local.habits[idx] = fullHabit;
  } else {
    local.habits.push(fullHabit);
  }
  setLocalStorage(local);

  // Sync to Supabase
  try {
    await supabase.from('habits').upsert(fullHabit, { onConflict: 'id' });
  } catch (err) {
    console.warn('[Sync] Failed to save habit to Supabase:', err);
  }

  return fullHabit;
}

export async function deleteHabit(habitId: string): Promise<void> {
  const local = getLocalStorage();
  local.habits = local.habits.filter(h => h.id !== habitId);
  local.entries = local.entries.filter(e => e.habit_id !== habitId);
  setLocalStorage(local);

  try {
    await supabase.from('habit_entries').delete().eq('habit_id', habitId).eq('user_id', USER_ID);
    await supabase.from('habits').delete().eq('id', habitId).eq('user_id', USER_ID);
  } catch (err) {
    console.warn('[Sync] Failed to delete from Supabase:', err);
  }
}

export async function reorderHabits(habitIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  const local = getLocalStorage();
  
  habitIds.forEach((id, index) => {
    const habit = local.habits.find(h => h.id === id);
    if (habit) {
      habit.order_index = index;
      habit.updated_at = now;
    }
  });
  
  setLocalStorage(local);

  try {
    const updates = habitIds.map((id, index) => ({
      id,
      user_id: USER_ID,
      order_index: index,
      updated_at: now,
    }));
    await supabase.from('habits').upsert(updates, { onConflict: 'id' });
  } catch (err) {
    console.warn('[Sync] Failed to reorder in Supabase:', err);
  }
}

export async function getHabitEntries(options?: { habitId?: string; date?: string }): Promise<HabitEntry[]> {
  try {
    let query = supabase
      .from('habit_entries')
      .select('*')
      .eq('user_id', USER_ID);
    
    if (options?.habitId) query = query.eq('habit_id', options.habitId);
    if (options?.date) query = query.eq('date', options.date);
    
    const { data, error } = await query;
    if (error) throw error;
    
    const entries = data || [];
    const local = getLocalStorage();
    local.entries = entries;
    setLocalStorage(local);
    
    return entries;
  } catch (err) {
    console.warn('[Sync] Supabase failed, using local:', err);
    const local = getLocalStorage();
    let entries = local.entries;
    if (options?.habitId) entries = entries.filter(e => e.habit_id === options.habitId);
    if (options?.date) entries = entries.filter(e => e.date === options.date);
    return entries;
  }
}

export async function getHabitEntry(habitId: string, date: string): Promise<HabitEntry | undefined> {
  const entryId = generateEntryId(USER_ID, habitId, date);
  
  try {
    const { data, error } = await supabase
      .from('habit_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', USER_ID)
      .single();
    
    if (error) throw error;
    return data || undefined;
  } catch (err) {
    const local = getLocalStorage();
    return local.entries.find(e => e.id === entryId);
  }
}

export async function saveHabitEntry(
  habitId: string,
  date: string,
  entryData: { value: number; fasting_hours?: number; note?: string }
): Promise<HabitEntry> {
  const entryId = generateEntryId(USER_ID, habitId, date);
  const now = new Date().toISOString();
  
  const entry: HabitEntry = {
    id: entryId,
    user_id: USER_ID,
    habit_id: habitId,
    date,
    value: entryData.value,
    fasting_hours: entryData.fasting_hours,
    note: entryData.note,
    updated_at: now,
  };

  // Update local first
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
    await supabase.from('habit_entries').upsert(entry, { onConflict: 'id' });
  } catch (err) {
    console.warn('[Sync] Failed to save entry to Supabase:', err);
  }

  return entry;
}

export async function deleteHabitEntry(habitId: string, date: string): Promise<void> {
  const entryId = generateEntryId(USER_ID, habitId, date);
  
  const local = getLocalStorage();
  local.entries = local.entries.filter(e => e.id !== entryId);
  setLocalStorage(local);

  try {
    await supabase.from('habit_entries').delete().eq('id', entryId).eq('user_id', USER_ID);
  } catch (err) {
    console.warn('[Sync] Failed to delete entry from Supabase:', err);
  }
}

// Full sync - push local changes then pull from server
export async function performSync(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const local = getLocalStorage();
  
  // Push habits
  for (const habit of local.habits) {
    try {
      await supabase.from('habits').upsert({ ...habit, user_id: USER_ID }, { onConflict: 'id' });
    } catch (err) {
      errors.push(`Habit ${habit.id}`);
    }
  }
  
  // Push entries
  for (const entry of local.entries) {
    try {
      await supabase.from('habit_entries').upsert({ ...entry, user_id: USER_ID }, { onConflict: 'id' });
    } catch (err) {
      errors.push(`Entry ${entry.id}`);
    }
  }
  
  return { success: errors.length === 0, errors };
}

export async function pullFromServer(): Promise<{ success: boolean; error?: string }> {
  try {
    const [habitsRes, entriesRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', USER_ID),
      supabase.from('habit_entries').select('*').eq('user_id', USER_ID),
    ]);
    
    if (habitsRes.error) throw habitsRes.error;
    if (entriesRes.error) throw entriesRes.error;
    
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

export async function fullSync(): Promise<{ success: boolean; errors: string[] }> {
  const syncResult = await performSync();
  const pullResult = await pullFromServer();
  
  const errors = [...syncResult.errors];
  if (!pullResult.success && pullResult.error) {
    errors.push(pullResult.error);
  }
  
  return { success: errors.length === 0, errors };
}

export function triggerBackgroundSync(): void {
  performSync().catch(console.error);
}

// Clear old data with wrong user_id
export function clearOldData(): void {
  localStorage.removeItem('master-mausam-data'); // Old key
  localStorage.removeItem('master-mausam-data-v1'); // Old key
}
