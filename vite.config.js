import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  define: {
    global: 'window',
    'process.env': {},
  },
  resolve: {
    alias: {
      events: 'events',
      stream: 'stream-browserify',
      util: 'util/',
      process: 'process/browser',
      buffer: 'buffer',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
