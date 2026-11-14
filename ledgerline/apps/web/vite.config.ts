import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiTarget = `http://127.0.0.1:${process.env.LL_API_PORT ?? 4310}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5310, strictPort: true, proxy: { '/api': apiTarget } },
  preview: { port: 5310, strictPort: true, proxy: { '/api': apiTarget } },
});
