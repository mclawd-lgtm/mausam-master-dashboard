import type { DailyEntry } from '../types';

const STORAGE_KEY = 'health-dashboard-entries';

export const storageService = {
  getEntries: (): DailyEntry[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveEntry: (entry: DailyEntry): void => {
    const entries = storageService.getEntries();
    const existingIndex = entries.findIndex(e => e.date === entry.date);
    
    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  },

  getEntryByDate: (date: string): DailyEntry | undefined => {
    return storageService.getEntries().find(e => e.date === date);
  },

  exportData: (): string => {
    const entries = storageService.getEntries();
    return JSON.stringify(entries, null, 2);
  },

  importData: (jsonData: string): { success: boolean; message: string } => {
    try {
      const newEntries: DailyEntry[] = JSON.parse(jsonData);
      const existingEntries = storageService.getEntries();
      
      const merged = [...existingEntries];
      
      newEntries.forEach(newEntry => {
        const existingIndex = merged.findIndex(e => e.date === newEntry.date);
        if (existingIndex >= 0) {
          merged[existingIndex] = newEntry;
        } else {
          merged.push(newEntry);
        }
      });
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return { success: true, message: `Imported ${newEntries.length} entries` };
    } catch (error) {
      return { success: false, message: 'Invalid JSON format' };
    }
  },

  getFastingData: (): { date: string; fasted: boolean }[] => {
    return storageService.getEntries().map(entry => ({
      date: entry.date,
      fasted: entry.answers.fasted === true
    }));
  }
};