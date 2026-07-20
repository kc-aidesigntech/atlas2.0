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
  },
  build: {
    rollupOptions: {
      output: {
        // Isolate the Supabase client so the tiny entry shell stays readable in
        // build reports. Do not force-split recharts here — that made Vite attach
        // it as a static entry dependency and modulepreload it on every route.
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'supabase'
        }
      }
    }
  }
}))
