import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Kuriant projektą API užklausos perduodamos vietiniam serveriui su tuo pačiu slapuku.
  server: {
    proxy: { '/api': { target: process.env.API_PROXY_TARGET || `http://127.0.0.1:${process.env.PORT || 3001}` } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
  },
});
