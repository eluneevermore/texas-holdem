import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3001',
      '/rooms': 'http://localhost:3001',
      '/me': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
