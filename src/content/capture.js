/**
 * Captura e recorte.
 *
 * O navegador só sabe fotografar a parte visível da aba (`captureVisibleTab`).
 * Tudo aqui existe para transformar isso em "a imagem exata do alvo", inclusive
 * quando o alvo é maior que a tela: rolamos, fotografamos por partes e costuramos.
 *
 * A ideia central do laço é sempre a mesma, seja um elemento, uma região ou a
 * página inteira: `measure()` devolve o retângulo do alvo em coordenadas da
 * viewport *agora*. Depois de cada rolagem medimos de novo e desenhamos só o
 * pedaço que está realmente visível. Como nada é extrapolado, não existe
 * desalinhamento acumulado — no máximo um pedaço que o navegador se recusou a
 * mostrar, e isso vira aviso.
 */

import { askBackground, ToBackground } from '../shared/protocol.js';
import { MIME, hasAlpha } from '../shared/settings.js';
import { scrollableAncestor } from './picker.js';

/** Limite físico de canvas do Chrome, com folga. */
const MAX_SIDE = 32000;
/**
 * Teto de área da imagem final.
 *
 * O limite do Chrome é bem mais alto, mas cada pixel custa 4 bytes de RAM
 * enquanto a costura acontece: 100 MP já são ~400 MB. Páginas de rolagem
 * infinita (YouTube, feeds) declaram alturas absurdas e levariam o navegador
 * junto — aqui elas viram uma imagem reduzida e um aviso.
 */
const MAX_AREA = 100_000_000;
/**
 * Teto de fotos por captura. Uma página de rolagem infinita não tem fim; em
 * algum momento é mais honesto entregar o que deu e avisar.
 */
const MAX_TILES = 80;
/** Abaixo disso não sobra janela útil para costurar. */
const MIN_WINDOW = 32;

/**
 * @typedef {object} CaptureOptions
 * @property {number} padding folga em px CSS
 * @property {'png'|'jpeg'|'webp'} format
 * @property {number} quality
 * @property {string} matte cor sob formatos sem alfa
 * @property {'device'|'css'} scale
 * @property {boolean} hideFixed
 * @property {number} tileDelay
 * @property {(phase: 'idle'|'working'|'shooting') => Promise<void>} [setPhase]
 * @property {(done: number, total: number) => void} [onProgress]
 * @property {AbortSignal} [signal] cancela a costura entre uma foto e outra
 */

/**
 * @typedef {object} CaptureResult
 * @property {Blob} blob
 * @property {number} width
 * @property {number} height
 * @property {string[]} warnings
 */

/** Captura um elemento do DOM com a folga configurada. */
export function captureElement(element, options) {
  const scroller = scrollableAncestor(element);
  const measure = () => inflate(element.getBoundingClientRect(), options.padding);
  return stitch({ measure, scroller, options, keepInside: element });
}

/**
 * Captura uma região livre.
 * @param {{x: number, y: number, width: number, height: number}} docRect em coordenadas do documento
 */
export function captureRegion(docRect, options) {
  const measure = () => rect(docRect.x - window.scrollX, docRect.y - window.scrollY, docRect.width, docRect.height);
  return stitch({ measure, scroller: null, options });
}

/** Captura o documento inteiro. */
export function capturePage(options) {
  const measure = () => rect(-window.scrollX, -window.scrollY, documentWidth(), documentHeight());
  return stitch({ measure, scroller: null, options });
}

/** Quantas fotos serão necessárias para o alvo — usado para avisar antes de começar. */
export function estimateTiles(element, padding = 0) {
  const scroller = element ? scrollableAncestor(element) : null;
  const target = element ? inflate(element.getBoundingClientRect(), padding) : rect(0, 0, documentWidth(), documentHeight());
  const view = visibleWindow(scroller);
  if (view.width < MIN_WINDOW || view.height < MIN_WINDOW) return 1;

  // Mesmo teto do laço real, senão a barra de progresso prometeria 300 fotos
  // numa página de rolagem infinita e pararia na 80.
  return Math.min(MAX_TILES, Math.ceil(target.width / view.width) * Math.ceil(target.height / view.height));
}

