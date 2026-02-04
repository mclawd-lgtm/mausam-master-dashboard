import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Ensure screenshots directory exists
const screenshotsDir = join(process.cwd(), 'screenshots');
if (!existsSync(screenshotsDir)) {
  mkdirSync(screenshotsDir, { recursive: true });
}

test('capture morning dashboard screenshot', async ({ page }) => {
  // Navigate to morning view
  await page.goto('/morning');
  
  // Wait for content to load
  await page.waitForLoadState('networkidle');
  
  // Wait for Whoop data to load
  await page.waitForTimeout(500);
  
  // Set viewport to 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  
  // Take screenshot
  await page.screenshot({
    path: join(screenshotsDir, 'today.png'),
    fullPage: false
  });
  
  console.log('Screenshot saved to ./screenshots/today.png');
});