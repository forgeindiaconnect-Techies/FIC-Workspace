import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(rootDir, 'backend-fastify', 'src', 'index.ts');
const outDir = path.join(rootDir, 'backend-fastify', 'dist');
const outfile = path.join(outDir, 'index.js');

// In production (Render), esbuild may be in root node_modules or backend-fastify/node_modules
let esbuild;
try {
  esbuild = createRequire(import.meta.url)('esbuild');
} catch {
  try {
    esbuild = createRequire(path.join(rootDir, 'backend-fastify', 'package.json'))('esbuild');
  } catch {
    esbuild = createRequire(path.join(rootDir, 'package.json'))('esbuild');
  }
}

fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});

console.log(`[build-backend] Wrote ${outfile}`);
