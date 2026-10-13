/**
 * Pré-monta o HTML do site depois do build: renderiza o App no Node e grava o
 * resultado dentro do index.html gerado. Buscadores e prévias de link veem o
 * texto completo; no navegador o React só assume (hydrate).
 */
import { build } from 'vite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pageclip-site-ssr-'))

try {
  await build({
    configFile: path.join(root, 'vite.site.config.js'),
    logLevel: 'warn',
    // Tudo dentro do pacote: a pasta temporária não tem node_modules.
    ssr: { noExternal: true },
    build: {
      ssr: path.join(root, 'site/entry-server.jsx'),
      outDir,
      emptyOutDir: true,
    },
  })

  const entry = fs.readdirSync(outDir).find((name) => /^entry-server\.m?js$/.test(name))
  const { render } = await import(pathToFileURL(path.join(outDir, entry)).href)
  const page = path.resolve(root, '../site/index.html')
  const html = fs.readFileSync(page, 'utf8')
  if (!html.includes('<!--app-html-->')) throw new Error('Marcador <!--app-html--> não encontrado no index.html gerado.')
  fs.writeFileSync(page, html.replace('<!--app-html-->', render()))
  console.log('site pré-montado:', path.relative(process.cwd(), page))
} finally {
  fs.rmSync(outDir, { recursive: true, force: true })
}
