# Contribuindo com o PageClip

Valeu por querer ajudar! O fluxo é o padrão de open source: fork, branch, PR para a `main`.

## O básico

1. Faça um fork e clone o seu fork.
2. Crie uma branch a partir da `main`: `git checkout -b minha-mudanca`.
3. Faça a mudança, commite e abra um PR descrevendo o que mudou e como testar.

## As duas partes do projeto

- **Extensão (vanilla):** `manifest.json`, `src/background/`, `src/content/`, `src/shared/`.
  JavaScript de módulos ES puro, sem build. Depois de mexer, recarregue a extensão
  em `chrome://extensions`.
- **Hub (React + BoardUI):** `hub-react/` (Vite + Tailwind v4). Depois de mexer, gere
  os arquivos da extensão com:

  ```
  cd hub-react
  npm install   # só na primeira vez
  npm run build # grava em src/hub-boardui/
  ```

  O `src/hub-boardui/` gerado entra no commit, ele é o que a extensão abre de verdade.
  Nunca edite nada dentro dele à mão.

## Convenções

- Textos da interface em **PT-BR**, **sem travessões** (use vírgulas).
- Visual segue os tokens do BoardUI (`hub-react/src/styles/`), sem cores chapadas
  fora dos tokens e sem fontes remotas (a CSP do MV3 bloqueia).
- Componentes novos do hub: prefira `npx boardui add <nome>` dentro de `hub-react/`
  em vez de reinventar.
- Não versione `node_modules/`, `.pem`, `.crx` nem `.zip` (o `.gitignore` já cobre).

## Testando

1. Abra `chrome://extensions`, ligue o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta do projeto.
3. Teste o modo de seleção (`Alt+Shift+S`), a página inteira (`Alt+Shift+F`) e o hub
   (menu de contexto, **Abrir galeria do PageClip**).

## Licença

Ao contribuir, você concorda que sua contribuição entra sob a [licença MIT](LICENSE).
