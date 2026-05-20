const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const log = fs.readFileSync(path.join(__dirname, '..', 'socket_debug.log'), 'utf8');
const m = log.match(/Bearer\s+([A-Za-z0-9-_=.]+)/);
if (!m) { console.error('No Bearer token found'); process.exit(1); }
const token = m[1].trim();
// read .env
const env = fs.readFileSync(path.join(__dirname, '..', 'backend-fastify', '.env'), 'utf8');
const secretLine = env.split(/\r?\n/).find(l => l.startsWith('JWT_SECRET='));
const secret = secretLine ? secretLine.split('=')[1] : null;
console.log('Using secret from .env:', secret);
try {
  const decoded = jwt.verify(token, secret);
  console.log('Verified token payload:', decoded);
} catch (err) {
  console.error('Verification failed:', err.message);
}
