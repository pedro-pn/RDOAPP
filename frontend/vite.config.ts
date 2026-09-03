import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000';

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true
        },
        '/assets': {
          target: apiProxyTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: apiProxyTarget,
          changeOrigin: true
        },
        '/relatorios': {
          target: apiProxyTarget,
          changeOrigin: true
        },
        '/certificados-calibracao': {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 4173
    }
  };
});
