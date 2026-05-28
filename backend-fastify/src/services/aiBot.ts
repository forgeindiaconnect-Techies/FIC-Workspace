import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { Participant } from '../models/Participant';
import { transcribeChunk } from './transcription';
import { summarizeMeeting } from './summarizer';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';
const AI_BOT_EMAIL = 'ai-assistant@nexus.app';
const AI_BOT_NAME = 'Nexus AI Assistant';

interface ActiveBot {
  ws: WebSocket;
  meetingId: string;
  userId: string;
}

const activeBots = new Map<string, ActiveBot>();

async function mintAIBotToken(): Promise<{ token: string; userId: string } | null> {
  try {
    let aiUser = await User.findOne({ email: AI_BOT_EMAIL });
    if (!aiUser) {
      const passwordHash = await bcrypt.hash('AI_SECURE_PASSWORD_123!@#', 12);
      aiUser = await User.create({
        name: AI_BOT_NAME,
        email: AI_BOT_EMAIL,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=nexusai`,
        mfaEnabled: false,
        role: 'company-admin',
        workspaceId: 'antigraviity-hq',
      });
    }

    const token = jwt.sign(
      { userId: aiUser._id, email: aiUser.email, name: aiUser.name, role: 'ai-bot', workspaceId: 'antigraviity-hq' },
      JWT_SECRET,
      { expiresIn: '6h' }
    );
    return { token, userId: aiUser._id.toString() };
  } catch (err: any) {
    console.error('[AIBot] Failed to mint bot token:', err.message);
    return null;
  }
}

function toWebSocketBaseUrl(url: string): string {
  return url.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:').replace(/\/+$/, '');
}

export async function launchAIBot(meetingId: string, joinCode: string, backendBaseUrl?: string) {
  if (activeBots.has(meetingId)) {
    console.log(`[AIBot] Bot already active for meeting ${meetingId}`);
    return { success: true, message: 'AI Assistant already active' };
  }

  console.log(`[AIBot] Launching direct-WS bot for meeting ${meetingId} (code: ${joinCode})`);

  const auth = await mintAIBotToken();
  if (!auth) {
    throw new Error('Cannot launch AI Assistant: bot user/token is unavailable.');
  }

  const renderUrl = process.env.RENDER_EXTERNAL_URL || '';
  const backendWsUrl = process.env.BACKEND_WS_URL ||
    (backendBaseUrl ? toWebSocketBaseUrl(backendBaseUrl) :
      (renderUrl ? toWebSocketBaseUrl(renderUrl) : `ws://localhost:${process.env.PORT || 3001}`));
  const wsUrl = `${backendWsUrl}/ws/webrtc`;

  console.log(`[AIBot] Connecting to signaling server at ${wsUrl}`);

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err: any) {
    throw new Error(`Failed to create AI Assistant WebSocket: ${err.message}`);
  }

  activeBots.set(meetingId, { ws, meetingId, userId: auth.userId });

  return await new Promise<{ success: true; message: string }>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      activeBots.delete(meetingId);
      try { ws.close(); } catch {}
      finish(() => reject(new Error('AI Assistant timed out while joining the meeting.')));
    }, 10000);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    ws.on('open', () => {
      console.log(`[AIBot] WS open. Sending join for meeting ${meetingId}...`);
      ws.send(JSON.stringify({
        type: 'join',
        data: {
          meetingId,
          token: auth.token
        }
      }));
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        console.log(`[AIBot] Signaling message: ${msg.type}`);

        if (msg.type === 'joined') {
          console.log(`[AIBot] Successfully joined room ${meetingId} as peer ${msg.peerId}`);
          Participant.findOneAndUpdate(
            { meetingId, userId: auth.userId },
            { joinedAt: new Date(), $unset: { leftAt: '' } },
            { upsert: true }
          ).catch(() => {});
          finish(() => resolve({ success: true, message: 'AI Assistant joined the meeting' }));
        }

        if (msg.type === 'error') {
          console.error(`[AIBot] Signaling error: ${msg.message}`);
          activeBots.delete(meetingId);
          try { ws.close(); } catch {}
          finish(() => reject(new Error(msg.message || 'AI Assistant failed to join signaling.')));
        }
      } catch {
        // Ignore non-JSON messages.
      }
    });

    ws.on('close', (code) => {
      console.log(`[AIBot] WS closed for meeting ${meetingId}: code=${code}`);
      activeBots.delete(meetingId);
      finish(() => reject(new Error(`AI Assistant WebSocket closed before joining: ${code}`)));
    });

    ws.on('error', (err) => {
      console.error(`[AIBot] WS error for meeting ${meetingId}:`, err.message);
      activeBots.delete(meetingId);
      finish(() => reject(new Error(err.message)));
    });
  });
}

export async function stopAIBot(meetingId: string) {
  const bot = activeBots.get(meetingId);
  if (bot) {
    console.log(`[AIBot] Stopping bot for meeting ${meetingId}`);
    try {
      bot.ws.send(JSON.stringify({ type: 'leave', data: {} }));
      bot.ws.close();
    } catch (e) {}
    activeBots.delete(meetingId);
  }

  console.log(`[AIBot] Triggering summarization for ${meetingId}`);
  await summarizeMeeting(meetingId);
}

export function handleAudioSocket(ws: WebSocket) {
  let currentMeetingId = '';
  let currentUserId = '';
  let currentSpeakerName = '';

  ws.on('message', async (message: WebSocket.RawData, isBinary: boolean) => {
    if (!isBinary) {
      try {
        const meta = JSON.parse(message.toString());
        if (meta.type === 'metadata') {
          currentMeetingId = meta.meetingId;
          currentUserId = meta.userId;
          currentSpeakerName = meta.speakerName;
          console.log(`[AudioSocket] Registered metadata: meeting=${currentMeetingId}, speaker=${currentSpeakerName}`);
        }
      } catch (e) {}
    } else {
      if (!currentMeetingId || !currentUserId) {
        console.warn('[AudioSocket] Received audio chunk before metadata, ignoring.');
        return;
      }

      const tmpDir = os.tmpdir();
      const fileName = `chunk_${currentMeetingId}_${currentUserId}_${Date.now()}.webm`;
      const filePath = path.join(tmpDir, fileName);

      try {
        fs.writeFileSync(filePath, message as Buffer);
        const text = await transcribeChunk(currentMeetingId, currentUserId, currentSpeakerName, filePath);
        if (text) {
          console.log(`[AudioSocket] Transcribed: "${text.slice(0, 60)}..."`);
        }
      } catch (e: any) {
        console.error('[AudioSocket] Error processing chunk:', e.message);
      } finally {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  });

  ws.on('close', () => {
    console.log(`[AudioSocket] Connection closed for meeting ${currentMeetingId}`);
  });

  ws.on('error', (err) => {
    console.error('[AudioSocket] Error:', err.message);
  });
}
