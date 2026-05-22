import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
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
      const { token, roomId } = data;
      if (!token || !roomId) {
        return send(ws, { type: 'error', message: 'token and roomId required' });
      }

      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return send(ws, { type: 'error', message: 'Invalid token' });
      }

      const user = await User.findById(decoded.userId).catch(() => null);
      if (!user) return send(ws, { type: 'error', message: 'User not found' });

      peerId = user._id.toString();
      meetingId = roomId;

      if (!rooms.has(meetingId)) rooms.set(meetingId, new Map());
      const room = rooms.get(meetingId)!;

      // Replace existing socket if reconnecting
      room.set(peerId, {
        socket: ws,
        userId: peerId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

      // Update DB participant
      await Participant.findOneAndUpdate(
        { meetingId, userId: peerId },
        { joinedAt: new Date(), $unset: { leftAt: '' } },
        { upsert: true }
      ).catch(() => {});

      // Tell the new peer who is already in the room
      const existingPeers = Array.from(room.entries())
        .filter(([pid]) => pid !== peerId)
        .map(([pid, p]) => ({ peerId: pid, name: p.name, avatarUrl: p.avatarUrl }));

      send(ws, { type: 'joined', peerId, existingPeers });

      // Tell everyone else a new peer joined
      broadcastToRoom(meetingId, peerId, {
        type: 'peer-joined',
        peerId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });

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

  room.delete(pid);
  if (room.size === 0) rooms.delete(roomId);

  broadcastToRoom(roomId, pid, { type: 'peer-left', peerId: pid });

  await Participant.findOneAndUpdate(
    { meetingId: roomId, userId: pid },
    { leftAt: new Date() }
  ).catch(() => {});
}
