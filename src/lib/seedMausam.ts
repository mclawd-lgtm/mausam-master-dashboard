// Add Mausam's specific habits
import { getHabits, saveHabit, deleteHabit } from './sync';

const MAUSAM_HABITS = [
  { name: 'Fasting', icon: '⏰', color: '#ef4444', is_two_step: false },
  { name: '5 Ltr Water', icon: '💧', color: '#0ea5e9', is_two_step: false },
  { name: 'No Eat Outside', icon: '🍽️', color: '#22c55e', is_two_step: false },
  { name: 'Running', icon: '🏃', color: '#f97316', is_two_step: false },
  { name: 'Exercise', icon: '💪', color: '#8b5cf6', is_two_step: false },
  { name: 'Protein', icon: '🥩', color: '#f59e0b', is_two_step: false },
  { name: 'Meditation', icon: '🧘', color: '#14b8a6', is_two_step: false },
  { name: 'Vitamins 2 Times', icon: '💊', color: '#ec4899', is_two_step: true },
  { name: 'Reading', icon: '📖', color: '#6366f1', is_two_step: false },
  { name: '2 Brush', icon: '🪥', color: '#06b6d4', is_two_step: true },
  { name: 'Travel', icon: '✈️', color: '#3b82f6', is_two_step: false },
  { name: 'No Fap', icon: '🚫', color: '#dc2626', is_two_step: false },
  { name: 'Butterfly', icon: '🦋', color: '#a855f7', is_two_step: false },
];

export async function seedMausamHabits(): Promise<void> {
  // Check if Mausam's habits already exist
  const existing = await getHabits();
  if (existing.length >= 5) return; // Already has habits
  
  // Clear existing default habits
  for (const habit of existing) {
    await deleteHabit(habit.id);
  }
  
  for (let i = 0; i < MAUSAM_HABITS.length; i++) {
    const habit = MAUSAM_HABITS[i];
    const id = crypto.randomUUID();
    await saveHabit({
      id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      order_index: i,
      is_two_step: habit.is_two_step,
    });
  }
  
  console.log('[Seed] Mausam habits added:', MAUSAM_HABITS.length);
}
