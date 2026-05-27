const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle2' });
    await page.type('input[placeholder="name@company.com"]', 'ai-assistant@nexus.app');
    await page.type('input[type="password"]', 'AI_SECURE_PASSWORD_123!@#');
    
    const elements = await page.$$('div');
    for (const el of elements) {
      const text = await page.evaluate(e => e.textContent, el);
      if (text === 'Sign In') {
        await el.click();
        break;
      }
    }
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(e=>console.log(e.message));
    await page.screenshot({ path: 'test-step4-error.png' });
    await browser.close();
  } catch(e) {}
})();
