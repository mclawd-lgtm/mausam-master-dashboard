import type { StreakInfo } from '../types';

export const calculateStreaks = (entries: { date: string; fasted: boolean }[]): StreakInfo => {
  if (entries.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Sort entries by date
  const sorted = [...entries].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Filter only fasted entries
  const fastedDates = sorted.filter(e => e.fasted).map(e => new Date(e.date));
  
  if (fastedDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Calculate longest streak
  let longest = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < fastedDates.length; i++) {
    const prev = fastedDates[i - 1];
    const curr = fastedDates[i];
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diffDays === 1) {
      currentStreak++;
      longest = Math.max(longest, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  // Calculate current streak (from today backwards)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let current = 0;
  const fastedDateStrings = sorted.filter(e => e.fasted).map(e => e.date);
  
  // Check if fasted today
  const todayStr = today.toISOString().split('T')[0];
  if (fastedDateStrings.includes(todayStr)) {
    current = 1;
    
    // Check previous days
    let checkDate = new Date(today);
    while (true) {
      checkDate.setDate(checkDate.getDate() - 1);
      const checkStr = checkDate.toISOString().split('T')[0];
      if (fastedDateStrings.includes(checkStr)) {
        current++;
      } else {
        break;
      }
    }
  } else {
    // Check if fasted yesterday (streak might still be active)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (fastedDateStrings.includes(yesterdayStr)) {
      current = 1;
      
      let checkDate = new Date(yesterday);
      while (true) {
        checkDate.setDate(checkDate.getDate() - 1);
        const checkStr = checkDate.toISOString().split('T')[0];
        if (fastedDateStrings.includes(checkStr)) {
          current++;
        } else {
          break;
        }
      }
    }
  }

  return { current, longest };
};