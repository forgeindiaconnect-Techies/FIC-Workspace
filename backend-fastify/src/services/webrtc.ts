import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { Participant } from '../models/Participant';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { Types } from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';

interface PeerInfo {
  socket: WebSocket;
  userId: string;
  name: string;
  avatarUrl?: string;
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

      peerId = user._id.toString();
      meetingId = String(roomKey);

      if (!rooms.has(meetingId)) rooms.set(meetingId, new Map());
      const room = rooms.get(meetingId)!;

      room.set(peerId, {
        socket: ws,
        userId: peerId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      await Participant.findOneAndUpdate(
        { meetingId, userId: peerId },
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
        userId: peerId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      return;
    }

    if (!peerId || !meetingId) {
      return send(ws, { type: 'error', message: 'Not joined. Send join first.' });
    }

    if (type === 'offer') {
      const { targetPeerId, sdp } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'offer', fromPeerId: peerId, sdp });
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
      const { audioEnabled, videoEnabled } = data;
      broadcastToRoom(meetingId, peerId, {
        type: 'peer-media-state',
        fromPeerId: peerId,
        peerId,
        audioEnabled,
        videoEnabled,
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
      await cleanupPeer(meetingId, peerId);
    }
  });

  ws.on('error', () => {
    if (meetingId && peerId) {
      cleanupPeer(meetingId, peerId).catch(() => {});
    }
  });
}

async function cleanupPeer(roomId: string, pid: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(pid);
  if (room.size === 0) rooms.delete(roomId);

  broadcastToRoom(roomId, pid, { type: 'peer-left', peerId: pid });

  await Participant.findOneAndUpdate(
    { meetingId: roomId, userId: pid },
    { leftAt: new Date() }
  ).catch((e) => {
    console.error('[WebRTC] cleanupPeer DB update error:', e);
  });
}
