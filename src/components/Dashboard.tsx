import { useEffect, useState } from 'react';
import CheckIn from './CheckIn';
import HabitGrid from './HabitGrid';
import WhoopSection from './WhoopSection';
import DataPortability from './DataPortability';
import ThemeToggle from './ThemeToggle';
import { storageService } from '../services/storage';

interface DashboardProps {
  readOnly?: boolean;
}

const Dashboard = ({ readOnly = false }: DashboardProps) => {
  const [fastingEntries, setFastingEntries] = useState<{ date: string; fasted: boolean }[]>([]);

  useEffect(() => {
    setFastingEntries(storageService.getFastingData());
  }, []);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setFastingEntries(storageService.getFastingData());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {readOnly ? "Morning Dashboard" : "Health Dashboard"}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Check-in */}
          <div className="col-span-4">
            <CheckIn readOnly={readOnly} />
            
            {!readOnly && (
              <div className="mt-4">
                <DataPortability />
              </div>
            )}
          </div>

          {/* Right Column - Habit Grid + Whoop */}
          <div className="col-span-8 space-y-4">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
              <HabitGrid entries={fastingEntries} />
            </div>

            <WhoopSection />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;