import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Meeting } from '../models/Meeting';
import { Participant } from '../models/Participant';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';

// Room: meetingId -> Map<peerId, PeerInfo>
interface PeerInfo {
  socket: WebSocket;
  userId: string;
  name: string;
  avatarUrl?: string;
}

const rooms = new Map<string, Map<string, PeerInfo>>();

function normalizeJoinCode(code: string): string {
  const trimmed = String(code || '').trim().toUpperCase();
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 9) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  return trimmed;
}

async function resolveCanonicalMeetingId(idOrCode: string): Promise<string | null> {
  const value = String(idOrCode || '').trim();
  if (!value) return null;

  if (Types.ObjectId.isValid(value)) {
    const meeting = await Meeting.findById(value).select('_id').lean();
    if (meeting?._id) return meeting._id.toString();
  }

  const meeting = await Meeting.findOne({ joinCode: normalizeJoinCode(value) })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id')
    .lean();
  return meeting?._id?.toString() || null;
}

async function resolveCanonicalMeetingRoom(idOrCode: string, publicCode?: string): Promise<string | null> {
  const normalizedPublicCode = publicCode ? normalizeJoinCode(publicCode) : '';
  if (normalizedPublicCode) {
    const meeting = await Meeting.findOne({ joinCode: normalizedPublicCode })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id')
      .lean();
    if (meeting?._id) return meeting._id.toString();
  }

  const value = String(idOrCode || '').trim();
  if (!value) return null;

  if (Types.ObjectId.isValid(value)) {
    const meeting = await Meeting.findById(value).select('_id joinCode').lean();
    if (!meeting?._id) return null;

    if (meeting.joinCode) {
      const canonicalByCode = await resolveCanonicalMeetingId(meeting.joinCode);
      if (canonicalByCode) return canonicalByCode;
    }

    return meeting._id.toString();
  }

  return resolveCanonicalMeetingId(value);
}

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

function broadcastRoomPeers(meetingId: string) {
  const room = rooms.get(meetingId);
  if (!room) return;
  const peerList = Array.from(room.entries()).map(([pid, p]) => ({
    peerId: pid,
    userId: p.userId,
    name: p.name,
    avatarUrl: p.avatarUrl,
  }));
  for (const peer of room.values()) {
    send(peer.socket, { type: 'room-peers', peers: peerList });
  }
}

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

    //  JOIN 
    if (type === 'join') {
      // meetingId is the MongoDB id. roomId/joinCode are public codes used to
      // collapse any duplicate room docs into one canonical signaling room.
      const { token, meetingId: mid, roomId, joinCode } = data;
      const resolvedMeetingId = mid || roomId || joinCode;
      
      if (!token || !resolvedMeetingId) {
        return send(ws, { type: 'error', message: 'token and meetingId required' });
      }

      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return send(ws, { type: 'error', message: 'Invalid token' });
      }

      const user = await User.findById(decoded.userId).catch(() => null);
      if (!user) return send(ws, { type: 'error', message: 'User not found' });

      const canonicalMeetingId = await resolveCanonicalMeetingRoom(resolvedMeetingId, joinCode || roomId);
      if (!canonicalMeetingId) {
        return send(ws, { type: 'error', message: 'Meeting not found' });
      }

      const userId = user._id.toString();
      peerId = randomUUID();
      // Use the MongoDB _id for every signaling room, no matter whether the
      // client joined with _id, meetingId, roomId, or a public join code.
      meetingId = canonicalMeetingId;

      console.log(`[Signaling] User ${user.name} (${userId}) joining room: ${meetingId} as peer ${peerId}`);

      if (!rooms.has(meetingId)) rooms.set(meetingId, new Map());
      const room = rooms.get(meetingId)!;

      // Replace existing socket if reconnecting
      room.set(peerId, {
        socket: ws,
        userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      // Update DB participant
      try {
        await Participant.findOneAndUpdate(
          { meetingId: new Types.ObjectId(meetingId), userId: new Types.ObjectId(userId) },
          { joinedAt: new Date(), $unset: { leftAt: '' } },
          { upsert: true }
        );
      } catch (err) {
        console.error('[Signaling] Failed to update participant join in DB:', err);
      }

      // Tell the new peer who is already in the room
      const existingPeers = Array.from(room.entries())
        .filter(([pid]) => pid !== peerId)
        .map(([pid, p]) => ({ peerId: pid, userId: p.userId, name: p.name, avatarUrl: p.avatarUrl }));

      send(ws, { type: 'joined', peerId, userId, existingPeers });

      // Tell everyone else a new peer joined
      broadcastToRoom(meetingId, peerId, {
        type: 'peer-joined',
        peerId,
        userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
      broadcastRoomPeers(meetingId);

      return;
    }

    // All subsequent messages require an authenticated peer
    if (!peerId || !meetingId) {
      return send(ws, { type: 'error', message: 'Not joined. Send join first.' });
    }

    //  OFFER (caller -> callee via server relay) 
    if (type === 'offer') {
      const { targetPeerId, sdp } = data;
      const room = rooms.get(meetingId);
      const target = room?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'offer', fromPeerId: peerId, sdp });
      }
      return;
    }

    //  ANSWER (callee -> caller via server relay) 
    if (type === 'answer') {
      const { targetPeerId, sdp } = data;
      const room = rooms.get(meetingId);
      const target = room?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'answer', fromPeerId: peerId, sdp });
      }
      return;
    }

    //  ICE CANDIDATE (relay between peers) 
    if (type === 'ice-candidate') {
      const { targetPeerId, candidate } = data;
      const room = rooms.get(meetingId);
      const target = room?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: 'ice-candidate', fromPeerId: peerId, candidate });
      }
      return;
    }

    //  MEDIA STATE (mute/video toggle broadcast) 
    if (type === 'media-state') {
      const { audioEnabled, videoEnabled } = data;
      broadcastToRoom(meetingId, peerId, {
        type: 'peer-media-state',
        peerId,
        audioEnabled,
        videoEnabled,
      });
      return;
    }

    //  LEAVE 
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

  const peer = room.get(pid);
  room.delete(pid);
  if (room.size === 0) rooms.delete(roomId);

  broadcastToRoom(roomId, pid, { type: 'peer-left', peerId: pid, userId: peer?.userId });
  broadcastRoomPeers(roomId);

  try {
    // roomId is a string, Participant model expects ObjectId
    if (!peer?.userId) return;
    const sameUserStillConnected = Array.from(room.values()).some((activePeer) => activePeer.userId === peer.userId);
    if (sameUserStillConnected) return;

    await Participant.findOneAndUpdate(
      { meetingId: new Types.ObjectId(roomId), userId: new Types.ObjectId(peer.userId) },
      { leftAt: new Date() }
    );
  } catch (err) {
    console.error('[Signaling] Failed to update participant cleanup in DB:', err);
  }
}
