import { supabase, isSupabaseConfigured, getCurrentUserId, checkSupabaseConfig } from './supabase';

// Re-export for convenience
export { isSupabaseConfigured, checkSupabaseConfig };

// Types
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

export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
}

// Constants
const USER_ID = getCurrentUserId();
const STORAGE_KEY = 'master-mausam-cache-v1';
const SYNC_STATUS_KEY = 'master-mausam-sync-status';

// Generate unique ID for entries
export function generateEntryId(userId: string, habitId: string, date: string): string {
  return `${userId}:${habitId}:${date}`;
}

// ============================================
// CLOUD-FIRST SYNC FUNCTIONS
// ============================================

/**
 * Check if we're online by pinging Supabase
 */
export async function checkOnlineStatus(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('habits').select('count', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get sync status from localStorage
 */
function getSyncStatus(): SyncStatus {
  try {
    const data = localStorage.getItem(SYNC_STATUS_KEY);
    return data ? JSON.parse(data) : { isOnline: true, lastSyncAt: null, pendingChanges: 0 };
  } catch {
    return { isOnline: true, lastSyncAt: null, pendingChanges: 0 };
  }
}

/**
 * Save sync status to localStorage
 */
function setSyncStatus(status: Partial<SyncStatus>): void {
  try {
    const current = getSyncStatus();
    const updated = { ...current, ...status };
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get cached data from localStorage (fallback only)
 */
export function getLocalCache(): { habits: Habit[]; entries: HabitEntry[] } {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { habits: [], entries: [] };
  } catch {
    return { habits: [], entries: [] };
  }
}

/**
 * Save to local cache (for offline fallback)
 */
export function setLocalCache(habits: Habit[], entries: HabitEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ habits, entries }));
    setSyncStatus({ lastSyncAt: new Date().toISOString() });
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================
// HABITS - CLOUD FIRST
// ============================================

/**
 * Get habits from Supabase (cloud is source of truth)
 * Falls back to cache if offline
 */
export async function getHabits(): Promise<Habit[]> {
  // If Supabase not configured, return cache or empty
  if (!isSupabaseConfigured) {
    console.warn('[Sync] Supabase not configured, using cache');
    const cache = getLocalCache();
    return cache.habits.sort((a, b) => a.order_index - b.order_index);
  }

  try {
    // Try to fetch from Supabase first
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', USER_ID)
      .order('order_index', { ascending: true });

    if (error) throw error;

    const habits = data || [];
    
    // Cache the results for offline use
    const cache = getLocalCache();
    setLocalCache(habits, cache.entries);
    setSyncStatus({ isOnline: true, lastSyncAt: new Date().toISOString() });
    
    return habits;
  } catch (err) {
    console.warn('[Sync] Failed to fetch habits from cloud:', err);
    
    // Fall back to cache
    const cache = getLocalCache();
    setSyncStatus({ isOnline: false });
    
    return cache.habits.sort((a, b) => a.order_index - b.order_index);
  }
}

/**
 * Save habit to Supabase first, then cache locally
 */
export async function saveHabit(habit: Partial<Habit> & { id: string }): Promise<Habit> {
  const now = new Date().toISOString();
  
  // Build complete habit object
  const fullHabit: Habit = {
    id: habit.id,
    user_id: USER_ID,
    name: habit.name || 'New Habit',
    icon: habit.icon || '⭐',
    color: habit.color || '#3b82f6',
    order_index: habit.order_index ?? 0,
    is_two_step: habit.is_two_step ?? false,
    created_at: habit.created_at || now,
    updated_at: now,
  };

  // Try Supabase first (if configured)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('habits')
        .upsert(fullHabit, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        // Update cache with confirmed data from server
        const cache = getLocalCache();
        const existingIdx = cache.habits.findIndex(h => h.id === data.id);
        if (existingIdx >= 0) {
          cache.habits[existingIdx] = data;
        } else {
          cache.habits.push(data);
        }
        setLocalCache(cache.habits, cache.entries);
        setSyncStatus({ isOnline: true });
        return data;
      }
    } catch (err) {
      console.warn('[Sync] Failed to save habit to cloud:', err);
      setSyncStatus({ isOnline: false });
      // Continue to cache locally (will sync later)
    }
  }

  // Update local cache (offline mode or fallback)
  const cache = getLocalCache();
  const existingIdx = cache.habits.findIndex(h => h.id === fullHabit.id);
  if (existingIdx >= 0) {
    cache.habits[existingIdx] = fullHabit;
  } else {
    cache.habits.push(fullHabit);
  }
  setLocalCache(cache.habits, cache.entries);
  
  return fullHabit;
}

/**
 * Delete habit from Supabase first
 */
export async function deleteHabit(habitId: string): Promise<void> {
  // Try Supabase first
  if (isSupabaseConfigured) {
    try {
      // Delete entries first (foreign key constraint)
      await supabase
        .from('habit_entries')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', USER_ID);
      
      // Delete habit
      await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', USER_ID);
      
      setSyncStatus({ isOnline: true });
    } catch (err) {
      console.warn('[Sync] Failed to delete habit from cloud:', err);
      setSyncStatus({ isOnline: false });
    }
  }

  // Update local cache
  const cache = getLocalCache();
  cache.habits = cache.habits.filter(h => h.id !== habitId);
  cache.entries = cache.entries.filter(e => e.habit_id !== habitId);
  setLocalCache(cache.habits, cache.entries);
}

