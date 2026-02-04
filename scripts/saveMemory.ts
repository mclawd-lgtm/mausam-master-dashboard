import { memoryService } from '../services/memory';

// Script to save end-of-day memory
// Run: npx tsx scripts/saveMemory.ts "Your memory summary here"

const summary = process.argv[2];

if (!summary) {
  console.log('Usage: npx tsx scripts/saveMemory.ts "Your memory text here"');
  process.exit(1);
}

memoryService.saveDailySummary(summary)
  .then(result => {
    if (result.success) {
      console.log('✅ Memory saved successfully!');
    } else {
      console.log('❌ Failed to save memory');
    }
  })
  .catch(err => console.error('Error:', err));