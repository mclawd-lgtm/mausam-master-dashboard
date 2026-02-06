import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabase';

const DB_NAME = 'master-mausam-db';
const DB_VERSION = 1;

// Types matching the Supabase schema
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

interface MasterMausamDB extends DBSchema {
  habits: {
    key: string;
    value: Habit;
    indexes: { 'by-user': string; 'by-order': [string, number] };
  };
  habitEntries: {
    key: string;
    value: HabitEntry;
    indexes: { 'by-user': string; 'by-habit': string; 'by-date': [string, string] };
  };
  settings: {
    key: string;
    value: Settings;
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-timestamp': number };
  };
}

type SyncQueueItem = {
  id: string;
  table: 'habits' | 'habit_entries';
  operation: 'upsert' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
};

let dbPromise: Promise<IDBPDatabase<MasterMausamDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MasterMausamDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MasterMausamDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Habits store
        const habitsStore = db.createObjectStore('habits', { keyPath: 'id' });
        habitsStore.createIndex('by-user', 'user_id');
        habitsStore.createIndex('by-order', ['user_id', 'order_index']);

        // Habit entries store
        const entriesStore = db.createObjectStore('habitEntries', { keyPath: 'id' });
        entriesStore.createIndex('by-user', 'user_id');
        entriesStore.createIndex('by-habit', 'habit_id');
        entriesStore.createIndex('by-date', ['user_id', 'date']);

        // Settings store
        db.createObjectStore('settings', { keyPath: 'user_id' });

        // Sync queue store
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
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

// Local cache operations
export async function getHabits(userId: string): Promise<Habit[]> {
  const db = await getDB();
  const habits = await db.getAllFromIndex('habits', 'by-user', userId);
  return habits.sort((a, b) => a.order_index - b.order_index);
}

export async function getHabit(userId: string, habitId: string): Promise<Habit | undefined> {
  const db = await getDB();
  const habit = await db.get('habits', habitId);
  if (habit && habit.user_id === userId) {
    return habit;
  }
  return undefined;
}

export async function saveHabit(userId: string, habit: Partial<Habit> & { id: string }): Promise<Habit> {
  const db = await getDB();
  const existing = await db.get('habits', habit.id);
  
  const now = new Date().toISOString();
  const fullHabit: Habit = {
    user_id: userId,
    name: habit.name || existing?.name || 'New Habit',
    icon: habit.icon || existing?.icon || '⭐',
    color: habit.color || existing?.color || '#3b82f6',
    order_index: habit.order_index ?? existing?.order_index ?? 0,
    is_two_step: habit.is_two_step ?? existing?.is_two_step ?? false,
    created_at: existing?.created_at || now,
    updated_at: now,
    schema_version: habit.schema_version ?? existing?.schema_version ?? 1,
    ...habit,
  } as Habit;

  await db.put('habits', fullHabit);
  await queueForSync('habits', 'upsert', fullHabit as unknown as Record<string, unknown>);
  return fullHabit;
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const db = await getDB();
  const habit = await db.get('habits', habitId);
  if (habit && habit.user_id === userId) {
    await db.delete('habits', habitId);
    await queueForSync('habits', 'delete', { id: habitId, user_id: userId });
  }
}

export async function reorderHabits(userId: string, habitIds: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('habits', 'readwrite');
  
  const now = new Date().toISOString();
  for (let i = 0; i < habitIds.length; i++) {
    const habit = await tx.store.get(habitIds[i]);
    if (habit && habit.user_id === userId) {
      habit.order_index = i;
      habit.updated_at = now;
      await tx.store.put(habit);
      await queueForSync('habits', 'upsert', habit as unknown as Record<string, unknown>);
    }
  }
  await tx.done;
}

export async function getHabitEntries(userId: string, options?: { habitId?: string; date?: string }): Promise<HabitEntry[]> {
  const db = await getDB();
  let entries: HabitEntry[];
  
  if (options?.habitId) {
    entries = await db.getAllFromIndex('habitEntries', 'by-habit', options.habitId);
  } else if (options?.date) {
    entries = await db.getAllFromIndex('habitEntries', 'by-date', [userId, options.date]);
  } else {
    entries = await db.getAllFromIndex('habitEntries', 'by-user', userId);
  }
  
  return entries.filter(e => e.user_id === userId);
}

