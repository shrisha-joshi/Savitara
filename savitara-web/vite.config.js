import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // date-fns@3 does not export _lib/* in its package.json exports map.
      // Vite 6 enforces strict exports, so we alias the internal path to a
      // local shim that re-exports the named export as `default`.
      'date-fns/_lib/format/longFormatters': path.resolve(__dirname, 'src/_shims/date-fns-longFormatters.mjs'),
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Allow fallback to another port if 3000 is busy
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,  // SonarQube: S5765 — never expose source maps in production
    chunkSizeWarningLimit: 1000, // M64 fix: flag bundles > 1MB to encourage code-splitting
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Each major vendor gets its own cache-friendly chunk.
          // No catch-all — Rollup handles the remaining node_modules automatically.
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/@mui/x-date-pickers') || id.includes('node_modules/@mui/x-charts')) {
            return 'mui-x-vendor'
          }
          if (id.includes('node_modules/@mui/icons-material')) {
            return 'mui-icons-vendor'
          }
          if (id.includes('node_modules/@mui/')) {
            return 'mui-vendor'
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory')) {
            return 'chart-vendor'
          }
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/dayjs') || id.includes('node_modules/moment')) {
            return 'date-vendor'
          }
          if (id.includes('node_modules/axios') || id.includes('node_modules/socket.io')) {
            return 'network-vendor'
          }
        },
      },
    },
  },
})
