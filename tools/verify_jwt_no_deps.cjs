const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = fs.readFileSync(path.join(__dirname, '..', 'socket_debug.log'), 'utf8');
const m = log.match(/Bearer\s+([A-Za-z0-9-_=.]+)/);
if (!m) { console.error('No Bearer token found'); process.exit(1); }
const token = m[1].trim();
console.log('Token:', token);
const parts = token.split('.');
if (parts.length !== 3) { console.error('Invalid JWT'); process.exit(1); }
const [h64, p64, s64] = parts;
function b64urlToBase64(b){ return b.replace(/-/g,'+').replace(/_/g,'/'); }
function base64UrlEncode(buf){ return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
// read secret
const env = fs.readFileSync(path.join(__dirname, '..', 'backend-fastify', '.env'), 'utf8');
const secretLine = env.split(/\r?\n/).find(l => l.startsWith('JWT_SECRET='));
const secret = secretLine ? secretLine.split('=')[1] : null;
if(!secret){ console.error('No JWT_SECRET in .env'); process.exit(1); }
console.log('Using secret from .env:', secret);
const signingInput = h64 + '.' + p64;
const hmac = crypto.createHmac('sha256', secret).update(signingInput).digest();
const signature = base64UrlEncode(hmac);
console.log('Computed sig:', signature);
console.log('Token sig   :', s64);
if (signature === s64) console.log('Signature OK'); else console.log('Signature MISMATCH');
// Also decode payload and show iat/exp
function b64ToJson(b64){ b64 = b64urlToBase64(b64); while(b64.length%4) b64+='='; return JSON.parse(Buffer.from(b64,'base64').toString()); }
const payload = b64ToJson(p64);
console.log('Payload:', JSON.stringify(payload, null, 2));
const now = Math.floor(Date.now()/1000);
console.log('Now:', now, 'iat:', payload.iat, 'exp:', payload.exp);
if(payload.exp && payload.exp < now) console.log('Token expired'); else console.log('Token not expired');
