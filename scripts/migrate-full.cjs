const fs = require('fs');
const path = require('path');

// Read the original data from the media file
const dataPath = path.join(__dirname, '../data/old-habits-full.json');

// If file doesn't exist, create it from what we have
if (!fs.existsSync(dataPath)) {
  console.log('Please save the full JSON data to: data/old-habits-full.json');
  process.exit(1);
}

const oldData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ddvrlkauzfpdomlveshy.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdnJsa2F1emZwZG9tbHZlc2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MzQ1ODMsImV4cCI6MjA4NjAxMDU4M30.U8_Zcsh1QXlda2n6a-gyinEfgoJDxZcq76dcjV6gXlM';

const supabase = createClient(supabaseUrl, supabaseKey);
const USER_ID = '895cd28a-37ea-443c-b7bb-eca88c857d05';

const colorMap = {
  'teal': '#14b8a6', 'stone': '#78716c', 'red': '#ef4444', 'violet': '#8b5cf6',
  'fuchsia': '#d946ef', 'lime': '#84cc16', 'slate': '#64748b', 'sky': '#0ea5e9',
  'yellow': '#eab308', 'orange': '#f97316', 'blue': '#3b82f6', 'green': '#22c55e',
  'purple': '#a855f7', 'pink': '#ec4899', 'gray': '#6b7280'
};

const defaultEmojis = {
  'Fasting': '🍽️', '5 Ltr Water': '💧', 'No Eat Outside': '🏠', 'Running': '🏃',
  'Exercise': '💪', 'Protine': '🥩', 'Meditation': '🧘', 'Vitamins 2 Times': '💊',
  'Reading': '📖', '2 Brush': '🪥', 'Travel': '✈️', 'No Fap': '🚫', '🦋': '🦋'
};

async function migrate() {
  console.log('🚀 Starting migration...\n');

  console.log('1️⃣ Clearing existing data...');
  await supabase.from('habit_entries').delete().eq('user_id', USER_ID);
  await supabase.from('habits').delete().eq('user_id', USER_ID);
  console.log('   ✅ Cleared existing data\n');

  console.log('2️⃣ Migrating habits...');
  for (const oldHabit of oldData.habits) {
    if (oldHabit.archived) continue;

    const newHabit = {
      id: oldHabit.id,
      user_id: USER_ID,
      name: oldHabit.name,
      icon: defaultEmojis[oldHabit.name] || '✓',
      color: colorMap[oldHabit.color] || '#3b82f6',
      order_index: oldHabit.orderIndex,
      is_two_step: oldHabit.name === 'Vitamins 2 Times' || oldHabit.name === '2 Brush',
      created_at: oldHabit.createdAt,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('habits').insert(newHabit);
    if (error) console.error(`   ❌ ${oldHabit.name}:`, error.message);
    else console.log(`   ✅ ${oldHabit.name}`);
  }
  console.log('');

  console.log('3️⃣ Migrating completions...');
  const completionMap = new Map();

  for (const completion of oldData.completions) {
    const habitId = completion.habitId;
    const date = completion.date.split('T')[0];
    const key = `${habitId}:${date}`;
    const isFasting = oldData.habits.find(h => h.id === habitId)?.name === 'Fasting';
    
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
  }

  const entries = Array.from(completionMap.values());
  const batchSize = 50;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const { error } = await supabase.from('habit_entries').insert(batch);
    if (error) console.error(`   ❌ Batch ${i/batchSize + 1}:`, error.message);
    else console.log(`   ✅ Batch ${i/batchSize + 1}: ${batch.length} entries`);
  }

  console.log(`\n📊 Summary: ${oldData.habits.filter(h => !h.archived).length} habits, ${entries.length} entries`);
}

migrate().catch(console.error);
