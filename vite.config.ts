import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 8080,
    host: '0.0.0.0',
    strictPort: true,
  },
  preview: {
    port: Number(process.env.PORT) || 8080,
    host: '0.0.0.0',
    strictPort: true,
  }
});