// ---------------------------------------------------------------------------
// Núcleo
// ---------------------------------------------------------------------------

async function stitch({ measure, scroller, options, keepInside = null }) {
  const warnings = [];
  const setPhase = options.setPhase ?? (async () => {});
  const signal = options.signal;
  const restoreScroll = snapshotScroll(scroller);
  let pageStyles = null;

  await setPhase('shooting');

  try {
    // Traz o container com rolagem própria para a tela antes de medir a janela útil.
    if (scroller) scroller.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });

    const first = measure();
    if (first.width < 1 || first.height < 1) throw new Error('O alvo não tem área visível para capturar.');

    const view = visibleWindow(scroller);
    if (view.width < MIN_WINDOW || view.height < MIN_WINDOW) {
      throw new Error('A área visível é pequena demais para capturar este alvo.');
    }

    const cols = Math.max(1, Math.ceil((first.width - 0.5) / view.width));
    const wantedRows = Math.max(1, Math.ceil((first.height - 0.5) / view.height));
    const rows = Math.min(wantedRows, Math.max(1, Math.floor(MAX_TILES / cols)));
    const total = cols * rows;

    if (rows < wantedRows) {
      warnings.push(`A página é longa demais: capturei as primeiras ${rows} telas de ${wantedRows}.`);
    }

    if (total > 1) pageStyles = freezePage({ hideFixed: options.hideFixed, keepInside });

    let canvas = null;
    let context = null;
    let outScale = 1;
    let reach = { right: 0, bottom: 0 };
    let done = 0;
    let stopped = false;

    for (let row = 0; row < rows && !stopped; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (signal?.aborted) {
          stopped = true;
          break;
        }

        const scrolled = await align({
          measure,
          scroller,
          view,
          localX: col * view.width,
          localY: row * view.height,
          single: total === 1
        });

        // Esconde tudo, inclusive a pílula de progresso: este é o quadro que
        // vai virar imagem. A espera do conteúdo vem depois, então a interface
        // tem folga de sobra para sumir antes da foto.
        await setPhase('shooting');
        await settle(scrolled ? options.tileDelay : 0);

        // Medido logo antes da foto: a ida e volta até o service worker leva
        // dezenas de milissegundos, e medir depois abriria margem para o alvo
        // ter se mexido entre a imagem e a régua.
        const target = measure();
        const bitmap = await grabViewportBitmap();

        // Devolve o botão parar à tela enquanto processamos e rolamos.
        if (total > 1) await setPhase('working');

        try {
          const scale = bitmap.width / Math.max(1, viewportWidth());

          if (!canvas) {
            outScale = options.scale === 'css' ? 1 : scale;
            const fitted = fitToCanvasLimits(first.width, first.height, outScale);
            if (fitted.scale < outScale) {
              warnings.push('A imagem foi reduzida para caber no limite de canvas do navegador.');
              outScale = fitted.scale;
            }

            canvas = new OffscreenCanvas(fitted.width, fitted.height);
            context = canvas.getContext('2d', { alpha: hasAlpha(options.format) });
            if (!hasAlpha(options.format)) {
              context.fillStyle = options.matte;
              context.fillRect(0, 0, canvas.width, canvas.height);
            }
          }

          const visible = clampTo(intersection(target, view), bitmap.width / scale, bitmap.height / scale);

          if (visible.width > 0.5 && visible.height > 0.5) {
            paint(context, bitmap, { visible, target, scale, outScale });
            reach.right = Math.max(reach.right, visible.right - target.left);
            reach.bottom = Math.max(reach.bottom, visible.bottom - target.top);
          }
        } finally {
          bitmap.close();
        }

        done += 1;
        options.onProgress?.(done, total);
      }
    }

    if (!canvas) throw new Error(stopped ? 'Captura cancelada.' : 'Nenhuma parte do alvo pôde ser fotografada.');

    if (stopped) {
      // Melhor entregar o pedaço já fotografado do que jogar fora o trabalho:
      // recortamos o canvas até onde a costura chegou.
      warnings.push('Captura interrompida — a imagem tem só o que já havia sido fotografado.');
      canvas = cropTo(canvas, reach.right * outScale, reach.bottom * outScale);
    } else if (reach.right < first.width - 2 || reach.bottom < first.height - 2) {
      warnings.push('Parte do alvo não pôde ser alcançada por rolagem e ficou fora da imagem.');
    }

    const last = measure();
    if (!stopped && (Math.abs(last.width - first.width) > 8 || Math.abs(last.height - first.height) > 8)) {
      warnings.push('A página mudou de tamanho durante a captura; confira o resultado.');
    }

    const blob = await canvas.convertToBlob({ type: MIME[options.format], quality: options.quality });
    return { blob, width: canvas.width, height: canvas.height, warnings, stopped };
  } finally {
    pageStyles?.dispose();
    restoreScroll();
    await setPhase('idle');
  }
}

