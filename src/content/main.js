/**
 * Controlador do modo de captura dentro da página.
 *
 * Junta as três peças — seleção (picker), desenho (overlay) e foto (capture) —
 * e cuida da parte chata: interceptar os eventos da página sem quebrá-la e
 * devolver tudo ao normal quando o usuário sai.
 *
 * Regra de ouro dos listeners: eles só engolem eventos enquanto `picking` é
 * verdadeiro. Com o painel de resultado aberto a página volta a funcionar
 * normalmente, então ninguém fica preso num modo invisível.
 */

import { ToContent, ToBackground, Mode, createMessageListener, askBackground } from '../shared/protocol.js';
import { getSettings, patchSettings, onSettingsChanged } from '../shared/settings.js';
import { buildFilename, siteFromUrl } from '../shared/format.js';
import { Overlay } from './overlay.js';
import { captureElement, capturePage, captureRegion, estimateTiles, blobToDataUrl } from './capture.js';
import { ancestors, cssPath, deepElementFromPoint, describe, isCapturable, parentTarget, childTarget, siblingTarget } from './picker.js';

const VERSION = '1.0.0';
const SWALLOWED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'];
const MIN_REGION = 8;
/** Alvos menores que isso são ruído de hit-test (bordas, spacers de 1px). */
const MIN_TARGET = 4;
/**
 * Quanto o mouse precisa andar para desfazer um alvo fixado pelo teclado.
 * Alto o bastante para ignorar tremor e o solavanco da própria rolagem, baixo o
 * bastante para um movimento intencional soltar na hora.
 */
const RELEASE_DISTANCE = 10;

/**
 * Único estilo que precisa morar na página (o cursor de elementos externos não
 * pode ser controlado de dentro de um shadow root).
 */
const PAGE_CSS = `
html.pageclip-on, html.pageclip-on * { cursor: crosshair !important; }
html.pageclip-on * { user-select: none !important; }
html.pageclip-busy, html.pageclip-busy * { cursor: progress !important; }
`;

class PageClip {
  #settings = null;
  #overlay = null;
  #listeners = null;
  #pageStyle = null;

  #picking = false;
  #busy = false;
  #mode = Mode.ELEMENT;
  /**
   * Alvo fixado: `null` = o destaque segue o cursor.
   * `{ manual }` distingue quem pediu — teclado (cede ao primeiro movimento de
   * verdade) ou Espaço (só sai com Espaço de novo).
   */
  #lock = null;
  /** Muda a cada start/stop; uma captura em andamento usa isso para saber se ainda é bem-vinda. */
  #session = 0;

  #target = null;
  #chain = [];
  #pointer = null;
  #frameRequest = 0;
  #drag = null;
  #region = null;
  #shot = null;
  /** Cancela a captura em andamento (botão Parar, Esc, sair do modo). */
  #abort = null;

  constructor() {
    onSettingsChanged((settings) => {
      this.#settings = settings;
      this.#overlay?.setAccent(settings.accent);
    });
  }

  /** Roteia as mensagens vindas do service worker. */
  async handle(type, payload) {
    switch (type) {
      case ToContent.PING:
        return { picking: this.#picking, version: VERSION };

      case ToContent.START:
        await this.start(payload?.mode);
        return { picking: true };

      case ToContent.STOP:
        this.stop();
        return { picking: false };

      case ToContent.CAPTURE_NOW:
        await this.captureNow(payload?.mode ?? Mode.PAGE);
        return { ok: true };

      default:
        return undefined;
    }
  }

  // -------------------------------------------------------------- ciclo de vida

  async start(mode) {
    this.#settings = await getSettings();
    this.#mode = mode ?? this.#settings.mode;

    if (!this.#overlay) {
      this.#overlay = new Overlay({
        accent: this.#settings.accent,
        onAction: (action, detail) => this.#onAction(action, detail)
      });
    }

    this.#overlay.mount();
    this.#overlay.setMode(this.#mode);
    this.#overlay.sidebar.setSettings(this.#settings);
    this.#overlay.hidePanel();
    this.#installPageStyle();
    this.#attach();

    this.#picking = true;
    this.#setLock(null);
    this.#session += 1;
    document.documentElement.classList.add('pageclip-on');
    askBackground(ToBackground.SET_PICKING, { picking: true }).catch(() => {});

