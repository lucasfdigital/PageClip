import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

// Build do site de divulgação (https://pageclip.vercel.app).
// - fonte em site/, saída em ../site, que a Vercel publica como arquivos
//   estáticos (sem build do lado dela)
// - o HTML é pré-montado depois por scripts/prerender-site.js
export default defineConfig({
  root: path.resolve(root, 'site'),
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
  build: {
    outDir: path.resolve(root, '../site'),
    emptyOutDir: true,
    sourcemap: false,
  },
})
