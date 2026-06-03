import express from 'express';
import cors from 'cors';
import http from 'http';
import httpProxy from 'http-proxy';

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'x-speaker-name']
}));

const proxy = httpProxy.createProxyServer({ changeOrigin: true });

proxy.on('error', (err, req, res) => {
  console.error('[Gateway Proxy Error]:', err.message);
  if (!res.headersSent && res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gateway Bad Request or Service Offline', details: err.message }));
  }
});

// Routing Map
const SERVICES = {
  auth: 'http://localhost:3101',
  mail: 'http://localhost:3102',
  meet: 'http://localhost:3103',
  chat: 'http://localhost:3104',
  sockets: 'http://localhost:3105'
};

// Route matching rules
app.use((req, res, next) => {
  const url = req.url;
  
  if (url.startsWith('/api/auth')) {
    proxy.web(req, res, { target: SERVICES.auth });
  } else if (url.startsWith('/api/mail')) {
    proxy.web(req, res, { target: SERVICES.mail });
  } else if (url.startsWith('/api/meetings') || url.startsWith('/api/meet')) {
    proxy.web(req, res, { target: SERVICES.meet });
  } else if (
    url.startsWith('/api/chat') || 
    url.startsWith('/api/channels') || 
    url.startsWith('/api/members') ||
    url.startsWith('/api/tasks') ||
    url.startsWith('/api/docs') ||
    url.startsWith('/api/show') ||
    url.startsWith('/api/status')
  ) {
    proxy.web(req, res, { target: SERVICES.chat });
  } else if (url.startsWith('/socket.io')) {
    proxy.web(req, res, { target: SERVICES.sockets });
  } else {
    next();
  }
});

// Gateway Health check
app.get('/health', async (req, res) => {
  const results = {};
  
  // Quick health checks for downstream services
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      results[name] = response.ok ? 'healthy' : 'unhealthy';
    } catch {
      results[name] = 'offline';
    }
  }
  
  res.json({
    status: Object.values(results).every(v => v === 'healthy') ? 'healthy' : 'degraded',
    services: results,
    timestamp: new Date().toISOString()
  });
});

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
});

// Delegate WebSocket Upgrade Events directly to Sockets Service
server.on('upgrade', (req, socket, head) => {
  const url = req.url;
  console.log(`[Gateway WS Upgrade] Routing upgrade for url: ${url}`);
  if (url.startsWith('/ws') || url.startsWith('/socket.io')) {
    proxy.ws(req, socket, head, { target: SERVICES.sockets.replace('http://', 'ws://') });
  } else {
    socket.destroy();
  }
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ENTERPRISE MICROSERVICES API GATEWAY LIVE ON PORT ${PORT}`);
  console.log(`🔗 Routing endpoints:`);
  console.log(`   - Auth     -> ${SERVICES.auth}`);
  console.log(`   - Mail     -> ${SERVICES.mail}`);
  console.log(`   - Meetings -> ${SERVICES.meet}`);
  console.log(`   - Chat     -> ${SERVICES.chat}`);
  console.log(`   - Sockets  -> ${SERVICES.sockets}`);
  console.log(`======================================================\n`);
});
