import { chromium } from 'playwright';
import { join } from 'path';

const BASE = 'http://localhost:8901';
const DOCS = join(import.meta.dirname, 'docs');
const VP = { width: 1280, height: 800 };

async function screenshot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DOCS, name), fullPage: false });
  console.log(`✅ ${name}`);
}

const browser = await chromium.launch();

// --- DARK THEME ---
let ctx = await browser.newContext({ viewport: VP, colorScheme: 'dark' });
let page = await ctx.newPage();

// Dashboard (dark)
await page.goto(BASE);
await page.waitForLoadState('networkidle');
await screenshot(page, 'screenshot-dashboard-dark.png');

// Viewer - open MEMORY.md (dark)
// Click on MEMORY.md in file tree
await page.click('text=MEMORY.md');
await page.waitForTimeout(800);
await screenshot(page, 'screenshot-viewer-dark.png');

// Editor mode (dark) - click edit button
const editBtn = page.locator('button:has-text("Edit"), button[title*="edit"], button[title*="Edit"], [aria-label*="edit"], [aria-label*="Edit"]').first();
if (await editBtn.count() > 0) {
  await editBtn.click();
  await page.waitForTimeout(500);
  await screenshot(page, 'screenshot-editor-dark.png');
}

// Search panel (dark) - Ctrl+K
await page.keyboard.press('Control+k');
await page.waitForTimeout(500);
// Type something to show results
await page.keyboard.type('memory');
await page.waitForTimeout(800);
await screenshot(page, 'screenshot-search-dark.png');
await page.keyboard.press('Escape');

await ctx.close();

// --- LIGHT THEME ---
ctx = await browser.newContext({ viewport: VP, colorScheme: 'light' });
page = await ctx.newPage();

// Set light theme via localStorage before navigating
await page.addInitScript(() => {
  localStorage.setItem('theme', 'light');
});
await page.goto(BASE);
await page.waitForLoadState('networkidle');
// Also try setting it after load
await page.evaluate(() => {
  localStorage.setItem('theme', 'light');
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
});
await page.reload();
await page.waitForLoadState('networkidle');
await screenshot(page, 'screenshot-dashboard-light.png');

// Viewer light
await page.click('text=MEMORY.md');
await page.waitForTimeout(800);
await screenshot(page, 'screenshot-viewer-light.png');

await ctx.close();
await browser.close();
console.log('🎉 All screenshots done!');
