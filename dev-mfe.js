import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define Services to run
const SERVICES = [
  // ─── Downstream Microservices ───
  { name: 'Auth-Service  ', command: 'node', args: ['microservices/auth/server.js'], color: '\x1b[33m' },       // Yellow
  { name: 'Mail-Service  ', command: 'node', args: ['microservices/mail/server.js'], color: '\x1b[35m' },       // Magenta
  { name: 'Meet-Service  ', command: 'node', args: ['microservices/meet/server.js'], color: '\x1b[36m' },       // Cyan
  { name: 'Chat-Service  ', command: 'node', args: ['microservices/chat/server.js'], color: '\x1b[32m' },       // Green
  { name: 'Socket-Service', command: 'node', args: ['microservices/sockets/server.js'], color: '\x1b[96m' },    // Bright Cyan
  { name: 'API-Gateway   ', command: 'node', args: ['microservices/gateway/server.js'], color: '\x1b[91m' },    // Bright Red

  // ─── Frontend Microfrontends ───
  { name: 'Shell-MFE     ', command: 'npx', args: ['vite', '--config', 'vite.config.shell.js'], color: '\x1b[94m' }, // Bright Blue
  { name: 'Mail-MFE      ', command: 'npx', args: ['vite', '--config', 'vite.config.mail.js'], color: '\x1b[95m' },  // Bright Magenta
  { name: 'Meet-MFE      ', command: 'npx', args: ['vite', '--config', 'vite.config.meet.js'], color: '\x1b[92m' },  // Bright Green
  { name: 'Chat-MFE      ', command: 'npx', args: ['vite', '--config', 'vite.config.chat.js'], color: '\x1b[93m' },  // Bright Yellow
  { name: 'Docs-MFE      ', command: 'npx', args: ['vite', '--config', 'vite.config.docs.js'], color: '\x1b[97m' },  // White
  { name: 'Sheets-MFE    ', command: 'npx', args: ['vite', '--config', 'vite.config.sheets.js'], color: '\x1b[92m' }, // Green
  { name: 'Show-MFE      ', command: 'npx', args: ['vite', '--config', 'vite.config.show.js'], color: '\x1b[91m' }   // Red
];

const children = [];

console.log('\x1b[1m\x1b[96m');
console.log('==================================================================');
console.log('🌌  FORGE NEXUS - CONCURRENT MFE & MICROSERVICES ORCHESTRATOR    ');
console.log('==================================================================\x1b[0m\n');

function runService({ name, command, args, color }) {
  console.log(`\x1b[90m[Orchestrator] Starting ${name.trim()}...\x1b[0m`);
  
  // Use shell options to ensure compatibility on Windows command shell
  const child = spawn(command, args, {
    cwd: __dirname,
    shell: true,
    env: { ...process.env, FORCE_COLOR: 'true' }
  });

  child.stdout.on('data', (data) => {
    formatLog(name, color, data);
  });

  child.stderr.on('data', (data) => {
    formatLog(name, '\x1b[31m', data); // Red for error logs
  });

  child.on('close', (code) => {
    console.log(`\x1b[31m[Orchestrator] ${name.trim()} closed with code ${code}\x1b[0m`);
  });

  children.push(child);
}

function formatLog(serviceName, color, data) {
  const text = data.toString().trim();
  if (!text) return;
  
  const lines = text.split('\n');
  lines.forEach(line => {
    console.log(`${color}[${serviceName}]\x1b[0m ${line}`);
  });
}

// Start all processes
SERVICES.forEach(runService);

// Safe cleanup of all child processes on exit
const cleanup = () => {
  console.log('\n\x1b[1m\x1b[93m[Orchestrator] Gracefully shutting down all processes...\x1b[0m');
  children.forEach((child) => {
    try {
      child.kill('SIGTERM');
    } catch (e) {
      // Ignored
    }
  });
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m[Orchestrator] Uncaught Exception:\x1b[0m', err.message);
  cleanup();
});