/**
 * Reorder habits in Supabase first
 */
export async function reorderHabits(habitIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  const updates = habitIds.map((id, index) => ({
    id,
    user_id: USER_ID,
    order_index: index,
    updated_at: now,
  }));

  // Try Supabase first
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('habits')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;
      setSyncStatus({ isOnline: true });
    } catch (err) {
      console.warn('[Sync] Failed to reorder habits in cloud:', err);
      setSyncStatus({ isOnline: false });
    }
  }

  // Update local cache
  const cache = getLocalCache();
  cache.habits = cache.habits.map(h => {
    const newIndex = habitIds.indexOf(h.id);
    if (newIndex >= 0) {
      return { ...h, order_index: newIndex, updated_at: now };
    }
    return h;
  });
  setLocalCache(cache.habits, cache.entries);
}

// ============================================
// ENTRIES - CLOUD FIRST
// ============================================

/**
 * Get entries from Supabase (cloud is source of truth)
 */
export async function getHabitEntries(options?: { habitId?: string; date?: string }): Promise<HabitEntry[]> {
  // If Supabase not configured, return cache
  if (!isSupabaseConfigured) {
    const cache = getLocalCache();
    let entries = cache.entries;
    if (options?.habitId) entries = entries.filter(e => e.habit_id === options.habitId);
    if (options?.date) entries = entries.filter(e => e.date === options.date);
    return entries;
  }

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
    
    // Update cache
    const cache = getLocalCache();
    setLocalCache(cache.habits, entries);
    setSyncStatus({ isOnline: true, lastSyncAt: new Date().toISOString() });
    
    return entries;
  } catch (err) {
    console.warn('[Sync] Failed to fetch entries from cloud:', err);
    
    // Fall back to cache
    const cache = getLocalCache();
    setSyncStatus({ isOnline: false });
    
    let entries = cache.entries;
    if (options?.habitId) entries = entries.filter(e => e.habit_id === options.habitId);
    if (options?.date) entries = entries.filter(e => e.date === options.date);
    return entries;
  }
}

/**
 * Get single entry from Supabase
 */
export async function getHabitEntry(habitId: string, date: string): Promise<HabitEntry | undefined> {
  const entryId = generateEntryId(USER_ID, habitId, date);

  if (!isSupabaseConfigured) {
    const cache = getLocalCache();
    return cache.entries.find(e => e.id === entryId);
  }

  try {
    const { data, error } = await supabase
      .from('habit_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', USER_ID)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || undefined;
  } catch (err) {
    const cache = getLocalCache();
    return cache.entries.find(e => e.id === entryId);
  }
}

/**
 * Save entry to Supabase first (cloud is source of truth)
 */
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

  // Try Supabase first
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('habit_entries')
        .upsert(entry, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        // Update cache with confirmed data
        const cache = getLocalCache();
        const existingIdx = cache.entries.findIndex(e => e.id === data.id);
        if (existingIdx >= 0) {
          cache.entries[existingIdx] = data;
        } else {
          cache.entries.push(data);
        }
        setLocalCache(cache.habits, cache.entries);
        setSyncStatus({ isOnline: true });
        return data;
      }
    } catch (err) {
      console.warn('[Sync] Failed to save entry to cloud:', err);
      setSyncStatus({ isOnline: false });
    }
  }

  // Update local cache (offline mode)
  const cache = getLocalCache();
  const existingIdx = cache.entries.findIndex(e => e.id === entryId);
  if (existingIdx >= 0) {
    cache.entries[existingIdx] = entry;
  } else {
    cache.entries.push(entry);
  }
  setLocalCache(cache.habits, cache.entries);
  
  return entry;
}

/**
 * Delete entry from Supabase
 */
export async function deleteHabitEntry(habitId: string, date: string): Promise<void> {
  const entryId = generateEntryId(USER_ID, habitId, date);

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('habit_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', USER_ID);
      setSyncStatus({ isOnline: true });
    } catch (err) {
      console.warn('[Sync] Failed to delete entry from cloud:', err);
      setSyncStatus({ isOnline: false });
    }
  }

  // Update local cache
  const cache = getLocalCache();
  cache.entries = cache.entries.filter(e => e.id !== entryId);
  setLocalCache(cache.habits, cache.entries);
}

// ============================================
// SYNC STATUS
// ============================================

export function getCurrentSyncStatus(): SyncStatus {
  return getSyncStatus();
}

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

// Clear old data formats
export function clearOldData(): void {
  localStorage.removeItem('master-mausam-data');
  localStorage.removeItem('master-mausam-data-v1');
  localStorage.removeItem('master-mausam-data-v2');
}

// Migration function
export function migrateFromOldFormat(): void {
  try {
    const oldKey = 'master-mausam-data-v2';
    const oldData = localStorage.getItem(oldKey);
    if (oldData) {
      const parsed = JSON.parse(oldData);
      if (parsed.habits && parsed.entries) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          habits: parsed.habits,
          entries: parsed.entries,
        }));
        console.log('[Sync] Migrated from old format');
      }
    }
  } catch {
    // Ignore migration errors
  }
}
