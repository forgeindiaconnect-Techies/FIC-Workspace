const fs = require('fs');
const path = require('path');
const log = fs.readFileSync(path.join(__dirname, '..', 'socket_debug.log'), 'utf8');
const m = log.match(/Bearer\s+([A-Za-z0-9-_=.]+)/);
if (!m) { console.error('No Bearer token found'); process.exit(1); }
const token = m[1].trim();
console.log('Token:', token);
const parts = token.split('.');
if (parts.length < 2) { console.error('Invalid token format'); process.exit(1); }
function b64ToJson(b64) {
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const buf = Buffer.from(b64, 'base64');
  try { return JSON.parse(buf.toString('utf8')); } catch (e) { return buf.toString('utf8'); }
}
console.log('Header:', JSON.stringify(b64ToJson(parts[0]), null, 2));
console.log('Payload:', JSON.stringify(b64ToJson(parts[1]), null, 2));
