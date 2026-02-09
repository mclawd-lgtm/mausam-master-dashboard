import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Habit,
  HabitEntry,
  getHabits,
  getHabitEntries,
  saveHabit,
  saveHabitEntry,
  deleteHabit,
  deleteHabitEntry,
  reorderHabits,
  fullSync,
  performSync,
  pullFromServer,
  getHabitEntry,
} from '../lib/sync';

interface UseHabitsReturn {
  habits: Habit[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Habit>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<Habit | null>;
  removeHabit: (id: string) => Promise<void>;
  reorder: (habitIds: string[]) => Promise<void>;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncAt: string | null;
}

export function useHabits(): UseHabitsReturn {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchHabits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getHabits();
      if (isMounted.current) {
        setHabits(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load habits');
        setHabits([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const syncWithServer = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const result = await fullSync();
      
      if (result.success) {
        setSyncStatus('idle');
        setLastSyncAt(new Date().toISOString());
        await fetchHabits();
      } else {
        setSyncStatus('error');
        console.error('Sync errors:', result.errors);
      }
    } catch (err) {
      setSyncStatus('error');
      console.error('Sync failed:', err);
      await fetchHabits();
    }
  }, [fetchHabits]);

  useEffect(() => {
    fetchHabits();
    syncWithServer();
  }, [fetchHabits, syncWithServer]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const addHabit = useCallback(async (
    habitData: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<Habit> => {
    const id = crypto.randomUUID();
    const habit = await saveHabit({ ...habitData, id });

    setHabits(prev => [...prev, habit].sort((a, b) => a.order_index - b.order_index));
    performSync().catch(console.error);
    
    return habit;
  }, []);

  const updateHabit = useCallback(async (id: string, updates: Partial<Habit>): Promise<Habit | null> => {
    const habit = await saveHabit({ id, ...updates });
    
    setHabits(prev => 
      prev.map(h => h.id === id ? habit : h).sort((a, b) => a.order_index - b.order_index)
    );

    performSync().catch(console.error);
    
    return habit;
  }, []);

  const removeHabit = useCallback(async (id: string): Promise<void> => {
    await deleteHabit(id);
    setHabits(prev => prev.filter(h => h.id !== id));
    performSync().catch(console.error);
  }, []);

  const reorder = useCallback(async (habitIds: string[]): Promise<void> => {
    await reorderHabits(habitIds);
    
    setHabits(prev => {
      const habitMap = new Map(prev.map(h => [h.id, h]));
      return habitIds
        .map((id, index) => {
          const habit = habitMap.get(id);
          return habit ? { ...habit, order_index: index } : null;
        })
        .filter((h): h is Habit => h !== null);
    });

    performSync().catch(console.error);
  }, []);

  return {
    habits,
    isLoading,
    error,
    refetch: fetchHabits,
    addHabit,
    updateHabit,
    removeHabit,
    reorder,
    syncStatus,
    lastSyncAt,
  };
}

interface UseHabitEntriesReturn {
  entries: HabitEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getEntry: (habitId: string, date: string) => Promise<HabitEntry | undefined>;
  setEntry: (habitId: string, date: string, data: { value: number; fasting_hours?: number; note?: string }) => Promise<HabitEntry>;
  removeEntry: (habitId: string, date: string) => Promise<void>;
}

export function useHabitEntries(options?: { habitId?: string }): UseHabitEntriesReturn {
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getHabitEntries(options);
      if (isMounted.current) {
        setEntries(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load entries');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [options?.habitId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getEntry = useCallback(async (habitId: string, date: string) => {
    return await getHabitEntry(habitId, date);
  }, []);

  const setEntry = useCallback(async (
    habitId: string,
    date: string,
    data: { value: number; fasting_hours?: number; note?: string }
  ): Promise<HabitEntry> => {
    const entry = await saveHabitEntry(habitId, date, data);
    
    setEntries(prev => {
      const filtered = prev.filter(e => !(e.habit_id === habitId && e.date === date));
      return [...filtered, entry];
    });

    performSync().catch(console.error);
    
    return entry;
  }, []);

  const removeEntry = useCallback(async (habitId: string, date: string): Promise<void> => {
    await deleteHabitEntry(habitId, date);
    
    setEntries(prev => prev.filter(e => !(e.habit_id === habitId && e.date === date)));
    performSync().catch(console.error);
  }, []);

  return {
    entries,
    isLoading,
    error,
    refetch: fetchEntries,
    getEntry,
    setEntry,
    removeEntry,
  };
}

// Hook for manual sync control
export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    setLastError(null);

    try {
      const result = await fullSync();
      if (!result.success) {
        setLastError(result.errors.join(', '));
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setLastError(error);
      return { success: false, errors: [error] };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const pull = useCallback(async () => {
    setIsSyncing(true);
    setLastError(null);

    try {
      const result = await pullFromServer();
      if (!result.success && result.error) {
        setLastError(result.error);
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setLastError(error);
      return { success: false, error };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    sync,
    pull,
    isSyncing,
    lastError,
  };
}
