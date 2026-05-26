import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Participant } from '../models/Participant';
import { Meeting } from '../models/Meeting';
import { transcribeChunk } from './transcription';
import { summarizeMeeting } from './summarizer';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';

interface ActiveBot {
  ws: WebSocket;
  meetingId: string;
  userId: string;
}

const activeBots = new Map<string, ActiveBot>();

/**
 * Mint a long-lived JWT token for the AI Bot user directly (no HTTP round-trip).
 */
async function mintAIBotToken(): Promise<{ token: string; userId: string } | null> {
  try {
    const aiUser = await User.findOne({ email: 'ai-assistant@nexus.app' });
    if (!aiUser) {
      console.error('[AIBot] ai-assistant@nexus.app user not found in DB. Run seed first.');
      return null;
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

export async function launchAIBot(meetingId: string, joinCode: string, _frontendUrl: string) {
  if (activeBots.has(meetingId)) {
    console.log(`[AIBot] Bot already active for meeting ${meetingId}`);
    return;
  }

  console.log(`[AIBot] Launching direct-WS bot for meeting ${meetingId} (code: ${joinCode})`);

  // 1. Get or create the AI bot user, then mint a token
  const auth = await mintAIBotToken();
  if (!auth) {
    console.error('[AIBot] Cannot launch bot — no valid token.');
    return;
  }

  // 2. Connect directly to the WebRTC signaling server
  // On Render, RENDER_EXTERNAL_URL = https://workspace-backend-r9f8.onrender.com
  // We convert it to wss:// so the bot can connect to itself
  const renderUrl = process.env.RENDER_EXTERNAL_URL || '';
  const backendWsUrl = process.env.BACKEND_WS_URL ||
    (renderUrl ? renderUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') :
      `ws://localhost:${process.env.PORT || 3001}`);
  const wsUrl = `${backendWsUrl}/ws/webrtc`;

  console.log(`[AIBot] Connecting to signaling server at ${wsUrl}`);

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err: any) {
    console.error('[AIBot] Failed to create WebSocket:', err.message);
    return;
  }

  activeBots.set(meetingId, { ws, meetingId, userId: auth.userId });

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
        console.log(`[AIBot] ✅ Successfully joined room ${meetingId} as peer ${msg.peerId}`);
        // Register as participant
        Participant.findOneAndUpdate(
          { meetingId, userId: auth.userId },
          { joinedAt: new Date(), $unset: { leftAt: '' } },
          { upsert: true }
        ).catch(() => {});
      }

      if (msg.type === 'error') {
        console.error(`[AIBot] Signaling error: ${msg.message}`);
      }

      // The bot is listening-only; it does not send WebRTC offers/answers.
      // Audio streaming is handled separately via /ws/audio.
    } catch (e) {
      // Ignore non-JSON messages
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[AIBot] WS closed for meeting ${meetingId}: code=${code}`);
    activeBots.delete(meetingId);
  });

  ws.on('error', (err) => {
    console.error(`[AIBot] WS error for meeting ${meetingId}:`, err.message);
    activeBots.delete(meetingId);
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

  // Trigger summarization when the bot leaves
  console.log(`[AIBot] Triggering summarization for ${meetingId}`);
  await summarizeMeeting(meetingId);
}

// WebSocket handler for receiving audio chunks from the frontend
export function handleAudioSocket(ws: WebSocket) {
  let currentMeetingId = '';
  let currentUserId = '';
  let currentSpeakerName = '';

  ws.on('message', async (message: WebSocket.RawData, isBinary: boolean) => {
    if (!isBinary) {
      // It's a metadata message
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
      // It's a binary audio chunk (WebM)
      if (!currentMeetingId || !currentUserId) {
        console.warn('[AudioSocket] Received audio chunk before metadata, ignoring.');
        return;
      }

      const tmpDir = os.tmpdir();
      const fileName = `chunk_${currentMeetingId}_${currentUserId}_${Date.now()}.webm`;
      const filePath = path.join(tmpDir, fileName);

      try {
        fs.writeFileSync(filePath, message as Buffer);

        // Send to Groq Whisper for transcription
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