    if (this.#mode === Mode.PAGE) this.#showPageFrame();
    else if (this.#pointer) this.#refreshFromPointer();
  }

  stop() {
    this.#abort?.abort();
    this.#picking = false;
    this.#busy = false;
    this.#session += 1;
    this.#target = null;
    this.#drag = null;
    this.#chain = [];

    cancelAnimationFrame(this.#frameRequest);
    this.#frameRequest = 0;

    this.#listeners?.abort();
    this.#listeners = null;

    document.documentElement.classList.remove('pageclip-on', 'pageclip-busy');
    this.#pageStyle?.remove();
    this.#pageStyle = null;

    this.#overlay?.destroy();
    this.#shot = null;

    askBackground(ToBackground.SET_PICKING, { picking: false }).catch(() => {});
  }

  /** Captura sem passar pela seleção (atalho de página inteira, menu de contexto). */
  async captureNow(mode) {
    this.#settings = await getSettings();
    this.#mode = mode;

    if (!this.#overlay) {
      this.#overlay = new Overlay({
        accent: this.#settings.accent,
        onAction: (action, detail) => this.#onAction(action, detail)
      });
    }

    this.#overlay.mount();
    this.#overlay.setMode(mode);
    this.#overlay.hideFrame();
    this.#overlay.hideCrumbs();
    this.#installPageStyle();
    this.#attach();
    this.#picking = false;

    await this.#capture();
  }

