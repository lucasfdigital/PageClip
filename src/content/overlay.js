/**
 * Interface do modo de captura.
 *
 * Tudo — destaque, barra, migalhas, painel e avisos — mora num único shadow root
 * fechado pendurado em `<html>`. Consequências práticas:
 *   - o CSS da página não alcança nada disto e o nosso não vaza para a página;
 *   - só os pedaços realmente interativos recebem `pointer-events`, então a
 *     extensão nunca rouba cliques de áreas onde não há UI;
 *   - esconder tudo antes de fotografar é um atributo no host, não uma coleção
 *     de `display: none` espalhados.
 *
 * Texto vindo da página (seletores, nomes de arquivo) sempre entra por
 * `textContent`; o único HTML montado por string é o template estático abaixo.
 */

import { OVERLAY_CSS } from './styles.js';
import { Sidebar } from './sidebar.js';

const HOST_TAG = 'pageclip-overlay';

const TEMPLATE = `
<div class="frame" part="frame">
  <div class="tag"><b></b><span></span></div>
</div>

<div class="top">
  <div class="hud">
    <div class="modes">
      <button class="mode" data-action="mode" data-mode="element">Elemento<kbd>1</kbd></button>
      <button class="mode" data-action="mode" data-mode="region">Região<kbd>2</kbd></button>
      <button class="mode" data-action="mode" data-mode="page">Página<kbd>3</kbd></button>
    </div>
    <button class="icon side-toggle" data-action="sidebar" title="Abrir painel de opções">›</button>
    <button class="icon" data-action="close" title="Sair (Esc)">✕</button>
  </div>

  <div class="hint"></div>
  <div class="notice" data-on="0"><b>!</b><span></span></div>
</div>

<div class="crumbs"></div>

<div class="panel" data-on="0">
  <header>
    <strong>Captura pronta</strong>
    <span class="dims"></span>
    <button class="icon" data-action="sidebar" title="Abrir opções">›</button>
    <button class="icon" data-action="close-panel" title="Fechar">✕</button>
  </header>
  <div class="body">
    <img class="shot" alt="">
    <div class="name"></div>
    <div class="warn"></div>
    <div class="acts">
      <button class="act" data-primary="1" data-action="download">Baixar</button>
      <button class="act" data-action="copy">Copiar</button>
      <button class="act" data-wide="1" data-action="copy-selector">Copiar seletor CSS</button>
      <button class="act" data-wide="1" data-action="again">Capturar outro (Espaço)</button>
    </div>
  </div>
</div>

<div class="progress" data-on="0">
  <span class="count"></span>
  <span class="bar"><i></i></span>
  <button class="stop" data-action="cancel" title="Interromper a captura">Parar (Esc)</button>
</div>

<div class="toast"><i class="dot"></i><span></span></div>
`;

const HINTS = {
  element: 'Clique para capturar · ↑↓←→ percorre o DOM',
  region: 'Arraste para escolher a área',
  page: 'Clique ou Enter para capturar a página inteira'
};

/**
 * Enquanto o alvo está fixado, a dica passa a explicar como soltá-lo — é a
 * única hora em que essa informação importa, e ela some sozinha depois.
 */
const LOCK_HINTS = {
  auto: 'Alvo fixado pelo teclado · mexa o mouse para soltar',
  manual: 'Seleção travada · Espaço para soltar'
};

/**
 * A foto só enxerga o que já está renderizado. Em página com carregamento
 * preguiçoso, capturar sem ter rolado antes produz uma imagem cheia de buracos
 * — e o usuário só descobre depois.
 */
const PAGE_NOTICE = 'Role a página até o fim antes de capturar: o que ainda não carregou não entra na imagem.';

export class Overlay {
  #host = null;
  #root = null;
  #el = {};
  #onAction;
  #accent;
  #mode = 'element';
  #toastTimer = 0;
  #observer = null;
  #previewUrl = null;

  /** @type {import('./sidebar.js').Sidebar|null} */
  sidebar = null;

  /** @param {{ accent: string, onAction: (action: string, detail: any) => void }} config */
  constructor({ accent, onAction }) {
    this.#accent = accent;
    this.#onAction = onAction;
  }

