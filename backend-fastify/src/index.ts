import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

// Load .env from backend-fastify folder (works when started via root server.js too)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

import multipart from '@fastify/multipart';
import { authRoutes } from './routes/auth';
import { meetingRoutes } from './routes/meetings';
import { mailRoutes } from './routes/mail';
import { channelRoutes, kuralRoutes } from './routes/kural';
import { memberRoutes } from './routes/members';
import { taskRoutes } from './routes/tasks';
import { docsRoutes } from './routes/docs';
import { showRoutes } from './routes/show';
import { superadminRoutes } from './routes/superadmin';
import { statusRoutes } from './routes/status';
import { threadsRoutes } from './routes/threads';
import { handleWebRtcSignalling } from './services/webrtc';
import { handleCallSignaling } from './services/callSignaling';
import { handleMailSocket } from './services/mailSockets';
import { handleAudioSocket } from './services/aiBot';
import { handleThreadsSocket } from './services/threadSockets';
import { ensureDefaultUser } from './utils/seedDefaultUser';
import { connectMongo, getLastMongoError, isMongoConnected, validateMongoUri } from './utils/mongo';
import { loadSecurityConfig, getIceServers } from './utils/securityConfig';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-zoom';
const ENABLE_SOCKET_FILE_LOGS = process.env.ENABLE_SOCKET_FILE_LOGS === 'true';

const isRenderHost = !!(process.env.RENDER || process.env.RENDER_SERVICE_NAME);
const isProduction = process.env.NODE_ENV === 'production' || isRenderHost;
const isDefaultLocalUri = !process.env.MONGO_URI || MONGO_URI.includes('127.0.0.1');

// SECURITY: Validate all required environment variables at startup
const securityConfig = loadSecurityConfig();

const server = fastify({
  logger: isProduction
    ? { level: 'info' }
    : {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
          },
        },
      },
});

