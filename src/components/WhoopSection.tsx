import { useEffect, useState } from 'react';
import type { WhoopData } from '../types';
import { whoopService } from '../services/whoop';

const WhoopSection = () => {
  const [data, setData] = useState<WhoopData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const whoopData = await whoopService.getCurrentData();
        setData(whoopData);
      } catch (error) {
        console.error('Failed to fetch Whoop data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Whoop Metrics</h3>
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Whoop Metrics</h3>
        <p className="text-sm text-[var(--text-muted)] mt-2">Unable to load data</p>
      </div>
    );
  }

  const metrics = [
    { label: 'Sleep', value: data.sleepScore, unit: '%', color: 'text-blue-500' },
    { label: 'HRV', value: data.hrv, unit: 'ms', color: 'text-purple-500' },
    { label: 'Resting HR', value: data.restingHR, unit: 'bpm', color: 'text-red-500' },
    { label: 'Strain', value: data.strain, unit: '', color: 'text-orange-500' },
    { label: 'Recovery', value: data.recovery, unit: '%', color: 'text-green-500' },
  ];

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Whoop Metrics</h3>
      <div className="grid grid-cols-5 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="text-center">
            <p className="text-xs text-[var(--text-muted)] mb-1">{metric.label}</p>
            <p className={`text-lg font-semibold ${metric.color}`}>
              {metric.value}
              <span className="text-xs text-[var(--text-muted)] ml-0.5">{metric.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhoopSection;