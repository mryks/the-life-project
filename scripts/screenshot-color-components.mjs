import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\1522af7b-3db3-4308-85e6-db9d762874b3';

async function main() {
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

    const targetUrl = process.argv[2] || 'https://the-life-project-os.vercel.app/finance';
    console.log(`Navigating to ${targetUrl} ...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Unlock session if lockscreen is shown
    await page.evaluate(() => {
      window.sessionStorage.setItem('thelife-session-unlocked', 'true');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      window.localStorage.setItem('thelife-device-trusted', dateStr);
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Navigate to Accounts tab
    console.log('Clicking Accounts tab...');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const accTab = tabs.find((b) => b.textContent && b.textContent.includes('Accounts'));
      if (accTab) accTab.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Click "+ Add Account" / "+ Custom Account" button
    console.log('Opening AccountModal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addAccBtn = buttons.find((b) => b.textContent && (b.textContent.includes('+ Add Account') || b.textContent.includes('Add Account') || b.textContent.includes('Custom Account')));
      if (addAccBtn) addAccBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Screenshot 1: AccountModal Top in Gradient Mode
    const shot1 = path.join(ARTIFACT_DIR, '1-account-modal-gradient-top.png');
    await page.screenshot({ path: shot1 });
    console.log(`Saved screenshot 1: ${shot1}`);

    // Scroll modal down to reveal color selector & color picker
    await page.evaluate(() => {
      const modal = document.querySelector('.overflow-y-auto');
      if (modal) modal.scrollTop = 320;
    });
    await new Promise((r) => setTimeout(r, 600));

    // Screenshot 2: Gradient Mode Controls (ColorSelector Presets + Stop Switcher + ColorPicker)
    const shot2 = path.join(ARTIFACT_DIR, '2-account-modal-gradient-picker.png');
    await page.screenshot({ path: shot2 });
    console.log(`Saved screenshot 2: ${shot2}`);

    // Switch to Solid Mode
    console.log('Switching to Solid Mode...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const solidBtn = buttons.find((b) => b.textContent && b.textContent.trim() === 'Solid');
      if (solidBtn) solidBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Screenshot 3: Solid Mode Controls (ColorSelector default colors + ColorPicker spectrum/hue/hex)
    const shot3 = path.join(ARTIFACT_DIR, '3-account-modal-solid-picker.png');
    await page.screenshot({ path: shot3 });
    console.log(`Saved screenshot 3: ${shot3}`);

    // Click a preset in ColorSelector (e.g. Violet or Rose)
    console.log('Selecting Violet preset in ColorSelector...');
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="radio"]'));
      const violet = inputs.find((i) => i.getAttribute('aria-label') === 'Violet');
      if (violet) {
        violet.click();
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    // Screenshot 4: Violet selected with animated selection ring
    const shot4 = path.join(ARTIFACT_DIR, '4-account-modal-solid-violet-selected.png');
    await page.screenshot({ path: shot4 });
    console.log(`Saved screenshot 4: ${shot4}`);

    console.log('All screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
