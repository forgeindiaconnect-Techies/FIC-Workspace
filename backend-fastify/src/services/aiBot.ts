import puppeteer, { Browser, Page } from 'puppeteer';
import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { transcribeChunk } from './transcription';
import { summarizeMeeting } from './summarizer';

const activeBots = new Map<string, { browser: Browser, page: Page }>();

export async function launchAIBot(meetingId: string, joinCode: string, frontendUrl: string) {
  if (activeBots.has(meetingId)) {
    console.log(`[AIBot] Bot already active or launching for meeting ${meetingId}`);
    return;
  }

  // Set placeholder immediately to prevent race conditions
  activeBots.set(meetingId, { browser: null as any, page: null as any });

  console.log(`[AIBot] Launching Headless Bot for meeting ${meetingId}...`);

  try {
    const browser = await puppeteer.launch({
      executablePath: process.platform === 'win32' ? undefined : undefined,
      channel: process.platform === 'win32' ? 'chrome' : undefined,
      headless: true, // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-web-security',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    const page = await browser.newPage();
    activeBots.set(meetingId, { browser, page });

    console.log(`[AIBot] Navigating to ${frontendUrl}/login`);
    await page.goto(`${frontendUrl}/login`, { waitUntil: 'networkidle2', timeout: 60000 });

    try {
      console.log(`[AIBot] Logging in...`);
      await page.waitForSelector('input[placeholder="name@company.com"]', { timeout: 10000 });
      await page.type('input[placeholder="name@company.com"]', 'ai-assistant@nexus.app');
      
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
      
      const buttons = await page.$$('div[role="button"]');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Sign In')) {
          await btn.click();
          break;
        }
      }
      
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
      console.log(`[AIBot] Logged in successfully. Current URL: ${page.url()}`);
      
      console.log(`[AIBot] Navigating to ${frontendUrl}/meetings...`);
      await page.goto(`${frontendUrl}/meetings`, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Wait a moment for Meetings.tsx to mount and expose window.joinRoomForBot
      await page.waitForTimeout(2000);

      console.log(`[AIBot] Joining room ${joinCode}...`);
      await page.evaluate(`
        if (window.joinRoomForBot) {
          window.joinRoomForBot('${joinCode}');
        } else {
          console.error('window.joinRoomForBot is not defined');
        }
      `);
    } catch (e) {
      console.warn(`[AIBot] Login/Navigation step failed (perhaps already logged in?):`, e);
    }

  } catch (error: any) {
    console.error(`[AIBot] Failed to launch bot:`, error.message);
    activeBots.delete(meetingId);
    stopAIBot(meetingId);
  }
}

export async function stopAIBot(meetingId: string) {
  const bot = activeBots.get(meetingId);
  if (bot) {
    console.log(`[AIBot] Stopping bot for meeting ${meetingId}`);
    try {
      await bot.page.close();
      await bot.browser.close();
    } catch (e) {}
    activeBots.delete(meetingId);
  }

  // Trigger summarization when bot leaves
  console.log(`[AIBot] Triggering summarization for ${meetingId}`);
  await summarizeMeeting(meetingId);
}

// WebSocket handler for receiving audio chunks
export function handleAudioSocket(ws: WebSocket) {
  let currentMeetingId = '';
  let currentUserId = '';
  let currentSpeakerName = '';

  ws.on('message', async (message: Buffer | string, isBinary: boolean) => {
    if (!isBinary) {
      // It's a metadata message
      try {
        const meta = JSON.parse(message.toString());
        if (meta.type === 'metadata') {
          currentMeetingId = meta.meetingId;
          currentUserId = meta.userId;
          currentSpeakerName = meta.speakerName;
        }
      } catch (e) {}
    } else {
      // It's a binary audio chunk (WebM or similar)
      if (!currentMeetingId || !currentUserId) return;

      const tmpDir = os.tmpdir();
      const fileName = `chunk_${currentMeetingId}_${currentUserId}_${Date.now()}.webm`;
      const filePath = path.join(tmpDir, fileName);

      fs.writeFileSync(filePath, message as Buffer);

      // Send to Groq for transcription
      const text = await transcribeChunk(currentMeetingId, currentUserId, currentSpeakerName, filePath);
      
      // Clean up tmp file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}

      // If text exists, broadcast it back to the room for live captions
      // Note: We would need a reference to `broadcastToRoom` from webrtc.ts here, 
      // but for now the transcription is saved to DB and we can fetch it.
    }
  });

  ws.on('close', () => {
    // console.log('[AIBot] Audio socket closed');
  });
}
