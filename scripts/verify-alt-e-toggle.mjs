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
  console.log('🚀 Starting Puppeteer Verification for Alt+E Show/Hide Nominals shortcut...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Navigating to', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Unlock session, but keep nominals at default masked ('true')
    await page.evaluate(() => {
      window.sessionStorage.setItem('thelife-session-unlocked', 'true');
      window.sessionStorage.setItem('thelife-hide-nominals', 'true');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      window.localStorage.setItem('thelife-device-trusted', dateStr);
      window.localStorage.setItem('thelife-last-activity', Date.now().toString());
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('header', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // 1. Check Initial Masked State
    const initialText = await page.evaluate(() => document.body.innerText);
    const hasMaskedInitially = initialText.includes('Rp ••••••');
    console.log('Initial state has masked "Rp ••••••":', hasMaskedInitially);

    const initialButtonLabel = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent?.includes('Show') || b.textContent?.includes('Hide'));
      return {
        text: btn?.innerText || btn?.textContent,
        title: btn?.getAttribute('title'),
      };
    });
    console.log('Initial Toggle Button:', initialButtonLabel);

    await page.screenshot({ path: path.join(artifactDir, '1-alt-e-initial-masked.png') });

    // 2. Press Alt+E to Reveal Nominals
    console.log('👉 Pressing Alt+E to REVEAL nominals...');
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyE');
    await page.keyboard.up('Alt');
    await new Promise((r) => setTimeout(r, 600));

    const revealedState = await page.evaluate(() => {
      const text = document.body.innerText;
      const hidePref = window.sessionStorage.getItem('thelife-hide-nominals');
      const btn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent?.includes('Show') || b.textContent?.includes('Hide'));
      return {
        hidePref,
        hasMaskedText: text.includes('Rp ••••••'),
        buttonText: btn?.innerText || btn?.textContent,
        buttonTitle: btn?.getAttribute('title'),
      };
    });
    console.log('After first Alt+E (Revealed):', revealedState);

    await page.screenshot({ path: path.join(artifactDir, '2-alt-e-revealed.png') });

    // 3. Press Alt+E again to Mask Nominals
    console.log('👉 Pressing Alt+E again to MASK nominals...');
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyE');
    await page.keyboard.up('Alt');
    await new Promise((r) => setTimeout(r, 600));

    const remaskedState = await page.evaluate(() => {
      const text = document.body.innerText;
      const hidePref = window.sessionStorage.getItem('thelife-hide-nominals');
      const btn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent?.includes('Show') || b.textContent?.includes('Hide'));
      return {
        hidePref,
        hasMaskedText: text.includes('Rp ••••••'),
        buttonText: btn?.innerText || btn?.textContent,
        buttonTitle: btn?.getAttribute('title'),
      };
    });
    console.log('After second Alt+E (Remasked):', remaskedState);

    await page.screenshot({ path: path.join(artifactDir, '3-alt-e-remasked.png') });

    if (revealedState.hidePref === 'false' && remaskedState.hidePref === 'true') {
      console.log('🎉 Alt+E Verification Succeeded 100%!');
    } else {
      throw new Error(`Toggle verification mismatch: revealed=${revealedState.hidePref}, remasked=${remaskedState.hidePref}`);
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
