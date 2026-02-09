import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, ChevronDown, Trash2, Edit2, GripVertical, RefreshCw } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHabits, useHabitEntries, useSync } from '../../hooks/useSync';
import { clearOldData } from '../../lib/sync';
import type { Habit, ViewMode } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_FASTING_HOURS = 18;

// Default habits for new users
const DEFAULT_HABITS: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Fasting', icon: '🍽️', color: '#f59e0b', order_index: 0, is_two_step: false, schema_version: 1 },
  { name: '5 Ltr Water', icon: '💧', color: '#3b82f6', order_index: 1, is_two_step: false, schema_version: 1 },
  { name: 'No Eat Outside', icon: '🏠', color: '#10b981', order_index: 2, is_two_step: false, schema_version: 1 },
  { name: 'Running', icon: '🏃', color: '#f97316', order_index: 3, is_two_step: false, schema_version: 1 },
  { name: 'Exercise', icon: '💪', color: '#a855f7', order_index: 4, is_two_step: false, schema_version: 1 },
  { name: 'Protine', icon: '🥩', color: '#eab308', order_index: 5, is_two_step: false, schema_version: 1 },
  { name: 'Meditation', icon: '🧘', color: '#06b6d4', order_index: 6, is_two_step: false, schema_version: 1 },
  { name: 'Vitamins 2 Times', icon: '💊', color: '#ec4899', order_index: 7, is_two_step: true, schema_version: 1 },
  { name: 'Reading', icon: '📖', color: '#6366f1', order_index: 8, is_two_step: false, schema_version: 1 },
  { name: '2 Brush', icon: '🪥', color: '#14b8a6', order_index: 9, is_two_step: true, schema_version: 1 },
  { name: 'Travel', icon: '✈️', color: '#f43f5e', order_index: 10, is_two_step: false, schema_version: 1 },
  { name: 'No Fap', icon: '🚫', color: '#8b5cf6', order_index: 11, is_two_step: false, schema_version: 1 },
];

function getToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

function getLast10Days(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 9; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatDateKey(d));
  }
  return dates;
}

interface Stats {
  week: { count: number; total: number; percent: number };
  month: { count: number; total: number; percent: number };
  year: { count: number; total: number; percent: number };
}

function calculateStats(entries: Map<string, number>, isTwoStep: boolean): Stats {
  const today = new Date();
  
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weekDates.push(formatDateKey(d));
  }
  
  const monthDates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    monthDates.push(formatDateKey(d));
  }
  
  const yearDates: string[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    yearDates.push(formatDateKey(d));
  }
  
  function calcCount(dates: string[]) {
    let count = 0;
    dates.forEach(date => {
      const value = entries.get(date) ?? 0;
      if (isTwoStep) {
        if (value === 2) count += 1;
        else if (value === 1) count += 0.5;
      } else {
        if (value === 1) count += 1;
      }
    });
    return { count: Math.round(count * 10) / 10, total: dates.length };
  }
  
  const week = calcCount(weekDates);
  const month = calcCount(monthDates);
  const year = calcCount(yearDates);
  
  return {
    week: { ...week, percent: week.total > 0 ? Math.round((week.count / week.total) * 100) : 0 },
    month: { ...month, percent: month.total > 0 ? Math.round((month.count / month.total) * 100) : 0 },
    year: { ...year, percent: year.total > 0 ? Math.round((year.count / year.total) * 100) : 0 },
  };
}

