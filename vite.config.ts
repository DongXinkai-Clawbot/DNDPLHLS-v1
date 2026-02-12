import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { visualizer } from 'rollup-plugin-visualizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  const analyze = process.env.ANALYZE === '1';
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8787';

  // Only attempt to load local HTTPS certificates when running the dev server.
  // In CI / build environments these files won't exist.
  const https = (() => {
    if (command !== 'serve') return undefined;

    const keyPath = env.VITE_HTTPS_KEY;
    const certPath = env.VITE_HTTPS_CERT;
    if (!keyPath || !certPath) return undefined;

    try {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    } catch {
      return undefined;
    }
  })();

  return {
    
    base: './', 

    server: {
      port: 3000,
      host: '0.0.0.0',

      ...(https ? { https } : {}),
      proxy: {
        '/v1': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    plugins: [
      react(),
      ...(analyze
        ? [
            visualizer({
              filename: 'reports/bundle.html',
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],

    optimizeDeps: {
      entries: ['index.html'],
    },

    build: {
      sourcemap: false,
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
