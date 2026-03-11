import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  // Keep local dev at root, build for GitHub Pages repo path.
  base: command === 'serve' ? '/' : '/atlas2.0/',
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
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('d3') || id.includes('recharts') || id.includes('gsap')) return 'vendor-viz'
          if (id.includes('lucide-react') || id.includes('@radix-ui')) return 'vendor-ui'
          if (id.includes('xlsx') || id.includes('jspdf')) return 'vendor-export'
          return 'vendor-misc'
        },
      },
    },
  },
}))

