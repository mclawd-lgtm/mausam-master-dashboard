const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ddvrlkauzfpdomlveshy.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdnJsa2F1emZwZG9tbHZlc2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MzQ1ODMsImV4cCI6MjA4NjAxMDU4M30.U8_Zcsh1QXlda2n6a-gyinEfgoJDxZcq76dcjV6gXlM';

const supabase = createClient(supabaseUrl, supabaseKey);
const USER_ID = '895cd28a-37ea-443c-b7bb-eca88c857d05';

// The new data date range: Dec 28, 2024 to Oct 13, 2025
// We'll delete entries in this range to undo the migration
const START_DATE = '2024-12-28';
const END_DATE = '2025-10-13';

async function undoMigration() {
  console.log('🔄 Undoing migration...\n');

  // Get count before deletion
  const { count: beforeCount, error: countError } = await supabase
    .from('habit_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID);

  if (countError) {
    console.error('❌ Failed to get count:', countError.message);
    process.exit(1);
  }

  console.log(`📊 Current entries: ${beforeCount}`);
  console.log(`📅 Deleting entries from ${START_DATE} to ${END_DATE}...\n`);

  // Delete entries in the date range of the new data
  const { data, error, count } = await supabase
    .from('habit_entries')
    .delete({ count: 'exact' })
    .eq('user_id', USER_ID)
    .gte('date', START_DATE)
    .lte('date', END_DATE);

  if (error) {
    console.error('❌ Failed to delete entries:', error.message);
    process.exit(1);
  }

  console.log(`✅ Deleted ${count || 'unknown'} entries`);

  // Get count after deletion
  const { count: afterCount, error: afterError } = await supabase
    .from('habit_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID);

  if (!afterError) {
    console.log(`📊 Remaining entries: ${afterCount}`);
    console.log(`🗑️  Removed: ${beforeCount - afterCount} entries`);
  }

  // Log to activity
  const logEntry = `[${new Date().toLocaleTimeString('en-IN', {hour12:false, timeZone:'Asia/Kolkata'})}] 🔄 UNDO: Removed ${beforeCount - afterCount} migrated entries (${START_DATE} to ${END_DATE})`;
  const logPath = '/Users/mausamclawd/.openclaw/workspace/logs/watchtower_activity.log';
  
  try {
    fs.appendFileSync(logPath, logEntry + '\n');
    console.log(`\n📝 Activity logged`);
  } catch (e) {
    console.log('\n⚠️  Could not log activity');
  }

  console.log('\n✅ Migration undone! Your original data is restored.');
}

undoMigration().catch(err => {
  console.error('❌ Undo failed:', err);
  process.exit(1);
});
