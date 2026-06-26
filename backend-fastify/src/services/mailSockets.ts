import type { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

export const activeMailSockets = new Map<string, WebSocket>();

export function broadcastPresence() {
  const onlineEmails = Array.from(activeMailSockets.keys());
  const payload = JSON.stringify({ type: 'presence-update', onlineEmails });
  for (const socket of activeMailSockets.values()) {
    if (socket.readyState === 1) { // OPEN
      try {
        socket.send(payload);
      } catch (e) {}
    }
  }
}

export function handleMailSocket(socket: WebSocket, req: any) {
  const logFile = path.join(__dirname, '../../socket_debug.log');
  const log = (msg: string) => {
    try {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {}
  };

  log(`New connection attempt. req.url: "${req.url}", req.query: ${JSON.stringify(req.query)}`);

  let email = req.query?.email;
  
  if (!email && req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      email = url.searchParams.get('email') || undefined;
      log(`Parsed email from URL: "${email}"`);
    } catch (e: any) {
      log(`Failed to parse URL: ${e.message}`);
    }
  }
  
  if (email) {
    log(`Successfully established Mail Socket for user: ${email}`);
    activeMailSockets.set(email, socket);
    
    // Broadcast presence update immediately
    broadcastPresence();
    
    socket.on('close', (code, reason) => {
      log(`Mail Socket closed for user: ${email}. Code: ${code}, Reason: "${reason ? reason.toString() : ''}"`);
      activeMailSockets.delete(email);
      broadcastPresence();
    });
    
    socket.on('error', (err) => {
      log(`Mail Socket error for user ${email}: ${err.message}`);
      activeMailSockets.delete(email);
      broadcastPresence();
    });
  } else {
    log(`Closing socket: Email identifier missing or empty.`);
    socket.close(1008, 'Email identifier required');
  }
}

