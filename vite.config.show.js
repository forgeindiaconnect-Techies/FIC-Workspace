import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig({
  cacheDir: path.resolve(__dirname, 'node_modules/.vite/show'),
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3060,
    cors: true,
  },
  preview: {
    port: 3060,
    cors: true,
  },
  build: {
    outDir: 'dist/show',
    target: 'esnext'
  }
});
