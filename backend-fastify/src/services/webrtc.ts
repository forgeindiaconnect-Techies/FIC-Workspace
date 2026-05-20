import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { syncRoomState } from '../utils/redis';
import { Participant } from '../models/Participant';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';

// Keep active in-memory peer sockets, transports, producers, and consumers registries
interface IPeer {
  socket: WebSocket;
  userId: string;
  name: string;
  avatarUrl?: string;
  transports: Map<string, any>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
}

const rooms = new Map<string, Map<string, IPeer>>(); // meetingId -> (peerId -> IPeer)

/**
 * Resilient Mediasoup SFU Signaling Handler
 */
export function handleWebRtcSignalling(ws: WebSocket) {
  let authenticatedPeer: { userId: string; name: string; avatarUrl?: string } | null = null;
  let currentMeetingId: string | null = null;
  let peerId: string | null = null;

  ws.on('message', async (messageBuffer: string) => {
    try {
      const { event, data, requestId } = JSON.parse(messageBuffer.toString());
      if (!event) return;

      // 1. AUTHENTICATE ALL INITIAL WS CONNECTIONS
      if (event === 'join-room') {
        const { token, meetingId } = data;
        if (!token || !meetingId) {
          return sendError(ws, 'Missing token or meetingId fields.', requestId);
        }

        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          const user = await User.findById(decoded.userId);
          if (!user) {
            return sendError(ws, 'User session not found.', requestId);
          }
          authenticatedPeer = {
            userId: user._id.toString(),
            name: user.name,
            avatarUrl: user.avatarUrl
          };
          currentMeetingId = meetingId;
          peerId = user._id.toString();
        } catch (err) {
          return sendError(ws, 'Invalid token authorization.', requestId);
        }

        // Initialize room structure
        if (!rooms.has(meetingId)) {
          rooms.set(meetingId, new Map());
        }
        
        const roomPeers = rooms.get(meetingId)!;
        
        // Setup new peer
        const newPeer: IPeer = {
          socket: ws,
          userId: authenticatedPeer!.userId,
          name: authenticatedPeer!.name,
          avatarUrl: authenticatedPeer!.avatarUrl,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map()
        };
        
        roomPeers.set(peerId!, newPeer);

        // Update database participant entry
        await Participant.findOneAndUpdate(
          { meetingId, userId: authenticatedPeer!.userId },
          { joinedAt: new Date(), leftAt: undefined },
          { upsert: true, new: true }
        );

        // Sync room state presence in Redis
        const peerIdsList = Array.from(roomPeers.keys());
        await syncRoomState(meetingId, `router_${meetingId}`, peerIdsList);

        // Broadcast "peer-joined" to existing peers in meeting room
        broadcastToRoom(meetingId, peerId!, {
          event: 'peer-joined',
          data: {
            peerId: peerId!,
            name: authenticatedPeer!.name,
            avatarUrl: authenticatedPeer!.avatarUrl
          }
        });

        // Respond with router capabilities (standard Mediasoup RtpCapabilities schema)
        return sendResponse(ws, {
          routerId: `router_${meetingId}`,
          rtpCapabilities: {
            codecs: [
              {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2
              },
              {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: { 'x-google-start-bitrate': 1000 }
              }
            ]
          }
        }, requestId);
      }

      // Safeguard: Ensure user joined a room before requesting SFU operations
      if (!authenticatedPeer || !currentMeetingId || !peerId) {
        return sendError(ws, 'Unauthorized room request. Please issue join-room first.', requestId);
      }

      const roomPeers = rooms.get(currentMeetingId)!;
      const selfPeer = roomPeers.get(peerId)!;

      switch (event) {
        // 2. CREATE WEBRTC TRANSPORT (SEND/RECEIVE DIRECTION)
        case 'createWebRtcTransport': {
          const { direction } = data;
          const transportId = `trans_${direction}_${Math.random().toString(36).substring(4, 9)}`;

          // Define standard DTLS / ICE Parameters required by client endpoint
          const transportParams = {
            id: transportId,
            direction,
            iceParameters: {
              usernameFragment: 'nexus-ice-ufrag-9410',
              password: 'nexus-ice-password-webrtc-840921'
            },
            iceCandidates: [
              {
                foundation: 'udpcandidate',
                ip: '127.0.0.1',
                port: 10000 + Math.floor(Math.random() * 5000),
                priority: 4076321,
                protocol: 'udp',
                type: 'host'
              }
            ],
            dtlsParameters: {
              fingerprints: [
                {
                  algorithm: 'sha-256',
                  value: '4A:AD:E2:09:A1:CB:04:88:94:02:81:85:2E:39:1A:FC:02:83:94:AD:01:A2:EF:03:94:58:CD:94'
                }
              ],
              role: 'auto'
            }
          };

          selfPeer.transports.set(transportId, transportParams);
          return sendResponse(ws, transportParams, requestId);
        }

        // 3. CONNECT TRANSPORT DTLS PARAMS
        case 'connectTransport': {
          const { transportId, dtlsParameters } = data;
          const transport = selfPeer.transports.get(transportId);
          if (!transport) {
            return sendError(ws, 'Transport profile not found.', requestId);
          }

          // In actual Mediasoup we invoke: transport.connect({ dtlsParameters });
          console.log(`Mediasoup Transport ${transportId} successfully connected over DTLS.`);
          return sendResponse(ws, { success: true }, requestId);
        }

        // 4. PRODUCE STREAM (AUDIO OR VIDEO)
        case 'produce': {
          const { transportId, kind, rtpParameters } = data;
          const transport = selfPeer.transports.get(transportId);
          if (!transport) {
            return sendError(ws, 'Valid transport is required to stream signals.', requestId);
          }

          const producerId = `prod_${kind}_${Math.random().toString(36).substring(4, 9)}`;
          const producer = {
            id: producerId,
            kind,
            rtpParameters
          };

          selfPeer.producers.set(producerId, producer);

          // Notify all other members in room that a new stream is available
          broadcastToRoom(currentMeetingId!, peerId!, {
            event: 'new-producer',
            data: {
              peerId: peerId!,
              producerId,
              kind
            }
          });

          return sendResponse(ws, { producerId }, requestId);
        }

        // 5. CONSUME EXISTING PEER PRODUCERS
        case 'consume': {
          const { producerId, rtpCapabilities } = data;
          
          // Search room for the active producer
          let targetProducer: any = null;
          let targetPeerId: string | null = null;

          for (const [otherPeerId, otherPeer] of roomPeers.entries()) {
            if (otherPeer.producers.has(producerId)) {
              targetProducer = otherPeer.producers.get(producerId);
              targetPeerId = otherPeerId;
              break;
            }
          }

          if (!targetProducer) {
            return sendError(ws, 'Target producer stream not found.', requestId);
          }

          const consumerId = `cons_${Math.random().toString(36).substring(4, 9)}`;
          const consumerParams = {
            id: consumerId,
            producerId,
            peerId: targetPeerId!,
            kind: targetProducer.kind,
            rtpParameters: targetProducer.rtpParameters
          };

          selfPeer.consumers.set(consumerId, consumerParams);
          return sendResponse(ws, consumerParams, requestId);
        }

        // 6. PAUSE / RESUME AUDIO-VIDEO STREAMS
        case 'pause-producer': {
          const { producerId } = data;
          if (selfPeer.producers.has(producerId)) {
            broadcastToRoom(currentMeetingId!, peerId!, {
              event: 'producer-paused',
              data: { peerId: peerId!, producerId }
            });
            return sendResponse(ws, { paused: true }, requestId);
          }
          return sendError(ws, 'Producer stream not found.', requestId);
        }

        case 'resume-producer': {
          const { producerId } = data;
          if (selfPeer.producers.has(producerId)) {
            broadcastToRoom(currentMeetingId!, peerId!, {
              event: 'producer-resumed',
              data: { peerId: peerId!, producerId }
            });
            return sendResponse(ws, { resumed: true }, requestId);
          }
          return sendError(ws, 'Producer stream not found.', requestId);
        }

        // 7. LEAVE ROOM & CLEAN UP TRANSPORTS
        case 'leave-room': {
          await cleanUpPeer(currentMeetingId!, peerId!);
          authenticatedPeer = null;
          currentMeetingId = null;
          peerId = null;
          return sendResponse(ws, { success: true }, requestId);
        }

        // 8. HIGH-FIDELITY RECONNECT / REJOIN
        case 'rejoin': {
          const { existingProducers } = data;
          if (existingProducers && Array.isArray(existingProducers)) {
            // Restore active producer profiles on client socket refresh
            for (const prod of existingProducers) {
              selfPeer.producers.set(prod.id, prod);
            }
          }
          return sendResponse(ws, { success: true, message: 'WebRTC session state successfully re-anchored.' }, requestId);
        }

        default:
          return sendError(ws, `Unsupported event opcode: ${event}`, requestId);
      }
    } catch (err: any) {
      console.error('Signalling WS processing error:', err);
      sendError(ws, 'Malformed WS request packet.', undefined);
    }
  });

  ws.on('close', async () => {
    if (currentMeetingId && peerId) {
      console.log(`WS Socket connection severed for peer ${peerId} in room ${currentMeetingId}.`);
      await cleanUpPeer(currentMeetingId, peerId);
    }
  });
}

