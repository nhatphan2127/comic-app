import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // ~1.9k small emoji images would otherwise be base64-inlined into the JS bundle.
    // Ship them as separate, cacheable files and keep the default inlining for everything else.
    assetsInlineLimit: (filePath) => (filePath.includes('/assets/emojis/') ? false : undefined),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
