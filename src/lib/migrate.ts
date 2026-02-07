// Migrate data from old localStorage format
export function migrateFromLocalStorage(): void {
  try {
    // Check if already migrated
    if (localStorage.getItem('data_migrated') === 'true') return;
    
    // Get old data
    const oldHabits = localStorage.getItem('health_habits');
    const oldEntries = localStorage.getItem('health_entries');
    
    if (oldHabits || oldEntries) {
      console.log('[Migration] Found old localStorage data');
      
      // Store in new format for later processing
      if (oldHabits) {
        localStorage.setItem('migrated_habits', oldHabits);
      }
      if (oldEntries) {
        localStorage.setItem('migrated_entries', oldEntries);
      }
      
      localStorage.setItem('data_migrated', 'true');
      console.log('[Migration] Data saved for processing');
    }
  } catch (err) {
    console.error('[Migration] Error:', err);
  }
}

// Get migrated habits
export function getMigratedHabits(): any[] {
  try {
    const data = localStorage.getItem('migrated_habits');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Get migrated entries
export function getMigratedEntries(): any[] {
  try {
    const data = localStorage.getItem('migrated_entries');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
