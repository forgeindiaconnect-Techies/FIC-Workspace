import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(rootDir, 'backend-fastify', 'src', 'index.ts');
const outDir = path.join(rootDir, 'backend-fastify', 'dist');
const outfile = path.join(outDir, 'index.js');

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
