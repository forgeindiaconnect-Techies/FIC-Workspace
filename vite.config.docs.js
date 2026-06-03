import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3040,
    cors: true,
  },
  preview: {
    port: 3040,
    cors: true,
  },
  build: {
    outDir: 'dist/docs',
    target: 'esnext'
  }
});