  /** Cria o host e o shadow root. Idempotente. */
  mount() {
    if (this.#host?.isConnected) return;

    this.#host = document.createElement(HOST_TAG);
    this.#host.style.setProperty('--pc-accent', this.#accent);
    this.#root = this.#host.attachShadow({ mode: 'closed' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(OVERLAY_CSS);
    this.#root.adoptedStyleSheets = [sheet];
    this.#root.innerHTML = TEMPLATE;

    this.sidebar = new Sidebar(this.#root);

    this.#el = {
      frame: this.#root.querySelector('.frame'),
      tagName: this.#root.querySelector('.tag b'),
      tagSize: this.#root.querySelector('.tag span'),
      tag: this.#root.querySelector('.tag'),
      top: this.#root.querySelector('.top'),
      hint: this.#root.querySelector('.hint'),
      sidebarButtons: [...this.#root.querySelectorAll('[data-action="sidebar"]')],
      modes: [...this.#root.querySelectorAll('.mode')],
      notice: this.#root.querySelector('.notice'),
      noticeText: this.#root.querySelector('.notice span'),
      crumbs: this.#root.querySelector('.crumbs'),
      panel: this.#root.querySelector('.panel'),
      shot: this.#root.querySelector('.shot'),
      dims: this.#root.querySelector('.dims'),
      name: this.#root.querySelector('.name'),
      warn: this.#root.querySelector('.warn'),
      selectorButton: this.#root.querySelector('[data-action="copy-selector"]'),
      progress: this.#root.querySelector('.progress'),
      progressCount: this.#root.querySelector('.progress .count'),
      progressBar: this.#root.querySelector('.bar i'),
      toast: this.#root.querySelector('.toast'),
      toastText: this.#root.querySelector('.toast span')
    };

    this.#root.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-action]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      this.#onAction(button.dataset.action, button.dataset);
    });

    // Ajustes rápidos do painel: selects, números e caixas de seleção.
    this.#root.addEventListener('change', (event) => {
      const field = event.target;
      if (!field?.name) return;
      this.#onAction('setting', { name: field.name, value: field.type === 'checkbox' ? field.checked : field.value });
    });

    document.documentElement.appendChild(this.#host);
    this.#watchRemoval();
  }

