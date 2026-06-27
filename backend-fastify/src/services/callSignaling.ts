import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secure-key-change-in-production';

// email -> WebSocket (one connection per logged-in user)
const onlineUsers = new Map<string, WebSocket>();

function send(ws: WebSocket, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}


/**
 * Handles 1-to-1 voice call signaling.
 * Completely separate from /ws/webrtc (meeting room signaling).
 *
 * Message types received from client:
 *   register        { token }
 *   call_user       { targetEmail, offer (SDP), callerName }
 *   call_answer     { targetEmail, answer (SDP) }
 *   call_declined   { targetEmail }
 *   call_ended      { targetEmail }
 *   ice_candidate   { targetEmail, candidate }
 */
export function handleCallSignaling(ws: WebSocket) {
  let registeredEmail: string | null = null;

  ws.on('message', (raw: Buffer | string) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const { type, data = {} } = msg;

    //  REGISTER 
    if (type === 'register') {
      const { token } = data;
      if (!token) return send(ws, { type: 'error', message: 'token required' });

      let decoded: any;
      try { decoded = jwt.verify(token, JWT_SECRET); }
      catch { return send(ws, { type: 'error', message: 'invalid token' }); }

      const email = (decoded.email || '').toLowerCase().trim();
      if (!email) return send(ws, { type: 'error', message: 'email missing from token' });

      // Close any stale connection for this email
      // Track the newest connection without forcefully closing the old one,
      // preventing infinite reconnect loops across multiple tabs.
      const existing = onlineUsers.get(email);
      if (existing && existing !== ws) {
        console.log(`[CallSignaling] User ${email} connected from a new session.`);
      }

      registeredEmail = email;
      onlineUsers.set(email, ws);
      console.log(`[CallSignaling] User registered: ${email}`);
      send(ws, { type: 'registered', email });
      return;
    }

    // All subsequent messages require registration
    if (!registeredEmail) {
      return send(ws, { type: 'error', message: 'not registered, send register first' });
    }

    //  CALL_USER (Caller  Callee) 
    if (type === 'call_user') {
      const { targetEmail, offer, callerName, isVideo } = data;
      if (!targetEmail || !offer) {
        return send(ws, { type: 'error', message: 'targetEmail and offer required' });
      }

      const normalizedTarget = targetEmail.toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      
      if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
        // Callee is offline/backgrounded. Send a high-priority push notification to wake up their mobile device!
        console.log(`[CallSignaling] Target ${normalizedTarget} is offline. Sending wake-up push notification.`);
        
        try {
          const { sendPushNotification } = require('./pushNotifications');
          sendPushNotification(
            [normalizedTarget],
            `Incoming Call`,
            `${callerName || registeredEmail} is calling you...`,
            {
              type: 'incoming_call',
              callerEmail: registeredEmail,
              callerName: callerName || registeredEmail,
              offer,
              isVideo: isVideo || false
            }
          );
        } catch (err) {
          console.warn('[CallSignaling] Failed to send wake-up push notification:', err);
        }

        // Do NOT send call_unavailable immediately, letting the caller dial (ring) while the callee's device wakes up
        return;
      }

      console.log(`[CallSignaling] Relaying call from ${registeredEmail} to ${normalizedTarget}`);
      send(targetWs, {
        type: 'incoming_call',
        callerEmail: registeredEmail,
        callerName: callerName || registeredEmail,
        offer,
        isVideo: isVideo || false
      });
      return;
    }

    //  CALL_ANSWER (Callee  Caller) 
    if (type === 'call_answer') {
      const { targetEmail, answer } = data;
      if (!targetEmail || !answer) return;

      const normalizedTarget = targetEmail.toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        console.log(`[CallSignaling] Relaying answer from ${registeredEmail} to ${normalizedTarget}`);
        send(targetWs, {
          type: 'call_answered',
          calleeEmail: registeredEmail,
          answer,
        });
      }
      return;
    }

    //  CALL_DECLINED 
    if (type === 'call_declined') {
      const { targetEmail } = data;
      const normalizedTarget = (targetEmail || '').toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        console.log(`[CallSignaling] Call declined from ${registeredEmail} to ${normalizedTarget}`);
        send(targetWs, { type: 'call_declined', calleeEmail: registeredEmail });
      }
      return;
    }

    //  CALL_ENDED 
    if (type === 'call_ended') {
      const { targetEmail } = data;
      const normalizedTarget = (targetEmail || '').toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        console.log(`[CallSignaling] Call ended from ${registeredEmail} to ${normalizedTarget}`);
        send(targetWs, { type: 'call_ended' });
      }
      return;
    }

    //  ICE_CANDIDATE (relay during connection setup) 
    if (type === 'ice_candidate') {
      const { targetEmail, candidate } = data;
      if (!targetEmail || !candidate) return;

      const normalizedTarget = targetEmail.toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        send(targetWs, { type: 'ice_candidate', fromEmail: registeredEmail, candidate });
      }
      return;
    }
  });

  ws.on('close', () => {
    if (registeredEmail) {
      // Only remove if this is still the active socket for this email
      if (onlineUsers.get(registeredEmail) === ws) {
        onlineUsers.delete(registeredEmail);
        console.log(`[CallSignaling] User disconnected: ${registeredEmail}`);
      }
    }
  });

  ws.on('error', () => {
    if (registeredEmail && onlineUsers.get(registeredEmail) === ws) {
      onlineUsers.delete(registeredEmail);
      console.log(`[CallSignaling] Error on connection: ${registeredEmail}`);
    }
  });
}
