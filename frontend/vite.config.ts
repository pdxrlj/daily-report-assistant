import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/v1': {
        target: 'http://localhost:1234',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
      },
    },
  },
})