  /** Remove tudo e libera as URLs de preview. */
  destroy() {
    this.#observer?.disconnect();
    this.#observer = null;
    clearTimeout(this.#toastTimer);
    this.#releasePreview();
    this.sidebar = null;
    this.#host?.remove();
    this.#host = null;
    this.#root = null;
    this.#el = {};
  }

  /**
   * Controla o que fica na tela durante uma captura.
   *
   * @param {'idle'|'working'|'shooting'} phase
   *   idle     tudo visível;
   *   working  só a pílula de progresso (para o usuário poder parar);
   *   shooting nada — é o quadro que vai virar imagem.
   */
  async setPhase(phase) {
    if (!this.#host) return;

    if (phase === 'idle') this.#host.removeAttribute('phase');
    else this.#host.setAttribute('phase', phase);

    // Esperamos o quadro ser pintado: senão a foto sai com a interface ainda nela.
    await new Promise((resolve) => {
      const fallback = setTimeout(resolve, 200);
      requestAnimationFrame(() => {
        clearTimeout(fallback);
        resolve();
      });
    });
  }

  /** Mostra (ou esconde) a pílula de progresso com o botão parar. */
  setProgress(done, total) {
    const bar = this.#el.progress;
    if (!bar) return;

    if (done === null) {
      bar.dataset.on = '0';
      return;
    }

    bar.dataset.on = '1';
    this.#el.progressCount.textContent = total > 1 ? `Capturando ${done} de ${total}` : 'Capturando';
    this.#el.progressBar.style.width = `${total > 0 ? Math.round((done / total) * 100) : 0}%`;
  }

  /**
   * Reflete o estado do painel lateral: as duas setas (barra e popup) viram, e
   * a pilha do topo e o popup saem de baixo do painel em vez de ficarem
   * encobertos.
   */
  setSidebarState(open) {
    for (const button of this.#el.sidebarButtons ?? []) {
      button.textContent = open ? '‹' : '›';
      button.title = open ? 'Fechar opções' : 'Abrir opções';
    }

    const state = open ? '1' : '0';
    if (this.#el.top) this.#el.top.dataset.side = state;
    if (this.#el.panel) this.#el.panel.dataset.side = state;
  }

  /**
   * Popup pequeno com o resultado da captura.
   * @param {{ blob: Blob, width: number, height: number, filename: string, warnings?: string[], selector?: string }} shot
   */
  showPanel(shot) {
    this.#releasePreview();
    this.#previewUrl = URL.createObjectURL(shot.blob);

    this.#el.shot.src = this.#previewUrl;
    this.#el.shot.alt = `Prévia de ${shot.filename}`;
    this.#el.dims.textContent = `${shot.width} × ${shot.height}`;
    this.#el.name.textContent = shot.filename;
    this.#el.selectorButton.hidden = !shot.selector;

    this.#el.warn.replaceChildren(
      ...(shot.warnings ?? []).map((message) => {
        const line = document.createElement('p');
        line.textContent = message;
        return line;
      })
    );

    this.#el.panel.dataset.on = '1';
  }

  hidePanel() {
    if (this.#el.panel) this.#el.panel.dataset.on = '0';
  }

  get panelOpen() {
    return this.#el.panel?.dataset.on === '1';
  }

  /**
   * O nó pertence à nossa interface?
   *
   * O shadow root é fechado, então qualquer evento nascido lá dentro chega ao
   * resto da página já com o alvo reapontado para o host — comparar com o host
   * basta e não expõe a árvore interna.
   */
  owns(node) {
    return Boolean(this.#host && node instanceof Node && (node === this.#host || this.#host.contains(node)));
  }

  setAccent(accent) {
    this.#accent = accent;
    this.#host?.style.setProperty('--pc-accent', accent);
  }

  setMode(mode) {
    this.#mode = mode;
    for (const button of this.#el.modes ?? []) {
      button.dataset.on = button.dataset.mode === mode ? '1' : '0';
    }
    this.setLock('free');
    this.setNotice(mode === 'page' ? PAGE_NOTICE : '');
  }

  /** Recado fixo abaixo da barra. Texto vazio esconde. */
  setNotice(text) {
    if (!this.#el.notice) return;
    this.#el.noticeText.textContent = text;
    this.#el.notice.dataset.on = text ? '1' : '0';
  }

  /** @param {'free'|'auto'|'manual'} state */
  setLock(state) {
    this.setHint(state === 'free' ? HINTS[this.#mode] ?? '' : LOCK_HINTS[state]);
  }

  setHint(text) {
    if (this.#el.hint) this.#el.hint.textContent = text;
  }

  /**
   * Posiciona o destaque.
   * @param {{left: number, top: number, width: number, height: number}} box coordenadas da viewport
   * @param {{ label?: string, size?: string, locked?: boolean, dim?: boolean }} info
   */
  showFrame(box, info = {}) {
    const frame = this.#el.frame;
    if (!frame) return;

    frame.dataset.on = '1';
    frame.dataset.dim = info.dim ? '1' : '0';
    frame.dataset.locked = info.locked ? '1' : '0';
    frame.style.transform = `translate(${Math.round(box.left)}px, ${Math.round(box.top)}px)`;
    frame.style.width = `${Math.max(0, Math.round(box.width))}px`;
    frame.style.height = `${Math.max(0, Math.round(box.height))}px`;

    this.#el.tagName.textContent = info.label ?? '';
    this.#el.tagSize.textContent = info.size ?? '';
    this.#el.tag.hidden = !info.label && !info.size;
    this.#el.tag.dataset.place = tagPlacement(box);
  }

  hideFrame() {
    if (this.#el.frame) this.#el.frame.dataset.on = '0';
  }

  /**
   * Desenha a trilha de ancestrais.
   * @param {string[]} labels do mais externo ao alvo atual
   */
  setCrumbs(labels) {
    const bar = this.#el.crumbs;
    if (!bar) return;

    bar.dataset.on = labels.length ? '1' : '0';
    bar.replaceChildren();

    labels.forEach((label, index) => {
      if (index > 0) {
        const separator = document.createElement('i');
        separator.className = 'sep';
        separator.textContent = '›';
        bar.append(separator);
      }

      const chip = document.createElement('button');
      chip.className = 'crumb';
      chip.dataset.action = 'crumb';
      chip.dataset.index = String(index);
      chip.dataset.on = index === labels.length - 1 ? '1' : '0';
      chip.textContent = label;
      bar.append(chip);
    });
  }

  hideCrumbs() {
    if (this.#el.crumbs) this.#el.crumbs.dataset.on = '0';
  }

  /**
   * @param {string} message
   * @param {'busy'|'done'|'error'} tone
   */
  toast(message, tone = 'done') {
    const toast = this.#el.toast;
    if (!toast) return;

    clearTimeout(this.#toastTimer);
    this.#el.toastText.textContent = message;
    toast.dataset.tone = tone;
    toast.dataset.on = '1';

    if (tone !== 'busy') {
      this.#toastTimer = setTimeout(() => {
        toast.dataset.on = '0';
      }, tone === 'error' ? 6000 : 2600);
    }
  }

  hideToast() {
    clearTimeout(this.#toastTimer);
    if (this.#el.toast) this.#el.toast.dataset.on = '0';
  }

  /** Alguns sites recriam `<html>` inteiro; nesse caso reinserimos o overlay. */
  #watchRemoval() {
    this.#observer = new MutationObserver(() => {
      if (this.#host && !this.#host.isConnected) document.documentElement.appendChild(this.#host);
    });

    this.#observer.observe(document.documentElement, { childList: true });
  }

  #releasePreview() {
    if (!this.#previewUrl) return;
    URL.revokeObjectURL(this.#previewUrl);
    this.#previewUrl = null;
  }
}

/** O balão do destaque cabe acima? Senão vai abaixo; e se nada couber, entra no canto. */
function tagPlacement(box) {
  if (box.top >= 26) return 'above';
  if (box.bottom + 26 <= document.documentElement.clientHeight) return 'below';
  return 'inside';
}
