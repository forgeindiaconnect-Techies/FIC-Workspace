import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environmental parameters
dotenv.config();

import { authRoutes } from './routes/auth';
import { meetingRoutes } from './routes/meetings';
import { mailRoutes } from './routes/mail';
import { channelRoutes, kuralRoutes } from './routes/kural';
import { memberRoutes } from './routes/members';
import { handleWebRtcSignalling } from './services/webrtc';
import { handleMailSocket } from './services/mailSockets';
import { ensureDefaultUser } from './utils/seedDefaultUser';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-zoom';
const ENABLE_SOCKET_FILE_LOGS = process.env.ENABLE_SOCKET_FILE_LOGS === 'true';

const isProduction = process.env.NODE_ENV === 'production';

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
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000 // Timeout fast (5s) instead of hanging indefinitely
    });
    server.log.info('Mongoose successfully established Atlas MongoDB connection.');
    try {
      await ensureDefaultUser();
      server.log.info('Default admin account is ready.');
    } catch (seedErr: any) {
      server.log.warn('Could not ensure default admin account: ' + seedErr.message);
    }
  } catch (err: any) {
    server.log.error('Mongoose failed connecting to MongoDB: ' + err.message);
    server.log.warn('Continuing server execution in offline/fallback mode.');
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
  server.get('/health', async (request: any, reply: any) => {
    return { status: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' };
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
