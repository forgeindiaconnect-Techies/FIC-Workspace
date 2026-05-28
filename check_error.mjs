import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
    console.log(err.stack);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173/w/antigravity-hq/meet/room/625-764-8362?pwd=0FX7NA&intent=create', { waitUntil: 'networkidle0' });
    console.log('Page loaded');
  } catch (err) {
    console.log('GOTO ERROR', err);
  }

  await browser.close();
})();
