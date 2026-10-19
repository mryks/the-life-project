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

    // Unlock
    await page.evaluate(() => {
      window.sessionStorage.setItem('thelife-session-unlocked', 'true');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      window.localStorage.setItem('thelife-device-trusted', dateStr);
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('header', { timeout: 10000 });

    // Go to Activity tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button, [class*="rounded-2xl"] button'));
      const activityBtn = buttons.find(b => b.textContent?.includes('Activity'));
      if (activityBtn) activityBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 1. Card view at top
    await page.screenshot({ path: path.join(outDir, '1-card-top.png') });
    console.log('Saved 1-card-top.png');

    // 2. Scroll window down 350px (showing top controls scrolling off cleanly)
    await page.evaluate(() => {
      window.scrollTo(0, 350);
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(outDir, '2-card-scrolled-350.png') });
    console.log('Saved 2-card-scrolled-350.png');

    // 3. Scroll window down 750px (showing date headers in natural flow & floating Top button)
    await page.evaluate(() => {
      window.scrollTo(0, 750);
      window.dispatchEvent(new Event('scroll'));
    });
    await new Promise((r) => setTimeout(r, 400));
    const btnExists = await page.evaluate(() => {
      const topBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Top'));
      return {
        scrollY: window.scrollY,
        topBtnFound: Boolean(topBtn),
        topBtnRect: topBtn ? topBtn.getBoundingClientRect() : null
      };
    });
    console.log('Top button status at scrollY 750:', btnExists);
    await page.screenshot({ path: path.join(outDir, '3-card-scrolled-750.png') });
    console.log('Saved 3-card-scrolled-750.png');

    // 4. Click Top button to verify smooth return to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 400));

    // 5. Switch to Table Ledger
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const ledgerBtn = buttons.find(b => b.textContent?.includes('Table Ledger'));
      if (ledgerBtn) ledgerBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Check table scroll metrics
    const tableMetrics = await page.evaluate(() => {
      const tableDiv = document.querySelector('tbody')?.closest('div');
      return {
        windowScrollY: window.scrollY,
        tableScrollTop: tableDiv ? tableDiv.scrollTop : 0,
        tableScrollHeight: tableDiv ? tableDiv.scrollHeight : 0,
        tableClientHeight: tableDiv ? tableDiv.clientHeight : 0,
      };
    });
    console.log('Table Ledger Metrics:', tableMetrics);
    await page.screenshot({ path: path.join(outDir, '4-table-ledger.png') });
    console.log('Saved 4-table-ledger.png');

    // 6. Scroll window down 250px in Table Ledger to verify natural scroll
    await page.evaluate(() => {
      window.scrollTo(0, 250);
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(outDir, '5-table-ledger-scrolled.png') });
    console.log('Saved 5-table-ledger-scrolled.png');

  } finally {
    await browser.close();
  }
}

run().catch(console.error);
