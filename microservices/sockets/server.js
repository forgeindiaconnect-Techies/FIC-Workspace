import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { connectMongo, User, Transcript } from '../shared/database.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';

// Keep track of active sockets
const activeMailSockets = new Map(); // email -> ws
const onlineCallUsers = new Map();   // email -> ws
const webrtcRooms = new Map();       // meetingId -> Map(peerId -> { socket, name, avatarUrl })

// Helper to send json
function sendJson(ws, payload) {
  if (ws && ws.readyState === 1) { // OPEN
    ws.send(JSON.stringify(payload));
  }
}

// ─── INTERNAL REST ENDPOINTS ───
// Mail service sends alerts here
app.post('/internal/new-mail', (req, res) => {
  const { recipientEmail, mail } = req.body;
  if (recipientEmail && activeMailSockets.has(recipientEmail)) {
    const ws = activeMailSockets.get(recipientEmail);
    sendJson(ws, { type: 'NEW_MAIL', mail });
    console.log(`[Sockets Internal] Forwarded new mail alert to ${recipientEmail}`);
  }
  res.json({ success: true });
});

// Chat service sends messages here
app.post('/internal/chat-message', (req, res) => {
  const { conversationId, senderEmail, message } = req.body;
  // Broadcast message to anyone active in Call / Chat sockets
  // Or send message to all online call sockets
  onlineCallUsers.forEach((ws, email) => {
    sendJson(ws, { type: 'new-message', conversationId, senderEmail, message });
  });
  res.json({ success: true });
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'websocket-service', 
    activeMailSockets: activeMailSockets.size,
    onlineCallUsers: onlineCallUsers.size,
    activeWebRtcRooms: webrtcRooms.size
  });
});

const server = http.createServer(app);

// ─── WEBSOCKET ROUTING ───
const wssMail = new WebSocketServer({ noServer: true });
const wssCalls = new WebSocketServer({ noServer: true });
const wssWebRtc = new WebSocketServer({ noServer: true });
const wssAudio = new WebSocketServer({ noServer: true });

// 0. AUDIO SOCKET HANDLER (Groq Whisper Transcription)
wssAudio.on('connection', (ws, req) => {
  let currentMeetingId = '';
  let currentUserId = '';
  let currentSpeakerName = '';

  console.log('[Sockets] Audio socket connected');

  ws.on('message', async (message, isBinary) => {
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
        fs.writeFileSync(filePath, message);
        
        if (process.env.GROQ_API_KEY) {
          const { default: Groq } = await import('groq-sdk');
          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
          
          const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-large-v3',
            prompt: 'Meeting conversation. Transcribe accurately.',
            response_format: 'json',
            language: 'en',
          });

          const text = transcription.text.trim();
          if (text) {
            await Transcript.create({
              meetingId: currentMeetingId,
              userId: currentUserId,
              speakerName: currentSpeakerName,
              text,
              timestamp: new Date()
            });
            console.log(`[AudioSocket] Transcribed: "${text.slice(0, 60)}..."`);
          }
        }
      } catch (e) {
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
    console.error('[Sockets] Audio socket error:', err.message);
  });
});

// 1. MAIL SOCKET HANDLER
wssMail.on('connection', (ws, req) => {
  let email;
  try {
    const url = new URL(req.url, 'http://localhost');
    email = url.searchParams.get('email');
  } catch (e) {
    console.error('[Sockets] Mail parse URL error:', e.message);
  }

  if (email) {
    console.log(`[Sockets] Mail socket connected: ${email}`);
    activeMailSockets.set(email, ws);
    
    ws.on('close', () => {
      console.log(`[Sockets] Mail socket closed: ${email}`);
      activeMailSockets.delete(email);
    });
    
    ws.on('error', () => {
      activeMailSockets.delete(email);
    });
  } else {
    ws.close(1008, 'Email identifier required');
  }
});

// 2. VOICE CALL SOCKET HANDLER
wssCalls.on('connection', (ws) => {
  let registeredEmail = null;
  
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, email, token, targetEmail, sdp, candidate, callerName } = msg;

    if (type === 'register') {
      if (email) {
        registeredEmail = email;
        onlineCallUsers.set(email, ws);
        console.log(`[Sockets] Call user registered: ${email}`);
        sendJson(ws, { type: 'registered', email });
      }
      return;
    }

    if (!registeredEmail) {
      return sendJson(ws, { type: 'error', message: 'not registered, send register first' });
    }

    if (type === 'call_user') {
      const targetWs = onlineCallUsers.get(targetEmail);
      if (targetWs) {
        console.log(`[Sockets] Routing voice call from ${registeredEmail} to ${targetEmail}`);
        sendJson(targetWs, {
          type: 'incoming_call',
          callerEmail: registeredEmail,
          callerName: callerName || registeredEmail,
          sdp
        });
      } else {
        sendJson(ws, { type: 'call_failed', message: 'Target offline' });
      }
      return;
    }

    if (type === 'call_accepted') {
      const targetWs = onlineCallUsers.get(targetEmail);
      if (targetWs) {
        sendJson(targetWs, { type: 'call_accepted', calleeEmail: registeredEmail, sdp });
      }
      return;
    }

    if (type === 'call_declined') {
      const targetWs = onlineCallUsers.get(targetEmail);
      if (targetWs) {
        sendJson(targetWs, { type: 'call_declined', calleeEmail: registeredEmail });
      }
      return;
    }

    if (type === 'ice_candidate') {
      const targetWs = onlineCallUsers.get(targetEmail);
      if (targetWs) {
        sendJson(targetWs, { type: 'ice_candidate', fromEmail: registeredEmail, candidate });
      }
      return;
    }
  });

  ws.on('close', () => {
    if (registeredEmail) {
      console.log(`[Sockets] Call user offline: ${registeredEmail}`);
      onlineCallUsers.delete(registeredEmail);
    }
  });
});

