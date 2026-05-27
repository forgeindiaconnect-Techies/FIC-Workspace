const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('New page...');
    const page = await browser.newPage();
    
    console.log('Navigating...');
    await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'step1-login.png' });
    
    console.log('Typing email...');
    await page.waitForSelector('input[placeholder="Email Address"]', { timeout: 10000 });
    await page.type('input[placeholder="Email Address"]', 'ai-assistant@nexus.app');
    
    console.log('Typing password...');
    const allInputs = await page.$$('input');
    for (const input of allInputs) {
      const type = await page.evaluate(el => el.getAttribute('type'), input);
      if (type === 'password') {
        await input.type('AI_SECURE_PASSWORD_123!@#');
        break;
      }
    }
    
    await page.screenshot({ path: 'step2-filled.png' });
    
    console.log('Clicking Sign In...');
    await page.click('div[role="button"]:has-text("Sign In"), button:has-text("Sign In")');
    console.log('Waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(e => console.log('nav err:', e.message));
    
    await page.screenshot({ path: 'step3-after-click.png' });
    
    await browser.close();
    console.log('done');
  } catch(e) {
    console.error('Error:', e);
  }
})();
