// Migration script: Import old habit data to Mausam Master Dashboard
// Run with: node scripts/migrate-old-data.js

const { createClient } = require('@supabase/supabase-js');

// Supabase config
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ddvrlkauzfpdomlveshy.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdnJsa2F1emZwZG9tbHZlc2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MzQ1ODMsImV4cCI6MjA4NjAxMDU4M30.U8_Zcsh1QXlda2n6a-gyinEfgoJDxZcq76dcjV6gXlM';

const supabase = createClient(supabaseUrl, supabaseKey);
const USER_ID = '895cd28a-37ea-443c-b7bb-eca88c857d05';

// Color mapping from old app to hex
const colorMap = {
  'teal': '#14b8a6',
  'stone': '#78716c',
  'red': '#ef4444',
  'violet': '#8b5cf6',
  'fuchsia': '#d946ef',
  'lime': '#84cc16',
  'slate': '#64748b',
  'sky': '#0ea5e9',
  'yellow': '#eab308',
  'orange': '#f97316',
  'blue': '#3b82f6',
  'green': '#22c55e',
  'purple': '#a855f7',
  'pink': '#ec4899',
  'gray': '#6b7280',
  'black': '#000000',
  'white': '#ffffff'
};

// Default emoji mapping for habits
const defaultEmojis = {
  'Fasting': '🍽️',
  '5 Ltr Water': '💧',
  'No Eat Outside': '🏠',
  'Running': '🏃',
  'Exercise': '💪',
  'Protine': '🥩',
  'Meditation': '🧘',
  'Vitamins 2 Times': '💊',
  'Reading': '📖',
  '2 Brush': '🪥',
  'Travel': '✈️',
  'No Fap': '🚫',
  '🦋': '🦋'
};

// Load the old data
const oldData = require('../data/old-habits-export.json');

async function migrate() {
  console.log('🚀 Starting migration...\n');

  // 1. Clear existing data (optional - comment out if you want to keep current data)
  console.log('1️⃣ Clearing existing data...');
  await supabase.from('habit_entries').delete().eq('user_id', USER_ID);
  await supabase.from('habits').delete().eq('user_id', USER_ID);
  console.log('   ✅ Cleared existing data\n');

  // 2. Migrate habits
  console.log('2️⃣ Migrating habits...');
  const habitIdMap = {}; // Map old IDs to new IDs

  for (const oldHabit of oldData.habits) {
    // Skip archived habits
    if (oldHabit.archived) {
      console.log(`   ⏭️  Skipping archived: ${oldHabit.name}`);
      continue;
    }

    const newHabit = {
      id: oldHabit.id, // Keep same ID for easier mapping
      user_id: USER_ID,
      name: oldHabit.name,
      icon: defaultEmojis[oldHabit.name] || oldHabit.emoji || '✓',
      color: colorMap[oldHabit.color] || '#3b82f6',
      order_index: oldHabit.orderIndex,
      is_two_step: oldHabit.name === 'Vitamins 2 Times' || oldHabit.name === '2 Brush',
      created_at: oldHabit.createdAt,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('habits').insert(newHabit);
    if (error) {
      console.error(`   ❌ Error inserting ${oldHabit.name}:`, error.message);
    } else {
      console.log(`   ✅ ${oldHabit.name}`);
      habitIdMap[oldHabit.id] = newHabit.id;
    }
  }
  console.log('');

  // 3. Migrate completions
  console.log('3️⃣ Migrating completions...');
  let entryCount = 0;
  let skippedCount = 0;

  // Group completions by habit and date to avoid duplicates
  const completionMap = new Map();

  for (const completion of oldData.completions) {
    const habitId = completion.habitId;
    const date = completion.date.split('T')[0]; // Get just the date part
    const key = `${habitId}:${date}`;

    // For habits with amountOfCompletions > 1 (like fasting hours)
    const isFasting = oldData.habits.find(h => h.id === habitId)?.name === 'Fasting';
    
    if (!completionMap.has(key)) {
      completionMap.set(key, {
        id: `${USER_ID}:${habitId}:${date}`,
        user_id: USER_ID,
        habit_id: habitId,
        date: date,
        value: isFasting ? 1 : (completion.amountOfCompletions > 0 ? 1 : 0),
        fasting_hours: isFasting ? completion.amountOfCompletions : null,
        note: completion.note,
        updated_at: completion.date
      });
      entryCount++;
    }
  }

  // Insert in batches
  const entries = Array.from(completionMap.values());
  const batchSize = 50;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const { error } = await supabase.from('habit_entries').insert(batch);
    
    if (error) {
      console.error(`   ❌ Error inserting batch ${i/batchSize + 1}:`, error.message);
    } else {
      console.log(`   ✅ Batch ${i/batchSize + 1}: ${batch.length} entries`);
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Habits migrated: ${Object.keys(habitIdMap).length}`);
  console.log(`   Entries migrated: ${entryCount}`);
  console.log(`\n🎉 Migration complete!`);
}

migrate().catch(console.error);
