import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = process.argv[2] || 'http://localhost:3005/finance';
const outDir = path.resolve(__dirname, '../scratch/ui-inspect');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 393,
      height: 852,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    console.log('Navigating to', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Unlock and set nominals to revealed for clear visual inspection
    await page.evaluate(() => {
      window.sessionStorage.setItem('thelife-session-unlocked', 'true');
      window.sessionStorage.setItem('thelife-hide-nominals', 'false');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      window.localStorage.setItem('thelife-device-trusted', dateStr);

      // Inject clean test expense if needed
      const testEvents = [
        {
          id: 'exp-shoes-test',
          date: dateStr,
          description: 'Sepatu Running Nike',
          amount: 500000,
          type: 'expense',
          category: 'Personal Care',
          accountId: 'b',
        }
      ];
      window.localStorage.setItem('thelife-finance', JSON.stringify({
        version: 2,
        events: testEvents
      }));
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('header', { timeout: 10000 });

    // Switch to Activity tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button, [class*="rounded-2xl"] button'));
      const activityBtn = buttons.find(b => b.textContent?.includes('Activity'));
      if (activityBtn) activityBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Find and click on the expense card (not the refund card) to open Action Menu
    await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('[class*="rounded-2xl"]')).find(c => {
        const text = c.textContent || '';
        return text.includes('Sepatu Running Nike') && !text.includes('Refund:');
      });
      if (card) {
        card.click();
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    // Click "Record Refund" button in Action Menu
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const refundBtn = buttons.find(b => b.textContent?.includes('Record Refund'));
      if (refundBtn) refundBtn.click();
    });
    await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));

    // Type excess refund amount: Rp 650.000 for Rp 500.000 expense
    await page.evaluate(() => {
      const input = document.querySelector('form input[inputmode="numeric"]');
      if (input) {
        // Clear and type 650000
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, "650000");
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // Select BNI account ('b')
      const accButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.includes('BNI'));
      if (accButtons[0]) accButtons[0].click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 1. Capture Refund Modal with excess profit helper
    await page.screenshot({ path: path.join(outDir, '1-refund-modal-excess.png') });
    console.log('Saved 1-refund-modal-excess.png');

    // Click "Save Refund"
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(b => b.textContent?.includes('Save Refund'));
      if (saveBtn) saveBtn.click();
    });
    await page.waitForFunction(() => !document.querySelector('form input[inputmode="numeric"]'), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 800));

    // Switch back to Activity tab if needed
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button, [class*="rounded-2xl"] button'));
      const activityBtn = buttons.find(b => b.textContent?.includes('Activity'));
      if (activityBtn) activityBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 2. Capture Card View with refund and parent expense badges
    await page.screenshot({ path: path.join(outDir, '2-card-view-refund-profit.png') });
    console.log('Saved 2-card-view-refund-profit.png');

    // Switch to Table Ledger View
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const ledgerToggle = buttons.find(b => b.textContent?.trim() === 'Table Ledger');
      if (ledgerToggle) ledgerToggle.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 3. Capture Table Ledger with refund row and category
    await page.screenshot({ path: path.join(outDir, '3-table-ledger-refund-profit.png') });
    console.log('Saved 3-table-ledger-refund-profit.png');

    console.log('Visual Inspection screenshots captured successfully.');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