export async function getHabitEntry(userId: string, habitId: string, date: string): Promise<HabitEntry | undefined> {
  const db = await getDB();
  const entryId = generateEntryId(userId, habitId, date);
  const entry = await db.get('habitEntries', entryId);
  if (entry && entry.user_id === userId) {
    return entry;
  }
  return undefined;
}

export async function saveHabitEntry(
  userId: string,
  habitId: string,
  date: string,
  data: { value: number; fasting_hours?: number; note?: string }
): Promise<HabitEntry> {
  const db = await getDB();
  const entryId = generateEntryId(userId, habitId, date);
  
  const now = new Date().toISOString();
  const entry: HabitEntry = {
    id: entryId,
    user_id: userId,
    habit_id: habitId,
    date,
    value: data.value,
    fasting_hours: data.fasting_hours,
    note: data.note,
    updated_at: now,
  };

  await db.put('habitEntries', entry);
  await queueForSync('habit_entries', 'upsert', entry as unknown as Record<string, unknown>);
  return entry;
}

export async function deleteHabitEntry(userId: string, habitId: string, date: string): Promise<void> {
  const db = await getDB();
  const entryId = generateEntryId(userId, habitId, date);
  const entry = await db.get('habitEntries', entryId);
  if (entry && entry.user_id === userId) {
    await db.delete('habitEntries', entryId);
    await queueForSync('habit_entries', 'delete', { id: entryId, user_id: userId });
  }
}

export async function getSettings(userId: string): Promise<Settings | undefined> {
  const db = await getDB();
  return await db.get('settings', userId);
}

export async function saveSettings(userId: string, settings: Partial<Settings>): Promise<Settings> {
  const db = await getDB();
  const existing = await db.get('settings', userId);
  
  const fullSettings: Settings = {
    user_id: userId,
    ui_prefs: settings.ui_prefs ?? existing?.ui_prefs ?? {},
    last_sync_at: settings.last_sync_at ?? existing?.last_sync_at ?? null,
  };

  await db.put('settings', fullSettings);
  return fullSettings;
}

// Sync queue operations
async function queueForSync(
  table: 'habits' | 'habit_entries',
  operation: 'upsert' | 'delete',
  data: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  const id = `${table}:${data.id}:${Date.now()}`;
  
  const item: SyncQueueItem = {
    id,
    table,
    operation,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };

  await db.add('syncQueue', item);
  
  // Trigger background sync
  triggerBackgroundSync();
}

let isSyncing = false;

async function triggerBackgroundSync(): Promise<void> {
  if (isSyncing) return;
  
  // Small delay to batch multiple rapid changes
  setTimeout(() => {
    performSync();
  }, 500);
}

