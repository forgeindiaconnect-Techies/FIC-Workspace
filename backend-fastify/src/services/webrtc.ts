import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { Participant } from '../models/Participant';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { Types } from 'mongoose';
import { stopAIBot } from './aiBot';
import { summarizeMeeting } from './summarizer';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';

interface PeerInfo {
  socket: WebSocket;
  userId: string;
  name: string;
  avatarUrl?: string;
  isAlive: boolean;
  joinedAt: Date;
}

const rooms = new Map<string, Map<string, PeerInfo>>();

function send(ws: WebSocket, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(meetingId: string, excludePeerId: string, payload: object) {
  const room = rooms.get(meetingId);
  if (!room) return;
  const raw = JSON.stringify(payload);
  for (const [pid, peer] of room.entries()) {
    if (pid !== excludePeerId && peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.send(raw);
    }
  }
}

/**
 * Mesh WebRTC signaling (offer / answer / ICE relay).
 * Matches mobile/web client messages: type join | offer | answer | ice-candidate | media-state | leave
 */
export function handleWebRtcSignalling(ws: WebSocket) {
  let peerId: string | null = null;
  let meetingId: string | null = null;

  (ws as any).isAlive = true;
  ws.on('pong', () => { (ws as any).isAlive = true; });

  ws.on('message', async (raw: Buffer | string) => {
    let msg: any;
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
        return send(ws, { type: 'error', message: 'token and meetingId (or roomId) required' });
      }

      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return send(ws, { type: 'error', message: 'Invalid token' });
      }

      const userId = decoded.userId || decoded.id;
      const user = await User.findById(userId).catch(() => null);
      if (!user) return send(ws, { type: 'error', message: 'User not found' });

      const baseUserId = user._id.toString();
      peerId = `${baseUserId}_${Math.random().toString(36).substring(2, 10)}`;
      meetingId = String(roomKey);

      if (!rooms.has(meetingId)) rooms.set(meetingId, new Map());
      const room = rooms.get(meetingId)!;

      // Duplicate prevention: if this exact random peerId exists, terminate it (virtually impossible but safe)
      if (room.has(peerId)) {
        const oldPeer = room.get(peerId)!;
        try { oldPeer.socket.terminate(); } catch (e) {}
      }

      room.set(peerId, {
        socket: ws,
        userId: baseUserId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isAlive: true,
        joinedAt: new Date()
      });

      await Participant.findOneAndUpdate(
        { meetingId, userId: baseUserId },
        { joinedAt: new Date(), $unset: { leftAt: '' } },
        { upsert: true }
      ).catch(() => {});

      const existingPeers = Array.from(room.entries())
        .filter(([pid]) => pid !== peerId)
        .map(([pid, p]) => ({
          peerId: pid,
          userId: p.userId,
          name: p.name,
          avatarUrl: p.avatarUrl,
        }));

      send(ws, { type: 'joined', peerId, existingPeers });

      broadcastToRoom(meetingId, peerId, {
        type: 'peer-joined',
        peerId,
        userId: baseUserId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      return;
    }

    if (!peerId || !meetingId) {
      return send(ws, { type: 'error', message: 'Not joined. Send join first.' });
    }

    if (type === 'offer') {
      const { targetPeerId, sdp, isScreenShare, screenTrackId, screenMid, screenStreamId } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'offer', fromPeerId: peerId, sdp, isScreenShare, screenTrackId, screenMid, screenStreamId });
      }
      return;
    }

    if (type === 'answer') {
      const { targetPeerId, sdp } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'answer', fromPeerId: peerId, sdp });
      }
      return;
    }

    if (type === 'ice-candidate') {
      const { targetPeerId, candidate } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'ice-candidate', fromPeerId: peerId, candidate });
      }
      return;
    }

    if (type === 'media-state') {
      const { audioEnabled, videoEnabled, isScreenSharing } = data;
      broadcastToRoom(meetingId, peerId, {
        type: 'peer-media-state',
        fromPeerId: peerId,
        peerId,
        audioEnabled,
        videoEnabled,
        isScreenSharing,
      });
      return;
    }

    if (type === 'mute-all') {
      const { mute } = data;
      broadcastToRoom(meetingId, peerId, {
        type: 'mute-all',
        fromPeerId: peerId,
        mute
      });
      return;
    }

    if (type === 'chat-message') {
      broadcastToRoom(meetingId, peerId, {
        type: 'chat-message',
        fromPeerId: peerId,
        ...data
      });
      return;
    }

    if (type === 'end-meeting-all') {
      broadcastToRoom(meetingId, peerId, { type: 'meeting-ended' });
      
      // Update database so users cannot join via link again
      const query = Types.ObjectId.isValid(meetingId) 
        ? { _id: meetingId } 
        : { joinCode: meetingId };
      
      Meeting.updateOne(query, { status: 'ended' })
        .catch(err => console.error('[WebRTC] Failed to update meeting status:', err));
        
      return;
    }

    if (type === 'kick-peer') {
      const { targetPeerId } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'kicked' });
      }
      return;
    }

    if (type === 'leave') {
      await cleanupPeer(meetingId, peerId);
      peerId = null;
      meetingId = null;
      return;
    }
  });

  ws.on('close', async () => {
    if (meetingId && peerId) {
      const room = rooms.get(meetingId);
      // Only cleanup if the closing socket is the currently active one
      if (room && room.get(peerId)?.socket === ws) {
        await cleanupPeer(meetingId, peerId);
      }
    }
  });

  ws.on('error', () => {
    if (meetingId && peerId) {
      const room = rooms.get(meetingId);
      if (room && room.get(peerId)?.socket === ws) {
        cleanupPeer(meetingId, peerId).catch(() => {});
      }
    }
  });
}

