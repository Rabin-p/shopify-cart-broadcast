// Drives demo.html in headless Chromium and writes PNG frames for the README GIF.
// Usage: node scripts/capture-gif.mjs   (then ffmpeg assembles .frames/*.png -> media/demo.gif)
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMES = join(ROOT, '.frames');
const DEMO = `file://${join(ROOT, 'demo.html')}?capture`;

const CHROME = process.env.CHROME_PATH || '/snap/bin/chromium';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 760, height: 660, deviceScaleFactor: 2 });
  await page.goto(DEMO, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__demo');

  let n = 0;
  const shoot = async () => {
    await page.screenshot({ path: join(FRAMES, `frame-${String(n++).padStart(2, '0')}.png`) });
  };
  // Wait until the feed has `count` rows, then let the bar transition settle.
  const afterAction = async (count) => {
    await page.waitForFunction((c) => document.getElementById('feed').childElementCount >= c, {}, count);
    await sleep(500);
    await shoot();
  };

  await sleep(300);
  await shoot();                                   // 0: initial
  await page.evaluate(() => window.__demo.add());
  await afterAction(2);                            // 1: +$20  (added + updated)
  await page.evaluate(() => window.__demo.add());
  await afterAction(4);                            // 2: +$40
  await page.evaluate(() => window.__demo.add());
  await afterAction(6);                            // 3: $60 -> free shipping unlocked
  await page.evaluate(() => window.__demo.fetch());
  await afterAction(8);                            // 4: cart fetched
  await sleep(300);
  await shoot();                                   // 5: hold
  await shoot();                                   // 6: hold (extra dwell on final state)

  console.log(`OK: wrote ${n} frames to ${FRAMES}`);
} finally {
  await browser.close();
}
