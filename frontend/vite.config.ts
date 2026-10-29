import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
// Ports come from the central registry (slot 04).
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5204,
    strictPort: true,
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3104' },
  },
});