/** Corta o canvas no canto superior esquerdo, mantendo só a parte preenchida. */
function cropTo(canvas, width, height) {
  const w = Math.max(1, Math.min(canvas.width, Math.round(width)));
  const h = Math.max(1, Math.min(canvas.height, Math.round(height)));
  if (w === canvas.width && h === canvas.height) return canvas;

  const cropped = new OffscreenCanvas(w, h);
  cropped.getContext('2d').drawImage(canvas, 0, 0);
  return cropped;
}

/** Desenha o pedaço visível do alvo na posição correta da imagem final. */
function paint(context, bitmap, { visible, target, scale, outScale }) {
  const sx = Math.round(visible.left * scale);
  const sy = Math.round(visible.top * scale);
  const sw = Math.max(1, Math.round(visible.right * scale) - sx);
  const sh = Math.max(1, Math.round(visible.bottom * scale) - sy);

  const dx = Math.round((visible.left - target.left) * outScale);
  const dy = Math.round((visible.top - target.top) * outScale);
  const dw = Math.max(1, Math.round((visible.right - target.left) * outScale) - dx);
  const dh = Math.max(1, Math.round((visible.bottom - target.top) * outScale) - dy);

  context.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * Rola até que o ponto local (localX, localY) do alvo caia no canto da janela útil.
 * Quando tudo cabe de uma vez, faz o mínimo de rolagem possível — assim capturar
 * um botão não faz a página dar um salto.
 * @returns {Promise<boolean>} houve rolagem
 */
async function align({ measure, scroller, view, localX, localY, single }) {
  const target = measure();

  const dx = single
    ? nudge(target.left, target.right, view.left, view.right)
    : target.left + localX - view.left;
  const dy = single
    ? nudge(target.top, target.bottom, view.top, view.bottom)
    : target.top + localY - view.top;

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return false;

  if (scroller) {
    scroller.scrollLeft += dx;
    scroller.scrollTop += dy;
  } else {
    window.scrollBy({ left: dx, top: dy, behavior: 'instant' });
  }

  return true;
}

/** Deslocamento mínimo para trazer [start,end] para dentro de [min,max]. */
function nudge(start, end, min, max) {
  if (start < min) return Math.max(start - min, end - max);
  if (end > max) return Math.min(end - max, start - min);
  return 0;
}

async function grabViewportBitmap() {
  // `captureVisibleTab` fotografa a aba visível da janela — não necessariamente
  // esta. Se o usuário trocou de aba no meio de uma costura, a foto seguinte
  // seria de outra página e entraria colada no resultado.
  if (document.visibilityState !== 'visible') {
    throw new Error('A aba precisa estar em primeiro plano durante a captura.');
  }

  const { dataUrl } = await askBackground(ToBackground.GRAB_VIEWPORT);
  // `fetch` de data: URL roda com privilégio da extensão e não esbarra na CSP da página.
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

// ---------------------------------------------------------------------------
// Estado da página durante a captura
// ---------------------------------------------------------------------------

/**
 * Congela o que atrapalha a costura: rolagem suave e elementos fixos/sticky que
 * apareceriam repetidos em cada pedaço. O que está dentro do alvo é preservado.
 */
function freezePage({ hideFixed, keepInside }) {
  const style = document.createElement('style');
  style.setAttribute('data-pageclip', 'capture');
  style.textContent = `html{scroll-behavior:auto !important}[data-pageclip-hidden]{visibility:hidden !important}`;
  document.documentElement.appendChild(style);

  const hidden = [];

  if (hideFixed && document.body) {
    const all = document.body.getElementsByTagName('*');
    const limit = Math.min(all.length, 15000);

    for (let index = 0; index < limit; index += 1) {
      const element = all[index];
      if (keepInside && (element === keepInside || keepInside.contains(element) || element.contains(keepInside))) continue;

      const position = getComputedStyle(element).position;
      if (position === 'fixed' || position === 'sticky') {
        element.setAttribute('data-pageclip-hidden', '');
        hidden.push(element);
      }
    }
  }

  return {
    dispose() {
      style.remove();
      for (const element of hidden) element.removeAttribute('data-pageclip-hidden');
    }
  };
}

function snapshotScroll(scroller) {
  const pageX = window.scrollX;
  const pageY = window.scrollY;
  const innerX = scroller?.scrollLeft ?? 0;
  const innerY = scroller?.scrollTop ?? 0;

  return () => {
    if (scroller) {
      scroller.scrollLeft = innerX;
      scroller.scrollTop = innerY;
    }
    window.scrollTo({ left: pageX, top: pageY, behavior: 'instant' });
  };
}

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function inflate(domRect, padding = 0) {
  return rect(domRect.left - padding, domRect.top - padding, domRect.width + padding * 2, domRect.height + padding * 2);
}

function intersection(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  return rect(left, top, Math.max(0, Math.min(a.right, b.right) - left), Math.max(0, Math.min(a.bottom, b.bottom) - top));
}

function clampTo(area, maxWidth, maxHeight) {
  const left = Math.max(0, area.left);
  const top = Math.max(0, area.top);
  return rect(left, top, Math.max(0, Math.min(area.right, maxWidth) - left), Math.max(0, Math.min(area.bottom, maxHeight) - top));
}

/** Janela pela qual o alvo pode ser visto: a viewport, ou a parte visível do container. */
function visibleWindow(scroller) {
  const viewport = rect(0, 0, viewportWidth(), viewportHeight());
  if (!scroller) return viewport;

  const box = scroller.getBoundingClientRect();
  const client = rect(box.left + scroller.clientLeft, box.top + scroller.clientTop, scroller.clientWidth, scroller.clientHeight);
  return intersection(client, viewport);
}

/** Reduz a escala de saída até a imagem caber nos limites de canvas do navegador. */
function fitToCanvasLimits(width, height, scale) {
  let factor = scale;
  const side = Math.max(width, height) * factor;
  if (side > MAX_SIDE) factor *= MAX_SIDE / side;

  const area = width * factor * (height * factor);
  if (area > MAX_AREA) factor *= Math.sqrt(MAX_AREA / area);

  return {
    scale: factor,
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor))
  };
}

function viewportWidth() {
  return document.documentElement.clientWidth || window.innerWidth;
}

function viewportHeight() {
  return document.documentElement.clientHeight || window.innerHeight;
}

function documentWidth() {
  const { documentElement: root, body } = document;
  return Math.max(root.scrollWidth, body?.scrollWidth ?? 0, root.clientWidth);
}

function documentHeight() {
  const { documentElement: root, body } = document;
  return Math.max(root.scrollHeight, body?.scrollHeight ?? 0, root.clientHeight);
}

async function settle(delay) {
  await nextFrame();
  await nextFrame();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Espera o próximo quadro pintado — mas com prazo.
 *
 * `requestAnimationFrame` simplesmente para de disparar em aba sem composição
 * (segundo plano, janela minimizada). Sem o prazo, uma captura pega nesse
 * estado ficaria pendurada para sempre, com a interface escondida e o modo
 * travado até recarregar a página.
 */
function nextFrame() {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, 200);
    requestAnimationFrame(() => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

/** Blob -> data URL, para mandar a imagem ao service worker. */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível serializar a imagem.'));
    reader.readAsDataURL(blob);
  });
}
