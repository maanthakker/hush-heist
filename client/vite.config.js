import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Game rules live in ../server/shared so the browser and the server run the exact same code.
const shared = fileURLToPath(new URL('../server/shared', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  server: { port: 5173, fs: { allow: ['..'] } },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
