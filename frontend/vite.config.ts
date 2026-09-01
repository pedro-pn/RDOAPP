import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

  return {
    base: '/',
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        },
        '/assets': {
          target: apiTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true
        },
        '/relatorios': {
          target: apiTarget,
          changeOrigin: true
        },
        '/certificados-calibracao': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 4173
    }
  };
});
