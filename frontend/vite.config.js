import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const isProd = mode === 'production' || process.env.NODE_ENV === 'production';
  const defaultApi = isProd ? 'https://the-verity.onrender.com' : 'http://localhost:3001';
  const apiUrl = (env.VITE_API_URL || process.env.VITE_API_URL || defaultApi).replace(/\/$/, '');
  const socketUrl = (env.VITE_SOCKET_URL || process.env.VITE_SOCKET_URL || apiUrl).replace(/\/$/, '');

  let appVersion = '1.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
    if (pkg.version) appVersion = pkg.version;
  } catch (_) {}

  return {
    base: './', // relative asset paths so the build works from file:// in Electron
    plugins: [react()],
    server: {
      host: true, // Listen on all network interfaces including LAN (0.0.0.0)
      port: 5173,
      strictPort: true, // This forces Vite to fail if 5173 isn't available
      proxy: {
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
      watch: {
        ignored: [
          '**/server/**',
          '**/temp_*/**',
          '**/bin/**',
          '**/obj/**',
        ],
      },
    },
    build: {
      outDir: path.resolve(__dirname, '../dist'),
      emptyOutDir: true,
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules') || id.includes('.worker')) return undefined;
            if (id.includes('monaco-editor')) return 'monaco-vendor';
            if (id.includes('jodit')) return 'jodit-vendor';
            if (id.includes('framer-motion')) return 'motion-vendor';
            if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'socket-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('react-dom') || /[\\/]react[\\/]/.test(id)) return 'react-vendor';
            return undefined;
          }
        }
      }
    },
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_SOCKET_URL': JSON.stringify(socketUrl),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '224892595118-lbmp59pc67u3e7968qhi78qdluvqt8kr.apps.googleusercontent.com')
    }
  };
})