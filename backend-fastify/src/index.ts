import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env from backend-fastify folder (works when started via root server.js too)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

import { authRoutes } from './routes/auth';
import { meetingRoutes } from './routes/meetings';
import { mailRoutes } from './routes/mail';
import { channelRoutes, kuralRoutes } from './routes/kural';
import { memberRoutes } from './routes/members';
import { handleWebRtcSignalling } from './services/webrtc';
import { handleMailSocket } from './services/mailSockets';
import { ensureDefaultUser } from './utils/seedDefaultUser';
import { connectMongo, getLastMongoError, isMongoConnected, validateMongoUri } from './utils/mongo';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-zoom';
const ENABLE_SOCKET_FILE_LOGS = process.env.ENABLE_SOCKET_FILE_LOGS === 'true';

const isRenderHost = !!(process.env.RENDER || process.env.RENDER_SERVICE_NAME);
const isProduction = process.env.NODE_ENV === 'production' || isRenderHost;
const isDefaultLocalUri = !process.env.MONGO_URI || MONGO_URI.includes('127.0.0.1');

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
  // CORS compliance rules
  await server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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

  // 3. REGISTER REST API MODULES
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(meetingRoutes, { prefix: '/api/meetings' });
  await server.register(mailRoutes, { prefix: '/api/mail' });
  await server.register(channelRoutes, { prefix: '/api/channels' });
  await server.register(kuralRoutes, { prefix: '/api/chat' });
  await server.register(memberRoutes, { prefix: '/api/members' });

  // 4. ATTACH WEBRTC SIGNALLING & MAIL SOCKET CHANNELS
  server.get('/ws/webrtc', { websocket: true }, (connection: any, req: any) => {
    server.log.info('New secure WebRTC client socket handshake initiated.');
    handleWebRtcSignalling(connection.socket);
  });

  server.get('/ws/mail', { websocket: true }, (connection: any, req: any) => {
    server.log.info('New secure Mail Socket connection initiated.');
    handleMailSocket(connection.socket, req);
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

  // Connect Database and launch Server port list
  await connectDatabase();

  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n======================================================`);
    console.log(`🚀 NEXUS ZOOM MEETINGS BACKEND SERVER RUNNING LIVE!`);
    console.log(`🔗 REST API Root : http://localhost:${PORT}/api`);
    console.log(`🔌 WebRTC Socket : ws://localhost:${PORT}/ws/webrtc`);
    console.log(`🏥 Health Status : http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

bootstrap();