export function HealthModule() {
  const { 
    habits, 
    isLoading: habitsLoading, 
    addHabit, 
    updateHabit, 
    removeHabit, 
    reorder,
    syncStatus,
  } = useHabits();
  const { entries, setEntry } = useHabitEntries();
  const { sync, isSyncing } = useSync();
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<Record<string, ViewMode>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [entryValues, setEntryValues] = useState<Map<string, Map<string, number>>>(new Map());
  const [hasInitializedDefaults, setHasInitializedDefaults] = useState(false);

  // Load entry values into a map for fast lookup
  useEffect(() => {
    const map = new Map<string, Map<string, number>>();
    entries.forEach((entry: { habit_id: string; date: string; value: number }) => {
      if (!map.has(entry.habit_id)) {
        map.set(entry.habit_id, new Map());
      }
      map.get(entry.habit_id)!.set(entry.date, entry.value);
    });
    setEntryValues(map);
  }, [entries]);

  // Initialize default habits if user has no habits
  useEffect(() => {
    const initDefaults = async () => {
      // Clear old data with wrong user_id on first load
      clearOldData();
      
      if (!habitsLoading && habits.length === 0 && !hasInitializedDefaults) {
        setHasInitializedDefaults(true);
        
        // Check localStorage too
        const localData = localStorage.getItem('master-mausam-data-v2');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed.habits?.length > 0) {
            console.log('[Health] Habits exist in localStorage v2, skipping default creation');
            return;
          }
        }
        
        console.log('[Health] Creating default habits');
        for (const [index, habit] of DEFAULT_HABITS.entries()) {
          await addHabit({ ...habit, order_index: index });
        }
      }
    };
    
    initDefaults();
  }, [habitsLoading, habits.length, hasInitializedDefaults, addHabit]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = habits.findIndex((item) => item.id === active.id);
      const newIndex = habits.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(habits, oldIndex, newIndex);
      reorder(reordered.map((h: Habit) => h.id));
    }
  }, [habits, reorder]);

  const toggleDate = useCallback(async (habitId: string, date: string, isTwoStep: boolean, habitName?: string) => {
    const currentValue = entryValues.get(habitId)?.get(date) ?? 0;
    let newValue: number;

    const isFasting = habitName === 'Fasting' || habitName === 'fasting';

    if (isFasting && !isTwoStep) {
      newValue = currentValue === 1 ? 0 : 1;
    } else if (isTwoStep) {
      newValue = (currentValue + 1) % 3;
    } else {
      newValue = currentValue === 1 ? 0 : 1;
    }

    await setEntry(habitId, date, { 
      value: newValue,
      ...(isFasting && newValue === 1 ? { fasting_hours: DEFAULT_FASTING_HOURS } : {})
    });
  }, [entryValues, setEntry]);

  const toggleExpand = useCallback((habitId: string) => {
    setExpandedId(prev => prev === habitId ? null : habitId);
  }, []);

  const handleAddHabit = useCallback(async (name: string, icon: string, color: string, isTwoStep: boolean) => {
    await addHabit({
      name,
      icon,
      color,
      order_index: habits.length,
      is_two_step: isTwoStep,
      schema_version: 1,
    });
    setShowAddModal(false);
  }, [addHabit, habits.length]);

  const handleUpdateHabit = useCallback(async (habitId: string, updates: Partial<Habit>) => {
    await updateHabit(habitId, updates);
    setEditingHabit(null);
  }, [updateHabit]);

  const handleDeleteHabit = useCallback(async (habitId: string) => {
    if (confirm('Delete this habit?')) {
      await removeHabit(habitId);
    }
  }, [removeHabit]);

  const handleManualSync = useCallback(async () => {
    await sync();
  }, [sync]);

  if (habitsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#58a6ff]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[#c9d1d9]">Health Habits</h2>
          <p className="text-sm text-[#8b949e]">Track your daily routine</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-2 bg-[#21262d] text-[#8b949e] rounded-lg hover:bg-[#30363d] disabled:opacity-50 transition-colors"
            title="Sync with server"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#238636] text-white rounded-lg font-medium hover:bg-[#2ea043] transition-colors"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Habit</span>
          </button>
        </div>
      </div>

      {syncStatus === 'error' && (
        <div className="mb-4 p-3 bg-[#f85149]/10 border border-[#f85149]/30 rounded-lg text-sm text-[#f85149]">
          Sync failed. Changes saved locally and will sync when connection is restored.
        </div>
      )}

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={habits.map(h => h.id)} 
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {habits.map((habit) => (
              <SortableHabitCard
                key={habit.id}
                habit={habit}
                entries={entryValues.get(habit.id) || new Map()}
                isExpanded={expandedId === habit.id}
                viewMode={viewMode[habit.id] || 'month'}
                onToggleExpand={() => toggleExpand(habit.id)}
                onToggleDate={(date) => toggleDate(habit.id, date, habit.is_two_step, habit.name)}
                onSetViewMode={(mode) => setViewMode(prev => ({ ...prev, [habit.id]: mode }))}
                onEdit={() => setEditingHabit(habit)}
                onDelete={() => handleDeleteHabit(habit.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {habits.length === 0 && !habitsLoading && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-[#8b949e] mb-2">No habits yet</h3>
          <p className="text-[#6e7681] mb-6">Add your first habit to start tracking</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-[#238636] text-white rounded-lg font-medium hover:bg-[#2ea043] transition-colors"
          >
            Add Habit
          </button>
        </div>
      )}

      {showAddModal && (
        <HabitModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddHabit}
        />
      )}

      {editingHabit && (
        <HabitModal
          habit={editingHabit}
          onClose={() => setEditingHabit(null)}
          onSave={(name, icon, color, isTwoStep) => handleUpdateHabit(editingHabit.id, { name, icon, color, is_two_step: isTwoStep })}
        />
      )}
    </div>
  );
}

interface SortableHabitCardProps {
  habit: Habit;
  entries: Map<string, number>;
  isExpanded: boolean;
  viewMode: ViewMode;
  onToggleExpand: () => void;
  onToggleDate: (date: string) => void;
  onSetViewMode: (mode: ViewMode) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableHabitCard(props: SortableHabitCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <HabitCard {...props} dragHandleProps={{ 
        attributes: attributes as unknown as Record<string, unknown>, 
        listeners: listeners as unknown as Record<string, unknown> | undefined 
      }} />
    </div>
  );
}

interface HabitCardProps extends SortableHabitCardProps {
  dragHandleProps?: {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown> | undefined;
  };
}

function HabitCard({ 
  habit, 
  entries,
  isExpanded, 
  viewMode, 
  onToggleExpand, 
  onToggleDate,
  onSetViewMode,
  onEdit,
  onDelete,
  dragHandleProps,
}: HabitCardProps) {
  const today = getToday();
  const todayValue = entries.get(today) ?? 0;
  const last10Days = useMemo(() => getLast10Days(), []);
  const stats = useMemo(() => calculateStats(entries, habit.is_two_step), [entries, habit.is_two_step]);

  return (
    <div 
      className={`border border-[#30363d] rounded-xl overflow-hidden transition-all bg-[#161b22] ${isExpanded ? 'ring-1 ring-[#30363d]' : ''}`}
    >
      <div 
        className="p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <div 
              {...dragHandleProps.attributes} 
              {...dragHandleProps.listeners}
              className="touch-none p-1 -ml-1 text-[#484f58] hover:text-[#8b949e] cursor-grab active:cursor-grabbing shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={16} />
            </div>
          )}
          
          <span className="text-xl shrink-0">{habit.icon}</span>
          <span className="font-medium text-[#c9d1d9] flex-1 truncate">{habit.name}</span>
          
          <div 
            className="mr-1 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDate(today);
            }}
          >
            {habit.is_two_step ? (
              <TwoStepToggle value={todayValue} />
            ) : (
              <div className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                todayValue === 1 
                  ? 'bg-[#238636] border-[#238636]' 
                  : 'bg-transparent border-[#30363d] hover:border-[#484f58]'
              }`}
              >
                {todayValue === 1 && (
                  <svg className="w-4 h-4 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            )}
          </div>
          
          <ChevronDown 
            size={18} 
            className={`text-[#484f58] transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
        
        <div className="flex items-center gap-3 mt-2 ml-6">
          <StatBadge label="W" count={stats.week.count} total={stats.week.total} percent={stats.week.percent} color={habit.color} />
          <StatBadge label="M" count={stats.month.count} total={stats.month.total} percent={stats.month.percent} color={habit.color} />
          <StatBadge label="Y" count={stats.year.count} total={stats.year.total} percent={stats.year.percent} color={habit.color} />
        </div>
        
        <div className="flex items-center gap-1 mt-2 ml-6">
          {last10Days.map((date) => {
            const value = entries.get(date) ?? 0;
            const isToday = date === today;
            
            let bgColor = '#21262d';
            if (value > 0) {
              if (habit.is_two_step) {
                bgColor = value === 2 ? habit.color : `${habit.color}80`;
              } else {
                bgColor = habit.color;
              }
            }
            
            return (
              <div
                key={date}
                className={`w-2.5 h-2.5 rounded-sm ${isToday ? 'ring-1 ring-[#8b949e] ring-offset-1 ring-offset-[#161b22]' : ''}`}
                style={{ backgroundColor: bgColor }}
                title={date}
              />
            );
          })}
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-[#21262d]">
          <div className="flex items-center gap-2 py-2">
            <button
              onClick={(e) => { e.stopPropagation(); onSetViewMode('month'); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'month' ? 'bg-[#238636] text-white' : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
              }`}
            >
              Month
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSetViewMode('year'); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'year' ? 'bg-[#238636] text-white' : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
              }`}
            >
              Year
            </button>
            
            <div className="flex-1" />
            
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-[#8b949e] hover:text-[#c9d1d9]">
              <Edit2 size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-[#8b949e] hover:text-[#f85149]">
              <Trash2 size={14} />
            </button>
          </div>

          {viewMode === 'month' ? (
            <MonthView habit={habit} entries={entries} onToggleDate={onToggleDate} />
          ) : (
            <YearView habit={habit} entries={entries} />
          )}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, count, total, percent, color }: { 
  label: string; 
  count: number; 
  total: number; 
  percent: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[#6e7681]">{label}:</span>
      <span className="text-xs font-medium text-[#8b949e]">{count}/{total}</span>
      <span className="text-xs font-medium" style={{ color }}>{percent}%</span>
    </div>
  );
}

function TwoStepToggle({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: value >= 1 ? '#238636' : '#21262d' }} />
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: value >= 2 ? '#238636' : '#21262d' }} />
    </div>
  );
}

function MonthView({ habit, entries, onToggleDate }: { habit: Habit; entries: Map<string, number>; onToggleDate: (date: string) => void }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, () => 0);
  
  return (
    <div>
      <div className="text-xs font-medium text-[#8b949e] mb-1.5">{MONTHS[month]} {year}</div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-[10px] text-[#484f58] text-center py-0.5">{d[0]}</div>
        ))}
        {blanks.map((_, idx) => <div key={`blank-${idx}`} />)}
        {days.map(day => {
          const date = formatDateKey(new Date(year, month, day));
          const value = entries.get(date) ?? 0;
          const isToday = date === getToday();
          
          let bgColor = 'transparent';
          let textColor = 'text-[#6e7681]';
          
          if (value > 0) {
            bgColor = habit.color;
            textColor = 'text-[#0d1117]';
          }
          
          return (
            <button
              key={day}
              onClick={(e) => { e.stopPropagation(); onToggleDate(date); }}
              className={`aspect-square rounded-md text-xs font-medium flex items-center justify-center transition-all min-h-[28px] ${
                isToday ? 'ring-1 ring-[#58a6ff]' : ''
              } ${textColor} hover:bg-[#21262d]`}
              style={{ backgroundColor: bgColor }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ habit, entries }: { habit: Habit; entries: Map<string, number> }) {
  const today = new Date();
  const year = today.getFullYear();
  
  return (
    <div className="grid grid-cols-3 gap-2">
      {MONTHS.map((monthName, monthIndex) => {
        const daysInMonth = getDaysInMonth(year, monthIndex);
        let completed = 0;
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = formatDateKey(new Date(year, monthIndex, day));
          const value = entries.get(date) ?? 0;
          if (habit.is_two_step) {
            if (value === 2) completed += 1;
            else if (value === 1) completed += 0.5;
          } else {
            if (value === 1) completed += 1;
          }
        }
        
        const percent = Math.round((completed / daysInMonth) * 100);
        
        return (
          <div key={monthName} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2">
            <div className="text-[10px] font-medium text-[#6e7681] mb-1">{monthName}</div>
            <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: habit.color }}
              />
            </div>
            <div className="text-[10px] text-[#484f58] mt-0.5">{percent}%</div>
          </div>
        );
      })}
    </div>
  );
}

function HabitModal({ 
  habit, 
  onClose, 
  onSave 
}: { 
  habit?: Habit; 
  onClose: () => void; 
  onSave: (name: string, icon: string, color: string, isTwoStep: boolean) => void;
}) {
  const [name, setName] = useState(habit?.name || '');
  const [icon, setIcon] = useState(habit?.icon || '⭐');
  const [color, setColor] = useState(habit?.color || '#3b82f6');
  const [isTwoStep, setIsTwoStep] = useState(habit?.is_two_step || false);
  
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#c9d1d9'];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[#c9d1d9] mb-4">{habit ? 'Edit' : 'Add'} Habit</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#8b949e]">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#58a6ff]"
              placeholder="e.g., Exercise"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#8b949e]">Icon</label>
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] text-center text-lg focus:outline-none focus:border-[#58a6ff]"
                placeholder="⭐"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-[#8b949e]">Two-step</label>
              <div className="flex items-center h-[42px] mt-1">
                <input
                  type="checkbox"
                  checked={isTwoStep}
                  onChange={e => setIsTwoStep(e.target.checked)}
                  className="w-4 h-4 rounded border-[#30363d] bg-[#0d1117]"
                />
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-xs font-medium text-[#8b949e]">Color</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {colors.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-md ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#161b22]' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#30363d] text-[#c9d1d9] rounded-lg font-medium text-sm hover:bg-[#21262d]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name, icon, color, isTwoStep)}
            disabled={!name}
            className="flex-1 py-2.5 bg-[#238636] text-white rounded-lg font-medium text-sm hover:bg-[#2ea043] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
