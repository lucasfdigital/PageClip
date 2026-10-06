import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

// Build pensado para página de extensão MV3 (chrome-extension://):
// - base './' para assets relativos funcionarem sob chrome-extension://
// - outDir ../src/hub-boardui, para o manifest apontar para arquivos gerados
// - sem sourcemaps no bundle final (menos arquivos no zip da store)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
  server: {
    fs: {
      // permite importar ../src/shared (db/settings/format) como fonte única
      allow: ['..'],
    },
  },
  build: {
    outDir: '../src/hub-boardui',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
