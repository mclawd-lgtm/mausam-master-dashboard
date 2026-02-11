const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ddvrlkauzfpdomlveshy.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdnJsa2F1emZwZG9tbHZlc2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MzQ1ODMsImV4cCI6MjA4NjAxMDU4M30.U8_Zcsh1QXlda2n6a-gyinEfgoJDxZcq76dcjV6gXlM';

const supabase = createClient(supabaseUrl, supabaseKey);
const USER_ID = '895cd28a-37ea-443c-b7bb-eca88c857d05';

// Read new data from the media file path
const newDataPath = '/Users/mausamclawd/.openclaw/media/inbound/file_12---38b229f2-624f-46c3-9be7-79206d29cdf6.json';
const newData = JSON.parse(fs.readFileSync(newDataPath, 'utf8'));

// Name mapping: new data name → our existing habit name
const nameMapping = {
  'Fasting': 'Fasting',
  'Exercise': 'Exercise',
  'Running': 'Running',
  'Reading': 'Reading',
  '2 time Vitamins': 'Vitamins 2 Times',
  'No eat outside': 'No Eat Outside',
  '5 Ltr water': '5 Ltr Water',
  '2 Brush': '2 Brush',
  'No fap': 'No Fap',
  'Travel': 'Travel',
  '🦋 butterfly': '🦋',
  'Meditations': 'Meditation'
};

async function migrate() {
  console.log('🚀 Starting data migration...\n');

  // 1. Get existing habits from Supabase
  console.log('1️⃣ Fetching existing habits from Supabase...');
  const { data: existingHabits, error: habitsError } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', USER_ID);

  if (habitsError) {
    console.error('❌ Failed to fetch habits:', habitsError.message);
    process.exit(1);
  }

  console.log(`   ✅ Found ${existingHabits.length} existing habits`);

  // Create name → habit ID map
  const nameToHabitMap = {};
  for (const habit of existingHabits) {
    nameToHabitMap[habit.name] = habit;
  }

  // Show mapping
  console.log('\n   Habit mapping:');
  for (const [newName, existingName] of Object.entries(nameMapping)) {
    const habit = nameToHabitMap[existingName];
    if (habit) {
      console.log(`   • "${newName}" → "${existingName}" (${habit.id.slice(0,8)}...)`);
    } else {
      console.log(`   ⚠️ "${existingName}" NOT FOUND in database!`);
    }
  }

  // 2. Get existing entries to avoid duplicates
  console.log('\n2️⃣ Fetching existing entries to avoid duplicates...');
  const { data: existingEntries, error: entriesError } = await supabase
    .from('habit_entries')
    .select('habit_id, date')
    .eq('user_id', USER_ID);

  if (entriesError) {
    console.error('❌ Failed to fetch entries:', entriesError.message);
    process.exit(1);
  }

  const existingEntryKeys = new Set(
    existingEntries.map(e => `${e.habit_id}:${e.date}`)
  );
  console.log(`   ✅ Found ${existingEntries.length} existing entries`);

  // 3. Map new completions to existing habits
  console.log('\n3️⃣ Mapping new completions to existing habits...');
  const newEntries = [];
  let skippedCount = 0;
  let duplicateCount = 0;

  for (const completion of newData.completions) {
    // Find the habit in new data
    const newHabit = newData.habits.find(h => h.id === completion.habitId);
    if (!newHabit) {
      skippedCount++;
      continue;
    }

    // Map to existing habit name
    const existingName = nameMapping[newHabit.name];
    if (!existingName) {
      skippedCount++;
      continue;
    }

    // Get existing habit
    const existingHabit = nameToHabitMap[existingName];
    if (!existingHabit) {
      skippedCount++;
      continue;
    }

    const date = completion.date.split('T')[0];
    const entryKey = `${existingHabit.id}:${date}`;

    // Skip if already exists
    if (existingEntryKeys.has(entryKey)) {
      duplicateCount++;
      continue;
    }

    const isFasting = existingName === 'Fasting';
    const isTwoStep = existingHabit.is_two_step;

    newEntries.push({
      id: `${USER_ID}:${existingHabit.id}:${date}`,
      user_id: USER_ID,
      habit_id: existingHabit.id,
      date: date,
      value: isTwoStep ? completion.amountOfCompletions : (completion.amountOfCompletions > 0 ? 1 : 0),
      fasting_hours: isFasting ? completion.amountOfCompletions : null,
      note: completion.note,
      updated_at: completion.date
    });
  }

  console.log(`   📊 ${newEntries.length} new entries to add`);
  console.log(`   ⏭️  ${skippedCount} skipped (no matching habit)`);
  console.log(`   🔄 ${duplicateCount} duplicates skipped`);

  if (newEntries.length === 0) {
    console.log('\n✅ No new entries to add!');
    return;
  }

  // 4. Insert new entries in batches
  console.log('\n4️⃣ Inserting new entries...');
  const batchSize = 50;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < newEntries.length; i += batchSize) {
    const batch = newEntries.slice(i, i + batchSize);
    const { error } = await supabase.from('habit_entries').insert(batch);
    
    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
      errorCount += batch.length;
    } else {
      console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: ${batch.length} entries`);
      successCount += batch.length;
    }
  }

  // 5. Summary
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Successfully added: ${successCount} entries`);
  if (errorCount > 0) console.log(`   ❌ Failed: ${errorCount} entries`);
  console.log(`   ⏭️  Duplicates skipped: ${duplicateCount}`);
  console.log(`   📅 Date range in new data: ${newData.completions[0].date.split('T')[0]} to ${newData.completions[newData.completions.length-1].date.split('T')[0]}`);

  // Log to activity log
  const logEntry = `[${new Date().toLocaleTimeString('en-IN', {hour12:false, timeZone:'Asia/Kolkata'})}] ✅ Migrated ${successCount} habit entries from JSON file (Dec 2024 - Oct 2025)`;
  const logPath = '/Users/mausamclawd/.openclaw/workspace/logs/watchtower_activity.log';
  fs.appendFileSync(logPath, logEntry + '\n');
  console.log(`\n📝 Activity logged to watchtower_activity.log`);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
