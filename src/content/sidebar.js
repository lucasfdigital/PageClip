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
    <button class="brand" data-action="github" title="Abrir o PageClip no GitHub">
      <svg width="20" height="20" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <rect width="30" height="30" rx="8" fill="#2563EB"/>
        <path d="M8.25 12V9.75C8.25 9.35218 8.40804 8.97064 8.68934 8.68934C8.97064 8.40804 9.35218 8.25 9.75 8.25H12" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18 8.25H20.25C20.6478 8.25 21.0294 8.40804 21.3107 8.68934C21.592 8.97064 21.75 9.35218 21.75 9.75V12" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21.75 18V20.25C21.75 20.6478 21.592 21.0294 21.3107 21.3107C21.0294 21.592 20.6478 21.75 20.25 21.75H18" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 21.75H9.75C9.35218 21.75 8.97064 21.592 8.68934 21.3107C8.40804 21.0294 8.25 20.6478 8.25 20.25V18" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="15" cy="15" r="2.4" stroke="white" stroke-width="2.4"/>
      </svg>
      <b>PageClip</b>
      <span class="stars" hidden><i>★</i><span></span></span>
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
      starsCount: root.querySelector('.side .stars span:last-child'),
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