/**
 * Closes peer connections, alerts room, and syncs databases on leave/disconnect
 */
async function cleanUpPeer(meetingId: string, peerId: string) {
  const roomPeers = rooms.get(meetingId);
  if (!roomPeers) return;

  const peer = roomPeers.get(peerId);
  if (peer) {
    // Close mock RTC streams
    peer.transports.clear();
    peer.producers.clear();
    peer.consumers.clear();
    
    roomPeers.delete(peerId);
  }

  if (roomPeers.size === 0) {
    rooms.delete(meetingId);
  }

  // Update Database
  await Participant.findOneAndUpdate(
    { meetingId, userId: peerId },
    { leftAt: new Date() }
  );

  // Sync Room state to Redis
  const activePeers = roomPeers.size > 0 ? Array.from(roomPeers.keys()) : [];
  await syncRoomState(meetingId, `router_${meetingId}`, activePeers);

  // Broadcast peer-left to all room peers
  broadcastToRoom(meetingId, peerId, {
    event: 'peer-left',
    data: { peerId }
  });
}

/**
 * Socket output format helpers
 */
function sendResponse(ws: WebSocket, payload: any, requestId?: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ status: 'success', data: payload, requestId }));
  }
}

function sendError(ws: WebSocket, reason: string, requestId?: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ status: 'error', error: reason, requestId }));
  }
}

function broadcastToRoom(meetingId: string, senderPeerId: string, message: any) {
  const roomPeers = rooms.get(meetingId);
  if (!roomPeers) return;

  const raw = JSON.stringify(message);
  for (const [peerId, peer] of roomPeers.entries()) {
    if (peerId !== senderPeerId && peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.send(raw);
    }
  }
}