async function cleanupPeer(roomId: string, pid: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(pid);
  if (room.size === 0) rooms.delete(roomId);

  broadcastToRoom(roomId, pid, { type: 'peer-left', peerId: pid });

  const baseUserId = pid.split('_')[0];

  try {
    let meetingQuery: any = { _id: roomId };
    if (!Types.ObjectId.isValid(roomId)) {
      meetingQuery = { joinCode: roomId };
    }

    const meeting = await Meeting.findOne(meetingQuery);
    if (!meeting) return;

    await Participant.findOneAndUpdate(
      { meetingId: meeting._id, userId: baseUserId, leftAt: { $exists: false } },
      { leftAt: new Date() }
    );

    const aiBotUser = await User.findOne({ email: 'ai-assistant@nexus.app' });
    const query: any = {
      meetingId: meeting._id,
      leftAt: { $exists: false }
    };
    if (aiBotUser) {
      query.userId = { $ne: aiBotUser._id };
    }

    const activeParticipantCount = await Participant.countDocuments(query);

    if (activeParticipantCount === 0 && meeting.status !== 'ended') {
      console.log(`[WebRTC] Room ${meeting._id} is empty. Starting 30s grace period before ending meeting...`);
      setTimeout(async () => {
        try {
          // Fetch the meeting again to ensure we have fresh state
          const currentMeeting = await Meeting.findById(meeting._id);
          if (!currentMeeting || currentMeeting.status === 'ended') return;

          // Fetch the AI bot user again just in case
          const currentAiBotUser = await User.findOne({ email: 'ai-assistant@nexus.app' });
          const currentQuery: any = {
            meetingId: currentMeeting._id,
            leftAt: { $exists: false }
          };
          if (currentAiBotUser) {
            currentQuery.userId = { $ne: currentAiBotUser._id };
          }

          const currentActiveCount = await Participant.countDocuments(currentQuery);

          if (currentActiveCount === 0) {
            console.log(`[WebRTC] Grace period expired. Ending room ${currentMeeting._id}...`);
            currentMeeting.status = 'ended';
            await currentMeeting.save();
            
            // Small delay before stopping bot / summarizing
            await new Promise((resolve) => setTimeout(resolve, 2500));
            if (currentMeeting.aiEnabled) {
              await stopAIBot(currentMeeting._id.toString());
            } else {
              summarizeMeeting(currentMeeting._id.toString()).catch((err) => {
                console.warn('[WebRTC] Summary generation failed:', err.message);
              });
            }
          } else {
            console.log(`[WebRTC] Participant reconnected during grace period. Room ${currentMeeting._id} remains active.`);
          }
        } catch (err: any) {
          console.error('[WebRTC] Error during grace period check:', err);
        }
      }, 30000); // 30 seconds grace period
    }
  } catch (e) {
    console.error('[WebRTC] cleanupPeer DB update error:', e);
  }
}

// Heartbeat mechanism to reap dead sockets
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    for (const [peerId, peer] of room.entries()) {
      const ws = peer.socket as any;
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch (e) {}
        cleanupPeer(roomId, peerId);
        continue;
      }
      ws.isAlive = false;
      try { peer.socket.ping(); } catch (e) {}
    }
  }
}, 30000);
