import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = process.argv[2] || 'http://localhost:3007/finance';
const artifactDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\1522af7b-3db3-4308-85e6-db9d762874b3';

if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
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

    // Unlock and set nominals to revealed
    await page.evaluate(() => {
      window.sessionStorage.setItem('thelife-session-unlocked', 'true');
      window.sessionStorage.setItem('thelife-hide-nominals', 'false');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      window.localStorage.setItem('thelife-device-trusted', dateStr);
      window.localStorage.removeItem('thelife-custom-accounts');
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('header', { timeout: 10000 });

    // 1. Switch to Accounts Tab
    console.log('Switching to Accounts tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button, [class*="rounded-2xl"] button'));
      const accountsBtn = buttons.find(b => b.textContent?.includes('Accounts'));
      if (accountsBtn) accountsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const shot1 = path.join(artifactDir, '1-accounts-tab-overview.png');
    await page.screenshot({ path: shot1 });
    console.log('Saved 1-accounts-tab-overview.png');

    // 2. Click "+ Add Account" button
    console.log('Opening Add Account modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addAccBtn = buttons.find(b => b.textContent?.includes('Add Account'));
      if (addAccBtn) addAccBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Type Account Full Name
    const nameInput = await page.$('input[placeholder*="Bank Central Asia"]');
    if (nameInput) {
      await nameInput.type('Bank Syariah Indonesia');
    }
    await new Promise((r) => setTimeout(r, 400));

    const shot2 = path.join(artifactDir, '2-add-account-modal-solid.png');
    await page.screenshot({ path: shot2 });
    console.log('Saved 2-add-account-modal-solid.png');

    // 3. Switch to Gradient mode
    console.log('Switching to Gradient mode...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const gradientBtn = buttons.find(b => b.textContent?.includes('Gradient'));
      if (gradientBtn) gradientBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Fill opening balance: 1500000
    const balInput = await page.$('input[placeholder="0"]');
    if (balInput) {
      await balInput.type('1500000');
    }
    await new Promise((r) => setTimeout(r, 400));

    const shot3 = path.join(artifactDir, '3-add-account-modal-gradient.png');
    await page.screenshot({ path: shot3 });
    console.log('Saved 3-add-account-modal-gradient.png');

    // 4. Click "Create Account"
    console.log('Submitting Create Account...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const createBtn = buttons.find(b => b.textContent?.includes('Create Account'));
      if (createBtn) createBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const shot4 = path.join(artifactDir, '4-accounts-tab-with-custom.png');
    await page.screenshot({ path: shot4 });
    console.log('Saved 4-accounts-tab-with-custom.png');

    // 4b. Scroll down to show Bank Syariah Indonesia card
    await page.evaluate(() => window.scrollBy(0, 360));
    await new Promise((r) => setTimeout(r, 400));
    const shot4b = path.join(artifactDir, '4b-custom-account-scrolled.png');
    await page.screenshot({ path: shot4b });
    console.log('Saved 4b-custom-account-scrolled.png');

    // 5. Open Add Transaction modal to inspect custom account badge
    console.log('Opening Add Transaction modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button, button[aria-label="Add Transaction"]'));
      const addTxBtn = buttons.find(b => b.textContent?.includes('Add') || b.getAttribute('aria-label') === 'Add Transaction');
      if (addTxBtn) addTxBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Scroll account grid in modal to bottom to show new account
    await page.evaluate(() => {
      const grids = document.querySelectorAll('.grid');
      for (const g of grids) {
        if (g.classList.contains('max-h-44')) {
          g.scrollTop = g.scrollHeight;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 300));

    const shot5 = path.join(artifactDir, '5-transaction-form-custom-account.png');
    await page.screenshot({ path: shot5 });
    console.log('Saved 5-transaction-form-custom-account.png');

    console.log('All visual inspection screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
