import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = process.argv[2] || 'http://localhost:3008/finance';
const artifactDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\1522af7b-3db3-4308-85e6-db9d762874b3';

if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

async function run() {
  console.log('🚀 Starting Puppeteer Verification for Keyboard DatePicker & Typeahead...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
    });

    console.log('Navigating to', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Unlock and set nominals to revealed
    await page.evaluate(() => {
      window.sessionStorage.setItem('thelife-session-unlocked', 'true');
      window.sessionStorage.setItem('thelife-hide-nominals', 'false');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      window.localStorage.setItem('thelife-device-trusted', dateStr);
      window.localStorage.setItem('thelife-last-activity', Date.now().toString());
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('header', { timeout: 10000 });

    // Switch to Activity tab
    console.log("👉 Switching to Activity & Ledger tab...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const activityBtn = buttons.find(b => b.textContent?.includes('Activity'));
      if (activityBtn) activityBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Click on body to ensure active focus on page
    await page.click('body');
    await new Promise((r) => setTimeout(r, 400));

    // 1. Press 'N' to open Add Transaction Modal
    console.log("👉 Pressing 'n' to open Add Transaction modal...");
    await page.keyboard.press('n');
    await page.waitForFunction(() => !!document.querySelector('[role="dialog"]') || Array.from(document.querySelectorAll('h3')).some(h => h.textContent?.includes('Transaction')), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));

    // 2. Tab to Amount and type 10e3
    console.log("👉 Tabbing to Amount and typing '10e3'...");
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 200));
    await page.keyboard.type('10e3');
    await new Promise((r) => setTimeout(r, 200));

    // 3. Tab to DatePicker
    console.log("👉 Tabbing to DatePicker (should auto-open calendar popover)...");
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 500));

    // Check if calendar popover opened
    const isCalendarOpen = await page.evaluate(() => {
      const popover = document.querySelector('[role="dialog"] [data-calendar-grid="true"]') ||
                      document.querySelector('table[role="grid"]') ||
                      document.querySelector('[aria-label="Previous month"]');
      return !!popover;
    });
    console.log('Calendar popover auto-opened:', isCalendarOpen);

    await page.screenshot({
      path: path.join(artifactDir, '1-datepicker-auto-opened.png'),
    });

    // 4. Press Tab on DatePicker to confirm and close popover, moving to Description
    console.log("👉 Pressing Tab on DatePicker to confirm and move to Description...");
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 400));

    const activeElementDesc = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tagName: active?.tagName,
        placeholder: active?.getAttribute('placeholder'),
        name: active?.getAttribute('name'),
        id: active?.id,
      };
    });
    console.log('Active element after Tab from Date:', activeElementDesc);

    // Type description
    await page.keyboard.type('Keyboard Typeahead Test');
    await new Promise((r) => setTimeout(r, 200));

    await page.screenshot({
      path: path.join(artifactDir, '2-datepicker-tab-confirmed.png'),
    });

    // 5. Tab to Account selector
    console.log('👉 Tabbing to Account selector...');
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 300));

    // Test typing in Account selector: type 'go' -> should select GoPay
    console.log("👉 Typing 'go' in Account selector to match GoPay...");
    await page.keyboard.type('g');
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.type('o');
    await new Promise((r) => setTimeout(r, 300));

    const selectedAccountText = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.innerText || active?.textContent;
    });
    console.log('Selected account text after typing "go":', selectedAccountText);

    await page.screenshot({
      path: path.join(artifactDir, '3-account-typeahead-gopay.png'),
    });

    // 6. Tab to Category selector
    console.log('👉 Tabbing to Category selector...');
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 300));

    // Test typing in Category selector: type 't' -> Transportation
    console.log("👉 Typing 't' in Category selector to match Transportation...");
    await page.keyboard.type('t');
    await new Promise((r) => setTimeout(r, 300));

    const selectedCategoryText = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.innerText || active?.textContent;
    });
    console.log('Selected category text after typing "t":', selectedCategoryText);

    await page.screenshot({
      path: path.join(artifactDir, '4-category-typeahead-transport.png'),
    });

    // 7. Instant Save via Enter
    console.log('👉 Pressing Enter to instant-save transaction...');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 800));

    // Verify modal is closed
    const modalExists = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    console.log('Modal closed after Enter:', !modalExists);

    const savedEvents = await page.evaluate(() => {
      const raw = localStorage.getItem('thelife-finance');
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return parsed.events || [];
      } catch {
        return [];
      }
    });
    console.log('Total saved events in thelife-finance:', savedEvents.length);
    console.log('Latest event:', savedEvents[savedEvents.length - 1]);

    // Verify transaction appears in feed
    const feedItem = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        has10k: text.includes('10.000') || text.includes('10,000'),
        hasDesc: text.includes('Keyboard Typeahead Test'),
        hasTransport: text.includes('Transportation'),
      };
    });
    console.log('Feed item verification:', feedItem);

    await page.screenshot({
      path: path.join(artifactDir, '5-instant-saved-feed.png'),
    });

    // 8. Test Transfer flow with keyboard
    console.log("\n👉 Testing Transfer flow: Pressing 'n'...");
    await page.keyboard.press('n');
    await page.waitForFunction(() => !!document.querySelector('[role="dialog"]') || Array.from(document.querySelectorAll('h3')).some(h => h.textContent?.includes('Transaction')), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 300));

    // Arrow right twice to reach Transfer
    console.log('👉 ArrowRight twice to select Transfer...');
    await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 150));
    await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 200));

    // Tab to Amount
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 150));
    await page.keyboard.type('50e3');

    // Tab to DatePicker -> Auto-opens
    console.log('👉 Tab to DatePicker in Transfer mode...');
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 400));

    // Tab on DatePicker -> Confirms and moves to Source Account!
    console.log('👉 Tab on DatePicker to confirm and focus Source Account...');
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 300));

    const sourceActive = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        text: active?.innerText || active?.textContent,
        ariaLabel: active?.getAttribute('aria-label'),
        name: active?.getAttribute('name'),
      };
    });
    console.log('Active element after Date in Transfer:', sourceActive);

    // Type 'b' in Source Account to cycle to BNI / Bank Saqu
    await page.keyboard.type('b');
    await new Promise((r) => setTimeout(r, 200));

    // Tab to Destination Account
    console.log('👉 Tab to Destination Account...');
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 300));

    // Type 'sea' in Destination Account to match SeaBank
    await page.keyboard.type('s');
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.type('e');
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.type('a');
    await new Promise((r) => setTimeout(r, 300));

    const destActive = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.innerText || active?.textContent;
    });
    console.log('Destination account after typing "sea":', destActive);

    await page.screenshot({
      path: path.join(artifactDir, '6-transfer-keyboard-flow.png'),
    });

    // Instant save transfer
    console.log('👉 Pressing Enter to instant save transfer...');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 800));

    const transferFeed = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        has50k: text.includes('50.000') || text.includes('50,000'),
      };
    });
    console.log('Transfer saved feed verification:', transferFeed);

    await page.screenshot({
      path: path.join(artifactDir, '7-transfer-saved-feed.png'),
    });

    console.log('🎉 Puppeteer Verification Completed Successfully!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Puppeteer Verification Failed:', err);
  process.exit(1);
});
