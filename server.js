/**
 * Render start command entry point (`node server.js`).
 * Boots the Fastify API from backend-fastify/dist/index.js
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const backendEntry = path.join(rootDir, 'backend-fastify', 'dist', 'index.js');

if (!fs.existsSync(backendEntry)) {
  console.error(
    '[server.js] Backend not built. Run: npm run build:api\n' +
      `Missing file: ${backendEntry}`
  );
  process.exit(1);
}

require(backendEntry);