// 1. ESTABLISH MONGODB ATLAS CONNECTIVITY
async function connectDatabase() {
  if (isRenderHost && isDefaultLocalUri) {
    const msg =
      'MONGO_URI is not set on Render. Add your MongoDB Atlas connection string in Environment variables.';
    server.log.error(msg);
    throw new Error(msg);
  }

  const uriCheck = validateMongoUri(MONGO_URI);
  if (uriCheck) {
    server.log.error(uriCheck);
    throw new Error(uriCheck);
  }

  const maxAttempts = isProduction ? 5 : 1;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await connectMongo(MONGO_URI, server.log);
      await ensureDefaultUser();
      server.log.info('Default admin account is ready.');
      return;
    } catch (err: any) {
      lastErr = err;
      server.log.warn(`MongoDB connect attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }

  server.log.error(
    'Server starting WITHOUT MongoDB. Login/sign-up disabled until MONGO_URI is fixed. ' +
      'Atlas: reset DB password (no @), allow 0.0.0.0/0, update Render MONGO_URI.'
  );
  if (lastErr) {
    server.log.error(lastErr.message);
  }
}

// 2. REGISTER INJECTED COMPONENT PLUGINS
async function bootstrap() {
  // CORS compliance rules — restrict to allowed origins in production
  const corsOrigin = securityConfig.corsAllowedOrigins.length > 0
    ? securityConfig.corsAllowedOrigins
    : isProduction
      ? ['https://workspace-blue-theta-87.vercel.app', 'http://localhost:8081', 'http://localhost:3000']  // Allow the deployed frontend and local dev ports
      : true;  // Allow all in development

  await server.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'x-speaker-name'],
  });

  server.addHook('onRequest', async (request, reply) => {
    if (!ENABLE_SOCKET_FILE_LOGS) return;
    try {
      const logFile = path.join(__dirname, '../../socket_debug.log');
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] [onRequest Hook] URL: "${request.url}", Method: "${request.method}", IP: "${request.ip}", Headers: ${JSON.stringify(request.headers)}\n`);
    } catch (e) {
      console.error("Failed to write to socket_debug.log inside onRequest hook:", e);
    }
  });

  // Log responses so we can correlate request -> status for debugging 404s
  server.addHook('onResponse', async (request, reply) => {
    if (!ENABLE_SOCKET_FILE_LOGS) return;
    try {
      const logFile = path.join(__dirname, '../../socket_debug.log');
      const entry = `[${new Date().toISOString()}] [onResponse Hook] URL: "${request.url}", Method: "${request.method}", Status: "${reply.statusCode}", ResponseTimeMs: "${reply.getResponseTime ? reply.getResponseTime() : 'n/a'}"\n`;
      fs.appendFileSync(logFile, entry);
    } catch (e) {
      console.error("Failed to write to socket_debug.log inside onResponse hook:", e);
    }
  });

  // Fastify Websocket plugin integration
  await server.register(websocket);

  // Fastify multipart parser for file uploads (Cloudinary upload support)
  await server.register(multipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: 250 * 1024 * 1024,
      files: 1,
    },
  });

  // Accept raw binary bodies for mobile audio chunk uploads
  server.addContentTypeParser('audio/m4a', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
  server.addContentTypeParser('audio/webm', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
  server.addContentTypeParser('audio/mp4', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
  server.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  // 3. REGISTER REST API MODULES
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(meetingRoutes, { prefix: '/api/meetings' });
  await server.register(mailRoutes, { prefix: '/api/mail' });
  await server.register(channelRoutes, { prefix: '/api/channels' });
  await server.register(kuralRoutes, { prefix: '/api/chat' });
  await server.register(memberRoutes, { prefix: '/api/members' });
  await server.register(taskRoutes, { prefix: '/api/tasks' });
  await server.register(docsRoutes, { prefix: '/api/docs' });
  await server.register(showRoutes, { prefix: '/api/show' });
  await server.register(superadminRoutes, { prefix: '/api/superadmin' });
  await server.register(statusRoutes, { prefix: '/api/status' });
  await server.register(threadsRoutes, { prefix: '/api/threads' });

  // 3b. ICE / TURN server config endpoint — credentials from environment
  server.get('/api/meet/ice-servers', async () => {
    return getIceServers();
  });

  // ── WebSocket Authentication Helper ──────────────────────────────────────
  function authenticateWs(connection: any, req: any): any | null {
    const ws = connection.socket || connection;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) {
        ws.close(4001, 'Authentication required: token query parameter missing');
        return null;
      }
      const decoded = jwt.verify(token, securityConfig.jwtSecret) as any;
      if (!decoded || !decoded.userId) {
        ws.close(4001, 'Authentication failed: invalid token');
        return null;
      }
      return { ws, user: decoded };
    } catch (err: any) {
      ws.close(4001, err.name === 'TokenExpiredError' ? 'Token expired' : 'Authentication failed');
      return null;
    }
  }

  // 4. ATTACH WEBRTC SIGNALLING & MAIL SOCKET CHANNELS (with JWT auth)
  server.get('/ws/webrtc', { websocket: true }, (connection: any, req: any) => {
    const auth = authenticateWs(connection, req);
    if (!auth) return;
    server.log.info(`Authenticated WebRTC client: ${auth.user.email}`);
    handleWebRtcSignalling(auth.ws);
  });

  server.get('/ws/mail', { websocket: true }, (connection: any, req: any) => {
    const auth = authenticateWs(connection, req);
    if (!auth) return;
    server.log.info(`Authenticated Mail Socket: ${auth.user.email}`);
    handleMailSocket(auth.ws, req);
  });

  server.get('/ws/audio', { websocket: true }, (connection: any, req: any) => {
    const auth = authenticateWs(connection, req);
    if (!auth) return;
    handleAudioSocket(auth.ws);
  });

  server.get('/ws/threads', { websocket: true }, (connection: any, req: any) => {
    const auth = authenticateWs(connection, req);
    if (!auth) return;
    handleThreadsSocket(auth.ws, req);
  });

  // 4b. 1-to-1 VOICE CALL SIGNALING (Chat module — completely separate from /ws/webrtc)
  server.get('/ws/calls', { websocket: true }, (connection: any, req: any) => {
    const auth = authenticateWs(connection, req);
    if (!auth) return;
    server.log.info(`Authenticated voice call signaling: ${auth.user.email}`);
    handleCallSignaling(auth.ws);
  });

  // Status check endpoint
  server.get('/health', async () => {
    const connected = isMongoConnected();
    return {
      status: connected ? 'healthy' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
      mongoConfigured: !isDefaultLocalUri,
      mongoError: connected ? undefined : getLastMongoError(),
      hint: connected
        ? undefined
        : isDefaultLocalUri
          ? 'Add MONGO_URI in Render Environment (MongoDB Atlas connection string).'
          : 'Atlas: allow 0.0.0.0/0 in Network Access; reset DB password; encode @ as %40 in MONGO_URI.',
    };
  });

  // Start server listening first, so Render's port scan succeeds immediately
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n======================================================`);
    console.log(` NEXUS ZOOM MEETINGS BACKEND SERVER RUNNING LIVE!`);
    console.log(` REST API Root : http://localhost:${PORT}/api`);
    console.log(` WebRTC Socket : ws://localhost:${PORT}/ws/webrtc`);
    console.log(` Health Status : http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Connect Database in the background to prevent blocking port binding
  connectDatabase().catch((err) => {
    server.log.error(`Database connection bootstrap failed: ${err.message}`);
  });
}

bootstrap();
