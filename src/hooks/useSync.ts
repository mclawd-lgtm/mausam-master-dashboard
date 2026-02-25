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
  getHabitEntry,
  getCurrentSyncStatus,
  checkOnlineStatus,
  isSupabaseConfigured,
  checkSupabaseConfig,
} from '../lib/sync';

// ============================================
// HABITS HOOK - CLOUD FIRST WITH PROACTIVE SYNC
// ============================================

interface UseHabitsReturn {
  habits: Habit[];
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  lastSyncAt: string | null;
  isSyncing: boolean;
  refetch: () => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Habit>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<Habit | null>;
  removeHabit: (id: string) => Promise<void>;
  reorder: (habitIds: string[]) => Promise<void>;
}

export function useHabits(): UseHabitsReturn {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isMounted = useRef(true);
  const syncInterval = useRef<NodeJS.Timeout | null>(null);

  // Check Supabase config on mount
  useEffect(() => {
    const config = checkSupabaseConfig();
    if (!config.ok) {
      console.error('[useHabits]', config.error);
      setError(config.error || 'Supabase not configured');
    }
  }, []);

  // Fetch habits from cloud or localStorage
  const fetchHabits = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    
    // If Supabase not configured, load from localStorage only
    if (!isSupabaseConfigured) {
      console.log('[useHabits] Supabase not configured, using localStorage fallback');
      try {
        const { getLocalCache } = await import('../lib/sync');
        const cache = getLocalCache();
        if (isMounted.current) {
          setHabits(cache.habits);
          setIsOnline(false);
          setLastSyncAt(null);
        }
      } catch (err) {
        console.error('[useHabits] Failed to load from localStorage:', err);
        if (isMounted.current) {
          setError('Failed to load habits from local storage');
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
      return;
    }

    if (showLoading) setIsLoading(true);
    setError(null);
    
    try {
      const data = await getHabits();
      if (isMounted.current) {
        setHabits(data);
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
        setLastSyncAt(status.lastSyncAt);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load habits');
      }
    } finally {
      if (isMounted.current && showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  // PROACTIVE SYNC: Poll every 30 seconds
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Initial load
    fetchHabits();

    // Set up polling interval (30 seconds)
    syncInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('[Sync] Polling for updates...');
        fetchHabits(false); // Don't show loading spinner on poll
      }
    }, 30000);

    return () => {
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
    };
  }, [fetchHabits]);

  // PROACTIVE SYNC: Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Sync] Tab visible, refreshing data...');
        fetchHabits(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchHabits]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Add habit - cloud first
  const addHabit = useCallback(async (
    habitData: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<Habit> => {
    const id = crypto.randomUUID();
    setIsSyncing(true);
    
    try {
      const habit = await saveHabit({ ...habitData, id });
      if (isMounted.current) {
        setHabits(prev => [...prev, habit].sort((a, b) => a.order_index - b.order_index));
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
        setLastSyncAt(new Date().toISOString());
      }
      return habit;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Update habit - cloud first
  const updateHabit = useCallback(async (id: string, updates: Partial<Habit>): Promise<Habit | null> => {
    setIsSyncing(true);
    try {
      const habit = await saveHabit({ id, ...updates });
      
      if (isMounted.current) {
        setHabits(prev => 
          prev.map(h => h.id === id ? habit : h).sort((a, b) => a.order_index - b.order_index)
        );
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
        setLastSyncAt(new Date().toISOString());
      }
      
      return habit;
    } catch (err) {
      console.error('[useHabits] Failed to update habit:', err);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Remove habit - cloud first
  const removeHabit = useCallback(async (id: string): Promise<void> => {
    setIsSyncing(true);
    try {
      await deleteHabit(id);
      if (isMounted.current) {
        setHabits(prev => prev.filter(h => h.id !== id));
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
        setLastSyncAt(new Date().toISOString());
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Reorder habits - cloud first
  const reorder = useCallback(async (habitIds: string[]): Promise<void> => {
    setIsSyncing(true);
    try {
      await reorderHabits(habitIds);
      
      if (isMounted.current) {
        setHabits(prev => {
          const habitMap = new Map(prev.map(h => [h.id, h]));
          return habitIds
            .map((id, index) => {
              const habit = habitMap.get(id);
              return habit ? { ...habit, order_index: index } : null;
            })
            .filter((h): h is Habit => h !== null);
        });
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
        setLastSyncAt(new Date().toISOString());
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    habits,
    isLoading,
    error,
    isOnline,
    lastSyncAt,
    isSyncing,
    refetch: fetchHabits,
    addHabit,
    updateHabit,
    removeHabit,
    reorder,
  };
}

// ============================================
// ENTRIES HOOK - CLOUD FIRST WITH PROACTIVE SYNC
// ============================================

interface UseHabitEntriesReturn {
  entries: HabitEntry[];
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  isSyncing: boolean;
  refetch: () => Promise<void>;
  getEntry: (habitId: string, date: string) => Promise<HabitEntry | undefined>;
  setEntry: (habitId: string, date: string, data: { value: number; fasting_hours?: number; note?: string }) => Promise<HabitEntry>;
  removeEntry: (habitId: string, date: string) => Promise<void>;
}

export function useHabitEntries(options?: { habitId?: string }): UseHabitEntriesReturn {
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const isMounted = useRef(true);
  const syncInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchEntries = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    
    // If Supabase not configured, load from localStorage only
    if (!isSupabaseConfigured) {
      console.log('[useHabitEntries] Supabase not configured, using localStorage fallback');
      try {
        const { getLocalCache } = await import('../lib/sync');
        const cache = getLocalCache();
        let entries = cache.entries;
        if (options?.habitId) {
          entries = entries.filter(e => e.habit_id === options.habitId);
        }
        if (isMounted.current) {
          setEntries(entries);
          setIsOnline(false);
        }
      } catch (err) {
        console.error('[useHabitEntries] Failed to load from localStorage:', err);
        if (isMounted.current) {
          setError('Failed to load entries from local storage');
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
      return;
    }
    
    try {
      const data = await getHabitEntries(options);
      if (isMounted.current) {
        setEntries(data);
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load entries');
      }
    } finally {
      if (isMounted.current && showLoading) {
        setIsLoading(false);
      }
    }
  }, [options?.habitId]);

  // PROACTIVE SYNC: Poll every 30 seconds
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Initial load
    fetchEntries();

    // Set up polling interval
    syncInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('[Sync] Polling entries for updates...');
        fetchEntries(false);
      }
    }, 30000);

    return () => {
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
    };
  }, [fetchEntries]);

  // PROACTIVE SYNC: Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Sync] Tab visible, refreshing entries...');
        fetchEntries(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchEntries]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getEntry = useCallback(async (habitId: string, date: string) => {
    return await getHabitEntry(habitId, date);
  }, []);

  // Set entry - cloud first with optimistic update
  const setEntry = useCallback(async (
    habitId: string,
    date: string,
    data: { value: number; fasting_hours?: number; note?: string }
  ): Promise<HabitEntry> => {
    setIsSyncing(true);
    
    // Optimistic update for UI responsiveness
    const optimisticEntry: HabitEntry = {
      id: `${habitId}:${date}`,
      user_id: '',
      habit_id: habitId,
      date,
      value: data.value,
      fasting_hours: data.fasting_hours,
      note: data.note,
      updated_at: new Date().toISOString(),
    };

    if (isMounted.current) {
      setEntries(prev => {
        const filtered = prev.filter(e => !(e.habit_id === habitId && e.date === date));
        return [...filtered, optimisticEntry];
      });
    }

    // Save to cloud
    try {
      const entry = await saveHabitEntry(habitId, date, data);
      
      if (isMounted.current) {
        setEntries(prev => {
          const filtered = prev.filter(e => !(e.habit_id === habitId && e.date === date));
          return [...filtered, entry];
        });
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
      }
      
      return entry;
    } catch (err) {
      // Revert optimistic update on error
      if (isMounted.current) {
        await fetchEntries(false);
      }
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [fetchEntries]);

  const removeEntry = useCallback(async (habitId: string, date: string): Promise<void> => {
    setIsSyncing(true);
    try {
      await deleteHabitEntry(habitId, date);
      
      if (isMounted.current) {
        setEntries(prev => prev.filter(e => !(e.habit_id === habitId && e.date === date)));
        const status = getCurrentSyncStatus();
        setIsOnline(status.isOnline);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    entries,
    isLoading,
    error,
    isOnline,
    isSyncing,
    refetch: fetchEntries,
    getEntry,
    setEntry,
    removeEntry,
  };
}

// ============================================
// SYNC CONTROL HOOK
// ============================================

interface UseSyncReturn {
  isOnline: boolean;
  lastSyncAt: string | null;
  isChecking: boolean;
  checkConnection: () => Promise<boolean>;
  configError: string | null;
}

export function useSync(): UseSyncReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Check config on mount
  useEffect(() => {
    const config = checkSupabaseConfig();
    if (!config.ok) {
      setConfigError(config.error || 'Configuration error');
      setIsOnline(false);
    }
  }, []);

  // Get initial status
  useEffect(() => {
    const status = getCurrentSyncStatus();
    setIsOnline(status.isOnline);
    setLastSyncAt(status.lastSyncAt);
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setIsOnline(false);
      return false;
    }

    setIsChecking(true);
    try {
      const online = await checkOnlineStatus();
      setIsOnline(online);
      if (online) {
        setLastSyncAt(new Date().toISOString());
      }
      return online;
    } catch {
      setIsOnline(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    isOnline,
    lastSyncAt,
    isChecking,
    checkConnection,
    configError,
  };
}
