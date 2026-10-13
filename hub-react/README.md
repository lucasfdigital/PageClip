# hub-react

Fonte das telas do PageClip, em React 19 + Tailwind v4 + BoardUI, com Motion nas
animações. Um build, três saídas:

- **Hub** (galeria, ajustes e ajuda): `src/App.jsx`, `src/hub/` → `../src/hub-boardui/`.
- **Barra dentro dos sites**: `src/overlay/` → `../src/overlay-boardui/overlay.js`.
  Mora num shadow root fechado; `scripts/shadow-css.js` adapta o CSS do BoardUI
  (`:root` vira `:host`, `@property` vira declaração comum, `rem` vira `px`).
- **Site de divulgação**: `site/` → `../site/`, com o HTML pré-montado por
  `scripts/prerender-site.js`. A Vercel publica `../site/` como arquivos estáticos.

Também:

- `src/components/`, `src/styles/`: componentes e tokens do BoardUI
  (instalados com `npx boardui add <nome>`, não edite os tokens à mão).
  `src/styles/fonts.css` carrega Inter e JetBrains Mono locais (sem fonte remota).
- A lógica de dados (galeria, ajustes, nomes de arquivo) é importada de
  `../src/shared/`, fonte única usada também pela extensão.

Comandos (dentro desta pasta):

```
npm install          # só na primeira vez
npm run dev          # desenvolve o hub fora da extensão (sem chrome.*)
npm run build        # gera as três saídas
npm run build:hub    # só o hub
npm run build:overlay # só a barra
npm run build:site   # só o site
```

Detalhes do fluxo de contribuição em `../CONTRIBUTING.md`.