export async function performSync(): Promise<{ success: boolean; errors: string[] }> {
  if (isSyncing) return { success: false, errors: ['Sync already in progress'] };
  
  const isOnline = navigator.onLine;
  if (!isOnline) {
    return { success: false, errors: ['Device is offline'] };
  }

  isSyncing = true;
  const errors: string[] = [];

  try {
    const db = await getDB();
    const queueItems = await db.getAllFromIndex('syncQueue', 'by-timestamp');
    
    if (queueItems.length === 0) {
      isSyncing = false;
      return { success: true, errors: [] };
    }

    // Group by table for efficient batching
    const habitsToUpsert: Record<string, unknown>[] = [];
    const habitsToDelete: string[] = [];
    const entriesToUpsert: Record<string, unknown>[] = [];
    const entriesToDelete: string[] = [];

    for (const item of queueItems) {
      if (item.retryCount > 5) {
        errors.push(`Item ${item.id} exceeded max retries`);
        continue;
      }

      if (item.table === 'habits') {
        if (item.operation === 'upsert') {
          habitsToUpsert.push(item.data);
        } else {
          habitsToDelete.push(item.data.id as string);
        }
      } else {
        if (item.operation === 'upsert') {
          entriesToUpsert.push(item.data);
        } else {
          entriesToDelete.push(item.data.id as string);
        }
      }
    }

    // Execute sync operations
    if (habitsToUpsert.length > 0) {
      const { error } = await supabase.from('habits').upsert(habitsToUpsert, { onConflict: 'id' });
      if (error) {
        errors.push(`Habits upsert failed: ${error.message}`);
      }
    }

    if (habitsToDelete.length > 0) {
      const { error } = await supabase.from('habits').delete().in('id', habitsToDelete);
      if (error) {
        errors.push(`Habits delete failed: ${error.message}`);
      }
    }

    if (entriesToUpsert.length > 0) {
      const { error } = await supabase.from('habit_entries').upsert(entriesToUpsert, { onConflict: 'id' });
      if (error) {
        errors.push(`Entries upsert failed: ${error.message}`);
      }
    }

    if (entriesToDelete.length > 0) {
      const { error } = await supabase.from('habit_entries').delete().in('id', entriesToDelete);
      if (error) {
        errors.push(`Entries delete failed: ${error.message}`);
      }
    }

    // Clear processed items from queue (only successful ones)
    if (errors.length === 0) {
      const tx = db.transaction('syncQueue', 'readwrite');
      for (const item of queueItems) {
        await tx.store.delete(item.id);
      }
      await tx.done;
    } else {
      // Increment retry count for failed items
      const tx = db.transaction('syncQueue', 'readwrite');
      for (const item of queueItems) {
        item.retryCount++;
        await tx.store.put(item);
      }
      await tx.done;
    }

    // Update last sync timestamp
    const userId = habitsToUpsert[0]?.user_id as string || entriesToUpsert[0]?.user_id as string;
    if (userId) {
      await saveSettings(userId, { last_sync_at: new Date().toISOString() });
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Sync failed: ${errorMsg}`);
  } finally {
    isSyncing = false;
  }

  return { success: errors.length === 0, errors };
}

// Pull data from Supabase
export async function pullFromServer(userId: string, since?: string): Promise<{ success: boolean; error?: string }> {
  if (!navigator.onLine) {
    return { success: false, error: 'Device is offline' };
  }

  try {
    // Pull habits
    let habitsQuery = supabase.from('habits').select('*').eq('user_id', userId);
    if (since) {
      habitsQuery = habitsQuery.gt('updated_at', since);
    }
    const { data: habits, error: habitsError } = await habitsQuery;
    
    if (habitsError) {
      return { success: false, error: `Failed to fetch habits: ${habitsError.message}` };
    }

    // Pull entries
    let entriesQuery = supabase.from('habit_entries').select('*').eq('user_id', userId);
    if (since) {
      entriesQuery = entriesQuery.gt('updated_at', since);
    }
    const { data: entries, error: entriesError } = await entriesQuery;
    
    if (entriesError) {
      return { success: false, error: `Failed to fetch entries: ${entriesError.message}` };
    }

    // Merge into local cache (last-write-wins based on updated_at)
    const db = await getDB();
    
    // Merge habits
    for (const remoteHabit of (habits || [])) {
      const localHabit = await db.get('habits', remoteHabit.id);
      if (!localHabit || new Date(remoteHabit.updated_at) >= new Date(localHabit.updated_at)) {
        await db.put('habits', remoteHabit as Habit);
      }
    }

    // Merge entries
    for (const remoteEntry of (entries || [])) {
      const localEntry = await db.get('habitEntries', remoteEntry.id);
      if (!localEntry || new Date(remoteEntry.updated_at) >= new Date(localEntry.updated_at)) {
        await db.put('habitEntries', remoteEntry as HabitEntry);
      }
    }

    await saveSettings(userId, { last_sync_at: new Date().toISOString() });
    return { success: true };

  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Full sync (push pending changes then pull from server)
export async function fullSync(userId: string): Promise<{ success: boolean; errors: string[] }> {
  // First, push any pending local changes
  const pushResult = await performSync();
  
  // Then, pull from server
  const settings = await getSettings(userId);
  const pullResult = await pullFromServer(userId, settings?.last_sync_at || undefined);
  
  const errors = [...pushResult.errors];
  if (!pullResult.success && pullResult.error) {
    errors.push(pullResult.error);
  }

  return { success: errors.length === 0, errors };
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online, triggering sync...');
    triggerBackgroundSync();
  });
}
