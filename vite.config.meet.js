import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig({
  cacheDir: path.resolve(__dirname, 'node_modules/.vite/meet'),
  plugins: [
    tailwindcss(),
    react(),
  ],
  root: path.resolve(__dirname, 'microfrontends/meet'),
  define: {
    global: 'window',
    'process.env': {},
  },
  server: {
    port: 3020,
    host: '0.0.0.0'
  },
})
