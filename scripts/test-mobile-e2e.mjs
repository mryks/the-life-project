import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

export async function runTest(targetUrl = process.argv[2] || 'http://localhost:3005/finance') {
  console.log(`====================================================`);
  console.log(`Starting Comprehensive Mobile E2E verification on:`);
  console.log(`${targetUrl}`);
  console.log(`Device Emulation: iPhone 14 Pro (393x852, touch enabled)`);
  console.log(`====================================================`);

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
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Browser Console Error:', msg.text());
      }
    });

    page.on('pageerror', (err) => {
      console.error('Browser Page Error:', err.message);
    });

    console.log('1. Navigating to application...');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Check if lockscreen is shown
    const lockKeypad = await page.$('text/Enter Master PIN');
    if (lockKeypad) {
      console.log('   Master PIN lockscreen detected. Unlocking session...');
      await page.evaluate(() => {
        window.sessionStorage.setItem('thelife-session-unlocked', 'true');
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        window.localStorage.setItem('thelife-device-trusted', dateStr);
      });
      await page.reload({ waitUntil: 'networkidle2' });
    }

    await page.waitForSelector('header', { timeout: 10000 });
    console.log('   App header loaded successfully.');

    // Helper to get currently active tab name
    const getActiveTab = async () => {
      return page.evaluate(() => {
        const btn = document.querySelector('header button.text-white');
        return btn ? btn.textContent.trim() : 'unknown';
      });
    };

    console.log('   Initial Active Tab:', await getActiveTab());

    // 2. Switch to Activity Tab
    console.log('\n2. Switching to Activity tab...');
    const tabButtons = await page.$$('header button');
    let activityButton = null;
    for (const btn of tabButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Activity')) {
        activityButton = btn;
        break;
      }
    }

    if (!activityButton) {
      throw new Error('Activity tab button not found');
    }

    await activityButton.click();
    await new Promise((r) => setTimeout(r, 600));
    console.log('   Active Tab now:', await getActiveTab());

    // 3. Test Freeze Pane in Card View
    console.log('\n3. Testing Freeze Pane & Sticky Date Badges in Card View...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));

    // Scroll window down 450px
    await page.evaluate(() => window.scrollBy(0, 450));
    await new Promise((r) => setTimeout(r, 400));

    const cardViewFreezeMetrics = await page.evaluate(() => {
      const search = document.querySelector('input[placeholder*="Search"]');
      let cur = search;
      let freeze = null;
      while (cur && cur !== document.body) {
        if (window.getComputedStyle(cur).position === 'sticky') {
          freeze = cur;
          break;
        }
        cur = cur.parentElement;
      }
      if (!freeze) return { found: false };
      const fRect = freeze.getBoundingClientRect();

      // Check sticky date badges
      const dateHeaders = Array.from(document.querySelectorAll('div.sticky h3')).map((h3) => {
        const parent = h3.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : null;
        return {
          text: h3.textContent.trim(),
          top: rect ? Math.round(rect.top) : null,
          isPinnedToFreeze: rect ? Math.abs(rect.top - fRect.height) < 4 : false,
        };
      });

      return {
        found: true,
        scrollY: window.scrollY,
        freezeTop: Math.round(fRect.top),
        freezeHeight: Math.round(fRect.height),
        isFreezeStickyAtZero: Math.abs(fRect.top) < 1,
        dateHeaders: dateHeaders.slice(0, 4),
      };
    });

    console.log('   Card View Freeze Metrics:', cardViewFreezeMetrics);

    // 4. Switch to Table Ledger View
    console.log('\n4. Switching to Table Ledger View...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));

    const buttons = await page.$$('button');
    let tableBtn = null;
    for (const b of buttons) {
      const title = await page.evaluate((el) => el.getAttribute('title') || el.textContent, b);
      if (title && (title.includes('Table Ledger') || title.includes('Switch to Table'))) {
        tableBtn = b;
        break;
      }
    }
    if (!tableBtn) {
      throw new Error('Table view toggle button not found');
    }
    await tableBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    // 5. Test Table Ledger Default Scroll-to-Bottom & Freeze Pane
    console.log('\n5. Testing Table Ledger Default Scroll-to-Bottom & Header Row...');
    const initialLedgerScroll = await page.evaluate(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      return {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        maxScroll,
        isAutoScrolledToBottom: window.scrollY > 100,
      };
    });
    console.log('   Table Ledger Default Bottom Scroll:', initialLedgerScroll);

    const tableLedgerMetrics = await page.evaluate(() => {
      const search = document.querySelector('input[placeholder*="Search"]');
      let cur = search;
      let freeze = null;
      while (cur && cur !== document.body) {
        if (window.getComputedStyle(cur).position === 'sticky') {
          freeze = cur;
          break;
        }
        cur = cur.parentElement;
      }
      if (!freeze) return { found: false };
      const fRect = freeze.getBoundingClientRect();

      // Find table header row inside freeze pane
      const headerTable = freeze.querySelector('table');
      const headerCols = headerTable ? Array.from(headerTable.querySelectorAll('th')).map((th) => th.textContent.trim()) : [];

      // Find month separator row inside table body
      const monthRow = document.querySelector('tr.bg-slate-800');
      const monthText = monthRow ? monthRow.textContent.trim() : null;

      return {
        found: true,
        scrollY: window.scrollY,
        freezeTop: Math.round(fRect.top),
        freezeHeight: Math.round(fRect.height),
        isFreezeStickyAtZero: Math.abs(fRect.top) < 1,
        headerCols,
        monthSeparatorFound: Boolean(monthRow),
        monthSeparatorText: monthText,
      };
    });
    console.log('   Table Ledger Metrics:', tableLedgerMetrics);

    // Test Horizontal Scroll Synchronization
    console.log('\n   Testing Horizontal Scroll Sync between Body and Frozen Header...');
    const scrollSyncResult = await page.evaluate(() => {
      const bodyScrollDiv = document.querySelector('.overflow-x-auto.shadow-xs');
      const headerScrollDiv = document.querySelector('.overflow-x-auto.\\[scrollbar-width\\:none\\]');
      if (!bodyScrollDiv || !headerScrollDiv) {
        return { success: false, error: 'Scroll containers not found' };
      }

      // Scroll body horizontally by 120px
      bodyScrollDiv.scrollLeft = 120;
      bodyScrollDiv.dispatchEvent(new Event('scroll'));

      return {
        success: true,
        bodyScrollLeft: bodyScrollDiv.scrollLeft,
        headerScrollLeft: headerScrollDiv.scrollLeft,
        isSynchronized: Math.abs(bodyScrollDiv.scrollLeft - headerScrollDiv.scrollLeft) < 2,
      };
    });
    console.log('   Horizontal Scroll Sync Result:', scrollSyncResult);

    // 6. Test Touch Gestures & Ghost Touch Immunity
    console.log('\n6. Testing Touch Gestures & Ghost Touch Immunity...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));

    console.log('   Active Tab before gestures:', await getActiveTab());

    // A. Vertical Touch Drag (Should NOT trigger tab switch)
    console.log('   A. Simulating vertical touch drag (from y: 550 to y: 250)...');
    await page.touchscreen.touchStart(200, 550);
    await page.touchscreen.touchMove(200, 400);
    await page.touchscreen.touchMove(200, 250);
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 400));
    const tabAfterVertical = await getActiveTab();
    console.log('      Active Tab after vertical drag (MUST be Activity):', tabAfterVertical);

    // B. Rapid Taps (Ghost Touch Immunity)
    console.log('   B. Simulating 6 rapid taps...');
    for (let i = 0; i < 6; i++) {
      await page.touchscreen.tap(200, 350);
      await new Promise((r) => setTimeout(r, 40));
    }
    await new Promise((r) => setTimeout(r, 300));
    const tabAfterTaps = await getActiveTab();
    console.log('      Active Tab after rapid taps (MUST be Activity):', tabAfterTaps);

    // C. Horizontal Swipe on Table Ledger (Table Immunity - MUST NOT switch tabs)
    console.log('   C. Simulating horizontal swipe on Table Ledger (from x: 50 to x: 300, y: 400)...');
    await page.touchscreen.touchStart(50, 400);
    await page.touchscreen.touchMove(175, 400);
    await page.touchscreen.touchMove(300, 400);
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 400));
    const tabAfterTableSwipe = await getActiveTab();
    console.log('      Active Tab after swipe on table (MUST remain Activity):', tabAfterTableSwipe);

    // D. Switch back to Card View
    console.log('   D. Switching back to Card View for Card View gesture tests...');
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const buttons = Array.from(document.querySelectorAll('button'));
      const cardBtn = buttons.find((b) => b.textContent && b.textContent.includes('Card View'));
      if (cardBtn) cardBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const elementAtTouch = await page.evaluate(() => {
      const el = document.elementFromPoint(100, 600);
      return {
        scrollY: window.scrollY,
        tagName: el ? el.tagName : null,
        className: el ? el.className : null,
        closestButton: Boolean(el && el.closest('button')),
        closestTable: Boolean(el && el.closest('table')),
        closestNoSwipe: Boolean(el && el.closest('[data-no-swipe="true"]')),
      };
    });
    console.log('   Element at Touch Point (100, 600):', elementAtTouch);

    // E. Horizontal Swipe Right in Card View (MUST cleanly switch to Accounts)
    console.log('   E. Simulating horizontal swipe right in Card View (from x: 100 to x: 320, y: 600)...');
    await page.touchscreen.touchStart(100, 600);
    await page.touchscreen.touchMove(200, 600);
    await page.touchscreen.touchMove(320, 600);
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 600));
    const tabAfterCardSwipeRight = await getActiveTab();
    console.log('      Active Tab after swipe right in Card View (SHOULD be Accounts):', tabAfterCardSwipeRight);

    // Capture screenshot for visual proof
    const screenshotPath = path.join(__dirname, '..', 'scratch', 'mobile-test-verified.png');
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath });
    console.log(`\n   Saved screenshot to: ${screenshotPath}`);

    const allPassed =
      cardViewFreezeMetrics.isFreezeStickyAtZero &&
      initialLedgerScroll.isAutoScrolledToBottom &&
      tableLedgerMetrics.isFreezeStickyAtZero &&
      scrollSyncResult.isSynchronized &&
      tabAfterVertical.includes('Activity') &&
      tabAfterTaps.includes('Activity') &&
      tabAfterTableSwipe.includes('Activity') &&
      tabAfterCardSwipeRight.includes('Accounts');

    console.log('\n====================================================');
    console.log(`E2E VERIFICATION STATUS: ${allPassed ? 'ALL PASSED (100% SUCCESS)' : 'FAILED'}`);
    console.log('====================================================');

    if (!allPassed) {
      throw new Error('One or more E2E verification assertions failed');
    }

    return {
      cardViewFreezeMetrics,
      tableLedgerMetrics,
      scrollSyncResult,
      tabAfterVertical,
      tabAfterTaps,
      tabAfterTableSwipe,
      tabAfterCardSwipeRight,
    };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTest().catch((err) => {
    console.error('E2E Test Failed:', err);
    process.exit(1);
  });
}
