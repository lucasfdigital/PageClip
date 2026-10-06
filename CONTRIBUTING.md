# Contribuindo com o PageClip

🇧🇷 Português · 🇺🇸 [English](#english)

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
  Nunca edite nada dentro dele à mão. A checagem automática (CI) falha se você esquecer de rodar o build.

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

## Código de conduta

Ao participar, você concorda em seguir o [Código de Conduta](CODE_OF_CONDUCT.md).

## Licença

Ao contribuir, você concorda que sua contribuição entra sob a [licença MIT](LICENSE).

---

<a id="english"></a>

# Contributing to PageClip (English)

Thanks for wanting to help! The flow is the standard open source one: fork, branch, PR to `main`.

## The basics

1. Fork the repo and clone your fork.
2. Create a branch from `main`: `git checkout -b my-change`.
3. Make your change, commit and open a PR describing what changed and how to test it.

## The two parts of the project

- **Extension (vanilla):** `manifest.json`, `src/background/`, `src/content/`, `src/shared/`.
  Plain ES module JavaScript, no build. After changing it, reload the extension
  in `chrome://extensions`.
- **Hub (React + BoardUI):** `hub-react/` (Vite + Tailwind v4). After changing it, generate
  the extension files with:

  ```
  cd hub-react
  npm install   # first time only
  npm run build # writes to src/hub-boardui/
  ```

  The generated `src/hub-boardui/` goes into the commit, it's what the extension actually opens.
  Never edit anything inside it by hand. The automatic check (CI) fails if you forget to rebuild.

## Conventions

- Interface text in **Brazilian Portuguese (PT-BR)**, **no em dashes** (use commas).
- Visuals follow the BoardUI tokens (`hub-react/src/styles/`), no hard-coded colors
  outside the tokens and no remote fonts (the MV3 CSP blocks them).
- New hub components: prefer `npx boardui add <name>` inside `hub-react/`
  instead of reinventing them.
- Don't commit `node_modules/`, `.pem`, `.crx` or `.zip` (the `.gitignore` already covers them).

## Testing

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the project folder.
3. Test selection mode (`Alt+Shift+S`), full page (`Alt+Shift+F`) and the hub
   (context menu, **Open PageClip gallery**).

## Code of conduct

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md#english).

## License

By contributing, you agree that your contribution is licensed under the [MIT license](LICENSE).
