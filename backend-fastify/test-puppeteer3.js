const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Launching browser with chrome channel...');
    const browser = await puppeteer.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('Navigating to login...');
    await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: 'test-step1-login-loaded.png' });
    
    const url = page.url();
    console.log('Current URL after load:', url);
    
    if (url.includes('/login')) {
      console.log('Typing email...');
      await page.waitForSelector('input[placeholder="name@company.com"]', { timeout: 10000 });
      await page.type('input[placeholder="name@company.com"]', 'ai-assistant@nexus.app');
      
      console.log('Typing password...');
      const pwdInputs = await page.$$('input[type="password"]');
      if (pwdInputs.length > 0) {
        await pwdInputs[0].type('AI_SECURE_PASSWORD_123!@#');
      } else {
        const allInputs = await page.$$('input');
        for (const input of allInputs) {
          const type = await page.evaluate(el => el.getAttribute('type'), input);
          if (type === 'password') {
            await input.type('AI_SECURE_PASSWORD_123!@#');
            break;
          }
        }
      }
      
      await page.screenshot({ path: 'test-step2-credentials-filled.png' });
      
      console.log('Clicking Sign In...');
      const buttons = await page.$$('div[role="button"]');
      let clicked = false;
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Sign In')) {
          await btn.click();
          clicked = true;
          break;
        }
      }
      console.log('Sign in clicked:', clicked);
      
      console.log('Waiting for navigation after login...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log('nav err:', e.message));
    } else {
      console.log('Already redirected away from login');
    }
    
    await page.screenshot({ path: 'test-step3-after-login.png' });
    console.log('Final URL:', page.url());
    
    // Test the window.joinRoomForBot
    console.log('Evaluating window.joinRoomForBot check...');
    const hasJoinFunction = await page.evaluate(() => typeof window.joinRoomForBot === 'function');
    console.log('Has joinRoomForBot?', hasJoinFunction);

    await browser.close();
    console.log('Test Complete');
  } catch(e) {
    console.error('Error:', e);
  }
})();
