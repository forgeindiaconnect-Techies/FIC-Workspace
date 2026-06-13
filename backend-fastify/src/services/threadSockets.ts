import type { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

// Mapping workspaceId -> Set of WebSockets
export const activeThreadSockets = new Map<string, Set<WebSocket>>();

export function handleThreadsSocket(socket: WebSocket, req: any) {
  const logFile = path.join(__dirname, '../../socket_debug.log');
  const log = (msg: string) => {
    try {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] [ThreadsSocket] ${msg}\n`);
    } catch (e) {}
  };

  let workspaceId = req.query?.workspaceId;
  
  if (!workspaceId && req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      workspaceId = url.searchParams.get('workspaceId') || undefined;
    } catch (e: any) {
      log(`Failed to parse URL: ${e.message}`);
    }
  }

  if (workspaceId) {
    log(`Established Threads Socket for workspace: ${workspaceId}`);
    if (!activeThreadSockets.has(workspaceId)) {
      activeThreadSockets.set(workspaceId, new Set());
    }
    activeThreadSockets.get(workspaceId)?.add(socket);
    
    socket.on('close', () => {
      log(`Threads Socket closed for workspace: ${workspaceId}`);
      activeThreadSockets.get(workspaceId!)?.delete(socket);
      if (activeThreadSockets.get(workspaceId!)?.size === 0) {
        activeThreadSockets.delete(workspaceId!);
      }
    });
    
    socket.on('error', (err) => {
      log(`Threads Socket error for workspace ${workspaceId}: ${err.message}`);
      activeThreadSockets.get(workspaceId!)?.delete(socket);
    });
  } else {
    log(`Closing socket: workspaceId missing`);
    socket.close(1008, 'workspaceId required');
  }
}

// Utility to broadcast events to a specific workspace
export function broadcastToWorkspace(workspaceId: string, eventType: string, payload: any) {
  const sockets = activeThreadSockets.get(workspaceId);
  if (!sockets) return;

  const message = JSON.stringify({ type: eventType, payload });
  Array.from(sockets).forEach(socket => {
    if (socket.readyState === 1) { // OPEN
      socket.send(message);
    }
  });
}
