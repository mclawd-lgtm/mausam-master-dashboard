export interface Question {
  id: string;
  label: string;
  type: 'boolean' | 'scale' | 'number';
  min?: number;
  max?: number;
}

export interface DailyEntry {
  date: string;
  answers: Record<string, boolean | number>;
}

export interface WhoopData {
  sleepScore: number;
  hrv: number;
  restingHR: number;
  strain: number;
  recovery: number;
}

export interface StreakInfo {
  current: number;
  longest: number;
}