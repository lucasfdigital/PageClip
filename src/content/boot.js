/**
 * Bootstrap injetado por `chrome.scripting.executeScript`.
 *
 * `executeScript` só aceita scripts clássicos, então este arquivo existe apenas
 * para puxar o módulo de verdade. O `import()` dinâmico roda no mundo isolado da
 * extensão: a CSP do site não interfere e o código continua dividido em módulos
 * ES normais, sem bundler.
 *
 * O mundo isolado é reaproveitado entre injeções no mesmo frame, então a flag
 * abaixo garante que reativar a extensão não carrega o módulo duas vezes.
 */

(() => {
  if (window.__pageclipBooted) return;
  window.__pageclipBooted = true;

  import(chrome.runtime.getURL('src/content/main.js'))
    .then((module) => module.install())
    .catch((error) => {
      window.__pageclipBooted = false;
      console.error('[PageClip] não foi possível carregar o módulo principal:', error);
    });
})();
