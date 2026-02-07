import { openDB } from 'idb';

const MIGRATION_LOG_KEY = 'migration-log';
const DB_NAME = 'master-mausam-db';

interface MigrationRecord {
  version: number;
  appliedAt: string;
  success: boolean;
  error?: string;
}

interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

// Backup before migrations
async function createBackup(): Promise<{ success: boolean; backup?: Record<string, unknown>; error?: string }> {
  try {
    // Try to open DB - will fail if it doesn't exist
    let db;
    try {
      db = await openDB(DB_NAME);
    } catch {
      // DB doesn't exist yet, that's fine
      return { success: true };
    }
    
    // Check if stores exist
    const storeNames = db.objectStoreNames;
    if (!storeNames.contains('habits') || !storeNames.contains('habitEntries')) {
      return { success: true }; // Stores not ready yet
    }
    
    const tx = db.transaction(['habits', 'habitEntries', 'settings'], 'readonly');
    
    const [habits, entries, settings] = await Promise.all([
      tx.objectStore('habits').getAll(),
      tx.objectStore('habitEntries').getAll(),
      tx.objectStore('settings').getAll(),
    ]);
    
    await tx.done;
    
    const backup = {
      timestamp: new Date().toISOString(),
      habits,
      entries,
      settings,
    };
    
    // Store backup in localStorage for easy recovery
    localStorage.setItem('master-mausam-backup', JSON.stringify(backup));
    
    return { success: true, backup };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Backup failed' 
    };
  }
}

// Restore from backup
async function restoreFromBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    const backupStr = localStorage.getItem('master-mausam-backup');
    if (!backupStr) {
      return { success: false, error: 'No backup found' };
    }
    
    const backup = JSON.parse(backupStr);
    const db = await openDB(DB_NAME);
    
    const tx = db.transaction(['habits', 'habitEntries', 'settings'], 'readwrite');
    
    // Clear current data
    await tx.objectStore('habits').clear();
    await tx.objectStore('habitEntries').clear();
    await tx.objectStore('settings').clear();
    
    // Restore from backup
    for (const habit of backup.habits || []) {
      await tx.objectStore('habits').put(habit);
    }
    for (const entry of backup.entries || []) {
      await tx.objectStore('habitEntries').put(entry);
    }
    for (const setting of backup.settings || []) {
      await tx.objectStore('settings').put(setting);
    }
    
    await tx.done;
    
    return { success: true };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Restore failed' 
    };
  }
}

// Get migration log
function getMigrationLog(): MigrationRecord[] {
  try {
    const log = localStorage.getItem(MIGRATION_LOG_KEY);
    return log ? JSON.parse(log) : [];
  } catch {
    return [];
  }
}

// Add to migration log
function addToMigrationLog(record: MigrationRecord): void {
  const log = getMigrationLog();
  log.push(record);
  localStorage.setItem(MIGRATION_LOG_KEY, JSON.stringify(log));
}

// Check if migration was already applied
function isMigrationApplied(version: number): boolean {
  const log = getMigrationLog();
  return log.some(r => r.version === version && r.success);
}

// Migration definitions
const migrations: Migration[] = [
  // Example future migration:
  // {
  //   version: 2,
  //   name: 'add_reminder_field',
  //   up: async () => {
  //     const db = await openDB(DB_NAME);
  //     const tx = db.transaction('habits', 'readwrite');
  //     const habits = await tx.store.getAll();
  //     for (const habit of habits) {
  //       habit.reminder_time = null;
  //       habit.schema_version = 2;
  //       await tx.store.put(habit);
  //     }
  //     await tx.done;
  //   },
  // },
];

// Run all pending migrations
export async function runMigrations(): Promise<{ success: boolean; applied: number; errors: string[] }> {
  const errors: string[] = [];
  let applied = 0;

  // Create backup before running migrations
  const backup = await createBackup();
  if (!backup.success) {
    errors.push(`Backup warning: ${backup.error}`);
  }

  for (const migration of migrations) {
    if (isMigrationApplied(migration.version)) {
      continue; // Skip already applied migrations
    }

    try {
      console.log(`[Migration] Running ${migration.name} (v${migration.version})...`);
      await migration.up();
      
      addToMigrationLog({
        version: migration.version,
        appliedAt: new Date().toISOString(),
        success: true,
      });
      
      applied++;
      console.log(`[Migration] ${migration.name} completed successfully`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Migration ${migration.name} failed: ${errorMsg}`);
      
      addToMigrationLog({
        version: migration.version,
        appliedAt: new Date().toISOString(),
        success: false,
        error: errorMsg,
      });
      
      console.error(`[Migration] ${migration.name} failed:`, errorMsg);
    }
  }

  return { success: errors.length === 0, applied, errors };
}

// Get current schema version
export function getCurrentSchemaVersion(): number {
  const log = getMigrationLog();
  const successful = log.filter(r => r.success);
  if (successful.length === 0) return 1; // Initial schema is v1
  return Math.max(...successful.map(r => r.version));
}

// Migration utilities for future use
export const migrationUtils = {
  createBackup,
  restoreFromBackup,
  getMigrationLog,
  getCurrentSchemaVersion,
};
