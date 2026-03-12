import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  // Local dev stays at root. Production build path is configurable:
  // - GitHub Pages: VITE_BASE_PATH=/atlas2.0/
  // - Heroku/Vercel/root hosting: VITE_BASE_PATH=/
  base: command === 'serve' ? '/' : process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
  },
  server: {
    port: 5173
  }
}))