  #installPageStyle() {
    if (this.#pageStyle?.isConnected) return;
    this.#pageStyle = document.createElement('style');
    this.#pageStyle.setAttribute('data-pageclip', 'cursor');
    this.#pageStyle.textContent = PAGE_CSS;
    document.documentElement.appendChild(this.#pageStyle);
  }

  // ------------------------------------------------------------------ eventos

  #attach() {
    if (this.#listeners) return;

    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    const on = (type, handler, options = {}) => document.addEventListener(type, handler, { signal, capture: true, ...options });

    for (const type of SWALLOWED) on(type, this.#gate);

    on('pointermove', this.#onPointerMove, { passive: true });
    on('keydown', this.#onKeyDown);
    on('scroll', this.#onViewportChange, { passive: true });
    window.addEventListener('resize', this.#onViewportChange, { signal, passive: true });
  }

  /**
   * Barreira única para os eventos de ponteiro da página.
   * `pointerdown/up` só param de propagar (bloquear o default deles cancelaria
   * os eventos de mouse que usamos como gatilho); o resto é bloqueado de vez.
   */
  #gate = (event) => {
    // Durante a foto a página também fica inerte: um clique perdido no meio de
    // uma captura costurada abriria um link e estragaria o resultado.
    if ((!this.#picking && !this.#busy) || this.#overlay?.owns(event.target)) return;

    event.stopPropagation();
    if (event.type !== 'pointerdown' && event.type !== 'pointerup') event.preventDefault();

    // Enquanto a foto está sendo tirada, bloquear basta — nada de reagir.
    if (this.#busy) return;

    switch (event.type) {
      case 'contextmenu':
        this.stop();
        break;
      case 'pointerdown':
        if (this.#mode === Mode.REGION && event.button === 0) this.#startDrag(event);
        break;
      case 'pointerup':
        if (this.#mode === Mode.REGION && this.#drag) this.#endDrag(event);
        break;
      case 'click':
        if (this.#mode === Mode.ELEMENT && this.#target) this.#capture();
        if (this.#mode === Mode.PAGE) this.#capture();
        break;
      default:
        break;
    }
  };

  #onPointerMove = (event) => {
    this.#pointer = { x: event.clientX, y: event.clientY };
    if (!this.#picking || this.#busy) return;

    if (this.#mode === Mode.REGION && this.#drag) {
      this.#updateDrag(event);
      return;
    }

    if (this.#mode !== Mode.ELEMENT) return;
    if (this.#lock && !this.#releaseIfMoved()) return;

    this.#scheduleRefresh();
  };

  /**
   * O alvo fixado pelo teclado existe só para o cursor parado não desfazer a
   * escolha das setas. No instante em que o usuário move o mouse de propósito,
   * ele volta a mandar — quem quer fixar de verdade usa Espaço.
   * @returns {boolean} soltou agora
   */
  #releaseIfMoved() {
    const lock = this.#lock;
    if (lock.manual) return false;

    // Sem referência ainda (navegou só de teclado): esta posição vira o marco zero.
    if (!lock.origin) {
      lock.origin = { ...this.#pointer };
      return false;
    }

    if (Math.hypot(this.#pointer.x - lock.origin.x, this.#pointer.y - lock.origin.y) < RELEASE_DISTANCE) return false;

    this.#setLock(null);
    return true;
  }

  /** @param {null|'auto'|'manual'} kind */
  #setLock(kind) {
    this.#lock = kind ? { manual: kind === 'manual', origin: this.#pointer ? { ...this.#pointer } : null } : null;
    this.#overlay?.setLock(kind ?? 'free');
    this.#paintTarget();
  }

  #onViewportChange = () => {
    if (!this.#picking || this.#busy) return;
    if (this.#mode === Mode.PAGE) {
      this.#showPageFrame();
      return;
    }
    this.#scheduleRefresh();
  };

  #onKeyDown = (event) => {
    if (!this.#overlay) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();

      // Escapar de uma captura longa cancela ela, não a extensão inteira.
      if (this.#busy) this.#cancel();
      else if (!this.#picking) this.#resume();
      else this.stop();
      return;
    }

    if (this.#busy) return;

    // Com um resultado na tela, a seleção está pausada: qualquer confirmação volta a ela.
    if (!this.#picking) {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        this.#resume();
      }
      return;
    }

    const handled = this.#handlePickingKey(event);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  #handlePickingKey(event) {
    const byKey = { 1: Mode.ELEMENT, 2: Mode.REGION, 3: Mode.PAGE };
    if (byKey[event.key]) {
      this.#setMode(byKey[event.key]);
      return true;
    }

    if (event.key === 'Enter') {
      if (this.#mode === Mode.PAGE || this.#target) this.#capture();
      return true;
    }

    if (this.#mode !== Mode.ELEMENT) return false;

    if (event.key === ' ') {
      const travando = !this.#lock?.manual;
      this.#setLock(travando ? 'manual' : null);
      this.#overlay.toast(travando ? 'Seleção travada' : 'Seleção liberada');
      return true;
    }

    if (!this.#target) return false;

    const moves = {
      ArrowUp: () => parentTarget(this.#target),
      ArrowDown: () => childTarget(this.#target),
      ArrowLeft: () => siblingTarget(this.#target, -1),
      ArrowRight: () => siblingTarget(this.#target, 1)
    };

    const move = moves[event.key];
    if (!move) return false;

    const next = move();
    if (next) {
      this.#setTarget(next);
      this.#setLock('auto');
    } else {
      this.#overlay.toast('Não há para onde ir nessa direção');
    }

    return true;
  }

  // ------------------------------------------------------------------ seleção

  #scheduleRefresh() {
    if (this.#frameRequest) return;
    this.#frameRequest = requestAnimationFrame(() => {
      this.#frameRequest = 0;
      this.#refreshFromPointer();
    });
  }

  #refreshFromPointer() {
    if (this.#mode !== Mode.ELEMENT) return;

    // Fixado: o alvo não muda, mas o destaque precisa acompanhar a rolagem.
    if (this.#lock || !this.#pointer) {
      this.#paintTarget();
      return;
    }

    const found = deepElementFromPoint(this.#pointer.x, this.#pointer.y);

    // Sobre a nossa própria interface: mantém o que já estava destacado.
    if (!found || this.#overlay.owns(found)) return;

    if (found === this.#target) {
      this.#paintTarget();
      return;
    }

    if (!isCapturable(found, MIN_TARGET)) {
      this.#target = null;
      this.#overlay.hideFrame();
      this.#overlay.hideCrumbs();
      return;
    }

    this.#setTarget(found);
  }

  #setTarget(element) {
    this.#target = element;
    this.#chain = [...ancestors(element, 5)].reverse().concat(element);
    this.#overlay.setCrumbs(this.#chain.map((node) => describe(node)));
    this.#paintTarget();
  }

  #paintTarget() {
    if (!this.#target?.isConnected) {
      this.#overlay.hideFrame();
      return;
    }

    const box = this.#target.getBoundingClientRect();
    const pad = this.#settings.padding;

    const labels = this.#settings.showLabels;

    this.#overlay.showFrame(
      { left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2, bottom: box.bottom + pad },
      {
        label: labels ? describe(this.#target) : '',
        size: labels ? `${Math.round(box.width)} × ${Math.round(box.height)}` : '',
        locked: Boolean(this.#lock)
      }
    );
  }

  #showPageFrame() {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    this.#overlay.hideCrumbs();
    this.#overlay.showFrame(
      { left: 0, top: 0, width, height, bottom: height },
      { label: 'página inteira', size: `${document.documentElement.scrollWidth} × ${document.documentElement.scrollHeight}` }
    );
  }

  #setMode(mode) {
    this.#mode = mode;
    this.#lock = null;
    this.#drag = null;
    this.#overlay.setMode(mode);
    this.#overlay.hideCrumbs();

    // O modo escolhido aqui é o que o ícone da barra vai abrir da próxima vez.
    this.#settings.mode = mode;
    patchSettings({ mode }).catch(() => {});

    if (mode === Mode.PAGE) this.#showPageFrame();
    else if (mode === Mode.REGION) this.#overlay.hideFrame();
    else this.#refreshFromPointer();
  }

  // ------------------------------------------------------------------- região

  #startDrag(event) {
    this.#drag = { x: event.clientX, y: event.clientY, scrollX: window.scrollX, scrollY: window.scrollY };
    this.#overlay.hideFrame();
  }

  #updateDrag(event) {
    const box = dragBox(this.#drag, event);
    this.#overlay.showFrame(box, { size: `${Math.round(box.width)} × ${Math.round(box.height)}`, dim: true });
  }

  #endDrag(event) {
    const box = dragBox(this.#drag, event);
    this.#drag = null;

    if (box.width < MIN_REGION || box.height < MIN_REGION) {
      this.#overlay.hideFrame();
      this.#overlay.toast('Área pequena demais — arraste um retângulo maior');
      return;
    }

    this.#region = { x: box.left + window.scrollX, y: box.top + window.scrollY, width: box.width, height: box.height };
    this.#capture();
  }

  // ------------------------------------------------------------------ captura

  async #capture() {
    if (this.#busy) return;

    this.#busy = true;
    this.#picking = false;
    this.#abort = new AbortController();
    document.documentElement.classList.add('pageclip-busy');

    const element = this.#target;
    const mode = this.#mode;
    const session = this.#session;

    try {
      const tiles = mode === Mode.REGION ? 1 : estimateTiles(mode === Mode.ELEMENT ? element : null, this.#settings.padding);
      this.#overlay.setProgress(0, tiles);

      const options = {
        ...this.#settings,
        signal: this.#abort.signal,
        setPhase: (phase) => this.#overlay.setPhase(phase),
        onProgress: (done, total) => this.#overlay.setProgress(done, total)
      };

      const result =
        mode === Mode.PAGE
          ? await capturePage(options)
          : mode === Mode.REGION
            ? await captureRegion(this.#region, options)
            : await captureElement(element, options);

      // Se o usuário saiu (Esc, botão direito) enquanto a foto era tirada, a
      // interface já não existe mais — entregar aqui só geraria erro em cascata.
      if (session !== this.#session) return;
      await this.#deliver(result, element, mode);
    } catch (error) {
      if (session !== this.#session) return;
      this.#overlay.toast(friendlyError(error), 'error');
      this.#picking = true;
    } finally {
      this.#busy = false;
      this.#abort = null;
      this.#overlay?.setProgress(null);
      document.documentElement.classList.remove('pageclip-busy');
    }
  }

  async #deliver(result, element, mode) {
    const filename = buildFilename(this.#settings.filenameTemplate, {
      site: siteFromUrl(location.href),
      tag: mode === Mode.ELEMENT ? element?.localName : mode,
      mode,
      width: result.width,
      height: result.height,
      format: this.#settings.format
    });

    this.#shot = {
      ...result,
      filename,
      selector: mode === Mode.ELEMENT && element ? cssPath(element) : ''
    };

    this.#overlay.hideFrame();
    this.#overlay.hideCrumbs();
    this.#overlay.showPanel(this.#shot);

    if (this.#settings.downloadOnCapture) this.#download();
    if (this.#settings.copyOnCapture) await this.#copyImage();
    if (this.#settings.saveToGallery) {
      await this.#archive(mode, element);
      await this.#refreshHistory();
    }
  }

  async #archive(mode, element) {
    try {
      await askBackground(ToBackground.SAVE_CAPTURE, {
        dataUrl: await blobToDataUrl(this.#shot.blob),
        meta: {
          url: location.href,
          title: document.title,
          site: location.hostname,
          mode,
          tag: element?.localName ?? mode,
          selector: this.#shot.selector,
          filename: this.#shot.filename,
          format: this.#settings.format,
          width: this.#shot.width,
          height: this.#shot.height,
          warnings: this.#shot.warnings
        }
      });
    } catch (error) {
      this.#overlay.toast(`Salvo só nesta tela: ${friendlyError(error)}`, 'error');
    }
  }

  // -------------------------------------------------------------------- ações

  #onAction(action, detail) {
    switch (action) {
      case 'close':
        this.stop();
        break;
      case 'cancel':
        this.#cancel();
        break;
      case 'sidebar':
        this.#setSidebar(!this.#overlay.sidebar.open);
        break;
      case 'close-side':
        this.#setSidebar(false);
        break;
      case 'close-panel':
        this.#resume();
        break;
      case 'setting':
        this.#changeSetting(detail.name, detail.value);
        break;
      case 'history':
        this.#loadFromHistory(detail.id);
        break;
      case 'again':
        this.#resume();
        break;
      case 'mode':
        this.#picking = true;
        this.#setMode(detail.mode);
        break;
      case 'crumb':
        this.#setTarget(this.#chain[Number(detail.index)]);
        this.#setLock('auto');
        break;
      case 'download':
        this.#download();
        break;
      case 'copy':
        this.#copyImage();
        break;
      case 'copy-selector':
        this.#copySelector();
        break;
      case 'hub':
        askBackground(ToBackground.OPEN_HUB).catch(() => {});
        break;
      case 'github':
        askBackground(ToBackground.OPEN_GITHUB).catch(() => {});
        break;
      default:
        break;
    }
  }

  #resume() {
    // Só o popup do resultado sai de cena; a lateral fica como o usuário deixou.
    this.#overlay.hidePanel();
    this.#picking = true;
    this.#setLock(null);
    if (this.#mode === Mode.PAGE) this.#showPageFrame();
    else this.#refreshFromPointer();
  }

  /** Interrompe a captura em andamento; o que já foi fotografado é aproveitado. */
  #cancel() {
    if (!this.#busy) return;
    this.#abort?.abort();
    this.#overlay.toast('Parando…', 'busy');
  }

  // ------------------------------------------------------------ painel lateral

  #setSidebar(open) {
    const state = this.#overlay.sidebar.toggle(open);
    this.#overlay.setSidebarState(state);
    if (state) {
      this.#refreshHistory();
      this.#refreshStars();
    }
    return state;
  }

  async #refreshStars() {
    try {
      this.#overlay?.sidebar?.setStars(await askBackground(ToBackground.GET_STARS));
    } catch {
      // Sem contagem, o selo de stars some sozinho.
    }
  }

  async #changeSetting(name, value) {
    this.#settings = await patchSettings({ [name]: value });
    // Reflete o valor já normalizado (números fora da faixa, por exemplo).
    this.#overlay.sidebar.setSettings(this.#settings);
    this.#paintTarget();
  }

  async #refreshHistory() {
    try {
      this.#overlay?.sidebar?.setHistory(await askBackground(ToBackground.LIST_CAPTURES, { limit: 6 }));
    } catch {
      // Galeria indisponível não pode atrapalhar quem só quer capturar.
    }
  }

  /** Traz uma captura guardada de volta para a área de resultado do painel. */
  async #loadFromHistory(id) {
    try {
      const { dataUrl, meta } = await askBackground(ToBackground.GET_CAPTURE, { id });
      const blob = await (await fetch(dataUrl)).blob();

      this.#shot = {
        blob,
        width: meta.width,
        height: meta.height,
        filename: meta.filename,
        warnings: [],
        selector: meta.selector ?? ''
      };

      this.#overlay.showPanel(this.#shot);
    } catch (error) {
      this.#overlay.toast(friendlyError(error), 'error');
    }
  }

  #download() {
    if (!this.#shot) return;

    const url = URL.createObjectURL(this.#shot.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.#shot.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);

    this.#overlay.toast('Download iniciado');
  }

  async #copyImage() {
    if (!this.#shot) return;

    try {
      // A área de transferência do Chrome só aceita image/png.
      const png = await toPng(this.#shot.blob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      this.#overlay.toast('Imagem copiada');
    } catch (error) {
      this.#overlay.toast(`Não deu para copiar: ${friendlyError(error)}`, 'error');
    }
  }

  async #copySelector() {
    if (!this.#shot?.selector) return;

    try {
      await navigator.clipboard.writeText(this.#shot.selector);
      this.#overlay.toast('Seletor copiado');
    } catch (error) {
      this.#overlay.toast(`Não deu para copiar: ${friendlyError(error)}`, 'error');
    }
  }
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function dragBox(start, event) {
  const left = Math.min(start.x, event.clientX);
  const top = Math.min(start.y, event.clientY);
  const width = Math.abs(event.clientX - start.x);
  const height = Math.abs(event.clientY - start.y);
  return { left, top, width, height, bottom: top + height };
}

async function toPng(blob) {
  if (blob.type === 'image/png') return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

function friendlyError(error) {
  const message = error?.message ?? String(error);
  if (/Extension context invalidated/i.test(message)) {
    return 'A extensão foi recarregada. Atualize a página para continuar.';
  }
  return message;
}

/** Ponto de entrada chamado pelo boot.js. */
export function install() {
  if (globalThis.__pageclip) return;

  const controller = new PageClip();
  globalThis.__pageclip = controller;

  chrome.runtime.onMessage.addListener(createMessageListener((type, payload) => controller.handle(type, payload)));
}
