import tailwindcss from '@tailwindcss/postcss'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import shadowCss from './scripts/shadow-css.js'

const root = import.meta.dirname

// Build da barra que aparece dentro dos sites (content script).
// - um arquivo só, módulo ES, importado por src/content/main.js
// - CSS embutido como texto (?inline) e adaptado ao shadow root por
//   scripts/shadow-css.js; a fonte também vai embutida
// - outDir ../src/overlay-boardui, ao lado do hub gerado
export default defineConfig({
  plugins: [react()],
  // Os ícones do public/ são do hub; a barra não usa nenhum.
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ base: path.resolve(root, 'src/overlay') }), shadowCss()],
    },
  },
  build: {
    outDir: '../src/overlay-boardui',
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    lib: {
      entry: path.resolve(root, 'src/overlay/index.jsx'),
      formats: ['es'],
      fileName: () => 'overlay.js',
    },
    // Em modo biblioteca o formato ES sai sem remover espaços; aqui não há
    // quem reaproveite o código, então compacta tudo.
    rolldownOptions: {
      output: { minify: true },
    },
  },
})
