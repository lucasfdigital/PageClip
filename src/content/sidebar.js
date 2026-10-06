/**
 * Painel lateral encostado na direita: as opções e o histórico.
 *
 * O resultado da captura NÃO mora aqui — ele aparece no popup pequeno, e a
 * seta do popup (ou a da barra) é que traz este painel para a tela. Assim quem
 * só quer capturar nunca vê esta parte, e quem quer ajustar tem tudo à mão sem
 * sair da página.
 *
 * Mora no mesmo shadow root do resto da interface, então herda o isolamento e
 * some junto na hora da foto. Fechado, ele não recebe `pointer-events`: a faixa
 * da direita continua sendo da página.
 */

const TEMPLATE = `
<aside class="side" data-on="0">
  <header>
    <span class="brand">
      <svg width="20" height="20" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <rect width="30" height="30" rx="8" fill="#2563EB"/>
        <path d="M8.25 12V9.75C8.25 9.35218 8.40804 8.97064 8.68934 8.68934C8.97064 8.40804 9.35218 8.25 9.75 8.25H12" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18 8.25H20.25C20.6478 8.25 21.0294 8.40804 21.3107 8.68934C21.592 8.97064 21.75 9.35218 21.75 9.75V12" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21.75 18V20.25C21.75 20.6478 21.592 21.0294 21.3107 21.3107C21.0294 21.592 20.6478 21.75 20.25 21.75H18" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 21.75H9.75C9.35218 21.75 8.97064 21.592 8.68934 21.3107C8.40804 21.0294 8.25 20.6478 8.25 20.25V18" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="15" cy="15" r="2.4" stroke="white" stroke-width="2.4"/>
      </svg>
      <b>PageClip</b>
    </span>
    <button class="stars" data-action="github" title="Abrir o PageClip no GitHub" hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
      Stars <span class="count"></span>
    </button>
    <button class="icon" data-action="close-side" title="Fechar painel">✕</button>
  </header>

  <div class="side-body">
    <section class="group">
      <h3>Ajustes rápidos</h3>

      <label class="field">
        <span>Formato</span>
        <select name="format">
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
      </label>

      <label class="field">
        <span>Resolução</span>
        <select name="scale">
          <option value="device">Da tela</option>
          <option value="css">1× CSS</option>
        </select>
      </label>

      <label class="field">
        <span>Folga</span>
        <input type="number" name="padding" min="0" max="200" step="2"><i>px</i>
      </label>

      <label class="opt"><input type="checkbox" name="downloadOnCapture"><span>Baixar ao capturar</span></label>
      <label class="opt"><input type="checkbox" name="copyOnCapture"><span>Copiar ao capturar</span></label>
      <label class="opt"><input type="checkbox" name="saveToGallery"><span>Guardar na galeria</span></label>
    </section>

    <section class="group">
      <h3>Últimas capturas</h3>
      <div class="history"></div>
      <p class="blank small">Nada guardado ainda.</p>
    </section>
  </div>

  <footer><button class="link" data-action="hub">Abrir hub completo →</button></footer>
</aside>
`;

export class Sidebar {
  #el = {};
  #open = false;

  /** @param {ShadowRoot} root shadow root compartilhado com o resto da interface */
  constructor(root) {
    // ShadowRoot é um DocumentFragment: tem `innerHTML`, mas não
    // `insertAdjacentHTML` (esse é de Element). Como não podemos sobrescrever o
    // que o overlay já montou, parseamos num <template> e anexamos os nós.
    const template = document.createElement('template');
    template.innerHTML = TEMPLATE;
    root.append(template.content);

    this.#el = {
      side: root.querySelector('.side'),
      stars: root.querySelector('.side .stars'),
      starsCount: root.querySelector('.side .stars .count'),
      history: root.querySelector('.history'),
      historyBlank: root.querySelector('.side .blank.small'),
      fields: [...root.querySelectorAll('.side [name]')]
    };
  }

  get open() {
    return this.#open;
  }

  /** @param {boolean} [force] omitir alterna */
  toggle(force) {
    this.#open = force ?? !this.#open;
    this.#el.side.dataset.on = this.#open ? '1' : '0';
    return this.#open;
  }

  /** Mostra a contagem de stars do GitHub; sem número, o selo some. */
  setStars(count) {
    if (!this.#el.stars) return;
    const valid = Number.isFinite(count);
    this.#el.stars.hidden = !valid;
    if (valid) this.#el.starsCount.textContent = String(count);
  }

  /** Preenche os controles de ajuste rápido. */
  setSettings(settings) {
    for (const field of this.#el.fields) {
      const value = settings[field.name];
      if (value === undefined) continue;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value;
    }
  }

  /**
   * Desenha as miniaturas da galeria.
   * @param {Array<{id: string, thumb: string|null, meta: object}>} items
   */
  setHistory(items) {
    this.#el.historyBlank.hidden = items.length > 0;
    this.#el.history.replaceChildren(
      ...items.map((item) => {
        const button = document.createElement('button');
        button.className = 'thumb';
        button.dataset.action = 'history';
        button.dataset.id = item.id;
        button.title = `${item.meta?.filename ?? ''}\n${item.meta?.selector ?? ''}`;

        // Página inteira encolhida vira uma tirinha ilegível: mostra o topo.
        if (Number(item.meta?.height) / Math.max(1, Number(item.meta?.width)) > 2.2) {
          button.dataset.tall = '1';
        }

        const image = document.createElement('img');
        image.alt = item.meta?.filename ?? 'captura';
        if (item.thumb) image.src = item.thumb;

        const caption = document.createElement('small');
        caption.textContent = item.meta?.tag ?? '';

        button.append(image, caption);
        return button;
      })
    );
  }
}
