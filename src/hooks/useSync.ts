import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  const { user, isAuthenticated } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchHabits = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getHabits(user.id);
      if (isMounted.current) {
        setHabits(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load habits');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id]);

  const syncWithServer = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;
    
    setSyncStatus('syncing');
    try {
      const result = await fullSync(user.id);
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
    }
  }, [user?.id, isAuthenticated, fetchHabits]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchHabits();
      syncWithServer();
    }
  }, [isAuthenticated, user?.id, fetchHabits, syncWithServer]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const addHabit = useCallback(async (
    habitData: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<Habit> => {
    if (!user?.id) throw new Error('Not authenticated');

    const id = crypto.randomUUID();
    const habit = await saveHabit(user.id, {
      ...habitData,
      id,
    });

    setHabits(prev => [...prev, habit].sort((a, b) => a.order_index - b.order_index));
    
    // Trigger background sync
    performSync().catch(console.error);
    
    return habit;
  }, [user?.id]);

  const updateHabit = useCallback(async (id: string, updates: Partial<Habit>): Promise<Habit | null> => {
    if (!user?.id) throw new Error('Not authenticated');

    const habit = await saveHabit(user.id, { id, ...updates });
    
    setHabits(prev => 
      prev.map(h => h.id === id ? habit : h).sort((a, b) => a.order_index - b.order_index)
    );

    performSync().catch(console.error);
    
    return habit;
  }, [user?.id]);

  const removeHabit = useCallback(async (id: string): Promise<void> => {
    if (!user?.id) throw new Error('Not authenticated');

    await deleteHabit(user.id, id);
    setHabits(prev => prev.filter(h => h.id !== id));

    performSync().catch(console.error);
  }, [user?.id]);

  const reorder = useCallback(async (habitIds: string[]): Promise<void> => {
    if (!user?.id) throw new Error('Not authenticated');

    await reorderHabits(user.id, habitIds);
    
    // Optimistically update UI
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
  }, [user?.id]);

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
  const { user, isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getHabitEntries(user.id, options);
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
  }, [user?.id, options?.habitId]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchEntries();
    }
  }, [isAuthenticated, user?.id, fetchEntries]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getEntry = useCallback(async (habitId: string, date: string) => {
    if (!user?.id) return undefined;
    return await getHabitEntry(user.id, habitId, date);
  }, [user?.id]);

  const setEntry = useCallback(async (
    habitId: string,
    date: string,
    data: { value: number; fasting_hours?: number; note?: string }
  ): Promise<HabitEntry> => {
    if (!user?.id) throw new Error('Not authenticated');

    const entry = await saveHabitEntry(user.id, habitId, date, data);
    
    setEntries(prev => {
      const filtered = prev.filter(e => !(e.habit_id === habitId && e.date === date));
      return [...filtered, entry];
    });

    performSync().catch(console.error);
    
    return entry;
  }, [user?.id]);

  const removeEntry = useCallback(async (habitId: string, date: string): Promise<void> => {
    if (!user?.id) throw new Error('Not authenticated');

    await deleteHabitEntry(user.id, habitId, date);
    
    setEntries(prev => prev.filter(e => !(e.habit_id === habitId && e.date === date)));

    performSync().catch(console.error);
  }, [user?.id]);

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
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };

    setIsSyncing(true);
    setLastError(null);

    try {
      const result = await fullSync(user.id);
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
  }, [user?.id]);

  const pull = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };

    setIsSyncing(true);
    setLastError(null);

    try {
      const result = await pullFromServer(user.id);
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
  }, [user?.id]);

  return {
    sync,
    pull,
    isSyncing,
    lastError,
  };
}
