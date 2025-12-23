import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  // SPA fallback for direct URL access (Vite handles this automatically in dev)
  // For production, ensure your server serves index.html for all routes
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})

