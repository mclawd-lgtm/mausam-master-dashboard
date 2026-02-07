// Seed default habits for new users
import { getDB } from './sync';
import { getMigratedHabits } from './migrate';

const DEFAULT_HABITS = [
  { name: '💧 Drink Water', icon: '💧', color: '#0ea5e9', order_index: 0, is_two_step: false },
  { name: '🏃 Exercise', icon: '🏃', color: '#22c55e', order_index: 1, is_two_step: false },
  { name: '😴 Sleep 8hrs', icon: '😴', color: '#8b5cf6', order_index: 2, is_two_step: false },
  { name: '🧘 Meditate', icon: '🧘', color: '#f59e0b', order_index: 3, is_two_step: false },
  { name: '📖 Read', icon: '📖', color: '#ec4899', order_index: 4, is_two_step: false },
  { name: '⏰ Fasting', icon: '⏰', color: '#ef4444', order_index: 5, is_two_step: true },
];

export async function seedDefaultHabits(userId: string): Promise<void> {
  const db = await getDB();
  
  // Check if user already has habits
  const existing = await db.getAllFromIndex('habits', 'by-user', userId);
  if (existing.length > 0) return;
  
  // Try to migrate old habits first
  const migratedHabits = getMigratedHabits();
  if (migratedHabits.length > 0) {
    console.log('[Seed] Migrating', migratedHabits.length, 'old habits');
    const now = new Date().toISOString();
    
    for (let i = 0; i < migratedHabits.length; i++) {
      const old = migratedHabits[i];
      await db.put('habits', {
        id: old.id || crypto.randomUUID(),
        user_id: userId,
        name: old.name || 'Habit',
        icon: old.icon || '⭐',
        color: old.color || '#3b82f6',
        order_index: old.order_index ?? i,
        is_two_step: old.is_two_step ?? false,
        created_at: old.created_at || now,
        updated_at: now,
        schema_version: 1,
      });
    }
    console.log('[Seed] Migration complete');
    return;
  }
  
  // Otherwise seed defaults
  const now = new Date().toISOString();
  
  for (const habit of DEFAULT_HABITS) {
    const id = crypto.randomUUID();
    await db.put('habits', {
      id,
      user_id: userId,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      order_index: habit.order_index,
      is_two_step: habit.is_two_step,
      created_at: now,
      updated_at: now,
      schema_version: 1,
    });
  }
  
  console.log('[Seed] Default habits added for user:', userId);
}
