import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const isProd = mode === 'production' || process.env.NODE_ENV === 'production';
  const defaultApi = isProd ? 'https://verity-2z4v.onrender.com' : 'http://localhost:3001';
  const apiUrl = (env.VITE_API_URL || process.env.VITE_API_URL || defaultApi).replace(/\/$/, '');
  const socketUrl = (env.VITE_SOCKET_URL || process.env.VITE_SOCKET_URL || apiUrl).replace(/\/$/, '');

  return {
    base: './', // relative asset paths so the build works from file:// in Electron
    plugins: [react()],
    server: {
      host: true, // Listen on all network interfaces including LAN (0.0.0.0)
      port: 5173,
      strictPort: true, // This forces Vite to fail if 5173 isn't available
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
      emptyOutDir: false,
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_SOCKET_URL': JSON.stringify(socketUrl),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '6514928694-2rd8cu7b67o4f2jqtuv5hk1d51s97lcc.apps.googleusercontent.com')
    }
  };
})