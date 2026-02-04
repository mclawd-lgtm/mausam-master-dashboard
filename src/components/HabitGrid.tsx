import { useMemo } from 'react';
import { calculateStreaks } from '../utils/streaks';

interface HabitGridProps {
  entries: { date: string; fasted: boolean }[];
}

const HabitGrid = ({ entries }: HabitGridProps) => {
  const { grid, streaks } = useMemo(() => {
    const today = new Date();
    const days: { date: string; fasted: boolean | null }[] = [];
    
    // Generate last 365 days
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const entry = entries.find(e => e.date === dateStr);
      days.push({
        date: dateStr,
        fasted: entry ? entry.fasted : null
      });
    }
    
    // Calculate weeks (columns)
    const weeks: { date: string; fasted: boolean | null }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    
    return {
      grid: weeks,
      streaks: calculateStreaks(entries)
    };
  }, [entries]);

  const getColorClass = (fasted: boolean | null) => {
    if (fasted === null) return 'bg-gray-200 dark:bg-gray-700';
    if (fasted) return 'bg-green-500';
    return 'bg-gray-300 dark:bg-gray-600';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Fasting History</h3>
        <div className="flex gap-4 text-xs text-[var(--text-muted)]">
          <span>Current: {streaks.current} days</span>
          <span>Longest: {streaks.longest} days</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-[2px] min-w-max">
          {grid.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[2px]">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`w-3 h-3 rounded-sm ${getColorClass(day.fasted)} transition-colors`}
                  title={`${day.date}: ${day.fasted === null ? 'No data' : day.fasted ? 'Fasted' : 'Not fasted'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700" />
          <div className="w-3 h-3 rounded-sm bg-gray-300 dark:bg-gray-600" />
          <div className="w-3 h-3 rounded-sm bg-green-500" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
};

export default HabitGrid;