const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle2' });
    await page.type('input[placeholder="name@company.com"]', 'ai-assistant@nexus.app');
    await page.type('input[type="password"]', 'AI_SECURE_PASSWORD_123!@#');
    
    // Find element containing "Sign In" exactly and click its parent
    const elements = await page.$$('div');
    let clicked = false;
    for (const el of elements) {
      const text = await page.evaluate(e => e.textContent, el);
      if (text === 'Sign In') {
        await el.click();
        clicked = true;
        break;
      }
    }
    console.log('clicked:', clicked);
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(e=>console.log('Nav err', e.message));
    const url = page.url();
    console.log('Final URL:', url);
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