// 3. WEBRTC ROOMS SIGNALING HANDLER
wssWebRtc.on('connection', (ws) => {
  let peerId = null;
  let meetingId = null;

  function broadcastToRoom(excludePeerId, payload) {
    const room = webrtcRooms.get(meetingId);
    if (!room) return;
    const raw = JSON.stringify(payload);
    for (const [pid, peer] of room.entries()) {
      if (pid !== excludePeerId && peer.socket.readyState === 1) {
        peer.socket.send(raw);
      }
    }
  }

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, data = {} } = msg;

    if (type === 'join') {
      const roomKey = data.meetingId || data.roomId;
      const { token } = data;
      if (!token || !roomKey) {
        return sendJson(ws, { type: 'error', message: 'token and meetingId (or roomId) required' });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return sendJson(ws, { type: 'error', message: 'Invalid token' });
      }

      await connectMongo();
      const user = await User.findById(decoded.userId).catch(() => null);
      if (!user) return sendJson(ws, { type: 'error', message: 'User not found' });

      peerId = user._id.toString();
      meetingId = String(roomKey);

      if (!webrtcRooms.has(meetingId)) {
        webrtcRooms.set(meetingId, new Map());
      }
      const room = webrtcRooms.get(meetingId);

      room.set(peerId, {
        socket: ws,
        userId: peerId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      console.log(`[Sockets WebRTC] Peer ${user.name} (${peerId}) joined room ${meetingId}`);

      const existingPeers = Array.from(room.entries())
        .filter(([pid]) => pid !== peerId)
        .map(([pid, p]) => ({
          peerId: pid,
          userId: p.userId,
          name: p.name,
          avatarUrl: p.avatarUrl,
        }));

      sendJson(ws, { type: 'joined', peerId, existingPeers });

      broadcastToRoom(peerId, {
        type: 'peer-joined',
        peerId,
        userId: peerId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
      return;
    }

    if (!peerId || !meetingId) {
      return sendJson(ws, { type: 'error', message: 'Not joined. Send join first.' });
    }

    if (type === 'offer') {
      const { targetPeerId, sdp } = data;
      const target = webrtcRooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        sendJson(target.socket, { type: 'offer', fromPeerId: peerId, sdp });
      }
      return;
    }

    if (type === 'answer') {
      const { targetPeerId, sdp } = data;
      const target = webrtcRooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        sendJson(target.socket, { type: 'answer', fromPeerId: peerId, sdp });
      }
      return;
    }

    if (type === 'ice-candidate') {
      const { targetPeerId, candidate } = data;
      const target = webrtcRooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        sendJson(target.socket, { type: 'ice-candidate', fromPeerId: peerId, candidate });
      }
      return;
    }

    if (type === 'media-state') {
      const { audioEnabled, videoEnabled } = data;
      broadcastToRoom(peerId, {
        type: 'peer-media-state',
        fromPeerId: peerId,
        peerId,
        audioEnabled,
        videoEnabled,
      });
      return;
    }

    if (type === 'leave') {
      cleanupPeer();
      peerId = null;
      meetingId = null;
      return;
    }
  });

  function cleanupPeer() {
    if (!meetingId || !peerId) return;
    const room = webrtcRooms.get(meetingId);
    if (!room) return;

    room.delete(peerId);
    if (room.size === 0) webrtcRooms.delete(meetingId);

    console.log(`[Sockets WebRTC] Peer ${peerId} left room ${meetingId}`);
    broadcastToRoom(peerId, { type: 'peer-left', peerId });
  }

  ws.on('close', cleanupPeer);
  ws.on('error', cleanupPeer);
});

// ─── GATEWAY HTTP UPGRADE ROUTING ───
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/ws/mail') {
    wssMail.handleUpgrade(req, socket, head, (ws) => {
      wssMail.emit('connection', ws, req);
    });
  } else if (pathname === '/ws/calls') {
    wssCalls.handleUpgrade(req, socket, head, (ws) => {
      wssCalls.emit('connection', ws, req);
    });
  } else if (pathname === '/ws/webrtc') {
    wssWebRtc.handleUpgrade(req, socket, head, (ws) => {
      wssWebRtc.emit('connection', ws, req);
    });
  } else if (pathname === '/ws/audio') {
    wssAudio.handleUpgrade(req, socket, head, (ws) => {
      wssAudio.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

const PORT = 3105;
server.listen(PORT, () => {
  console.log(`🔌 [WebSocket / Signaling Service] Running on http://localhost:${PORT}`);
});
