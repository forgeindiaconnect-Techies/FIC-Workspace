import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  root: path.resolve(__dirname, 'microfrontends/mail'),
  define: {
    global: 'window',
    'process.env': {},
  },
  server: {
    port: 3010,
    host: '0.0.0.0'
  },
})
