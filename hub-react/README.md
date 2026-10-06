# hub-react

Fonte da página do hub do PageClip (galeria, ajustes e ajuda), em React 19 +
Tailwind v4 + BoardUI.

- `src/App.jsx`, `src/hub/`: as três telas do hub.
- `src/components/`, `src/styles/`: componentes e tokens do BoardUI
  (instalados com `npx boardui add <nome>`, não edite os tokens à mão).
- A lógica de dados (galeria, ajustes, nomes de arquivo) é importada de
  `../src/shared/`, fonte única usada também pela extensão.

Comandos (dentro desta pasta):

```
npm install   # só na primeira vez
npm run dev   # desenvolve com a página fora da extensão (sem chrome.*)
npm run build # gera ../src/hub-boardui/, o que a extensão abre de verdade
```

Detalhes do fluxo de contribuição em `../CONTRIBUTING.md`.
