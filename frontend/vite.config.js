import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:3001';
  const socketUrl = env.VITE_SOCKET_URL || process.env.VITE_SOCKET_URL || apiUrl;

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
      'import.meta.env.VITE_API_URL': `((typeof window !== "undefined") ? ((() => {
        const custom = localStorage.getItem("verity_server_url") || localStorage.getItem("verity_cloud_url");
        if (custom && custom.trim()) return custom.trim().replace(/\\/$/, "");
        if (window.location && window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.protocol.startsWith("http")) {
          return window.location.protocol + "//" + window.location.hostname + ":3001";
        }
        return "${apiUrl}";
      })()) : "${apiUrl}")`,
      'import.meta.env.VITE_SOCKET_URL': `((typeof window !== "undefined") ? ((() => {
        const custom = localStorage.getItem("verity_server_url") || localStorage.getItem("verity_cloud_url");
        if (custom && custom.trim()) return custom.trim().replace(/\\/$/, "");
        if (window.location && window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.protocol.startsWith("http")) {
          return window.location.protocol + "//" + window.location.hostname + ":3001";
        }
        return "${socketUrl}";
      })()) : "${socketUrl}")`
    }
  };
})