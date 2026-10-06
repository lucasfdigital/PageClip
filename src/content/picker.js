/**
 * Seleção de alvos na árvore do DOM.
 *
 * Duas diferenças em relação ao "elementFromPoint e pronto":
 *   - atravessa shadow roots abertos, então dá para escolher partes internas de
 *     web components (YouTube, Reddit, sites com design system próprio);
 *   - a navegação por teclado anda pela árvore real (pai / filho / irmãos) em vez
 *     de fazer busca em largura, então subir e descer é reversível e previsível.
 */

/** Elementos que nunca fazem sentido como alvo direto. */
const INVISIBLE_TAGS = new Set(['script', 'style', 'link', 'meta', 'title', 'head', 'br', 'template', 'noscript']);

/**
 * Elemento sob o ponteiro, entrando em shadow roots abertos.
 * @param {number} x
 * @param {number} y
 * @returns {Element|null}
 */
export function deepElementFromPoint(x, y) {
  let node = document.elementFromPoint(x, y);

  for (let depth = 0; depth < 32; depth += 1) {
    const inner = node?.shadowRoot?.elementFromPoint(x, y);
    if (!inner || inner === node) break;
    node = inner;
  }

  return node;
}

/** O alvo é grande o bastante e faz sentido capturar? */
export function isCapturable(element, minSize = 4) {
  if (!(element instanceof Element)) return false;
  if (element === document.documentElement) return false;
  if (INVISIBLE_TAGS.has(element.localName)) return false;

  const rect = element.getBoundingClientRect();
  return rect.width >= minSize && rect.height >= minSize;
}

/** Cadeia de ancestrais (do mais próximo ao mais distante), cruzando shadow roots. */
export function ancestors(element, limit = 12) {
  const chain = [];
  let node = parentOf(element);

  while (node && chain.length < limit) {
    if (isCapturable(node, 1)) chain.push(node);
    node = parentOf(node);
  }

  return chain;
}

/** Sobe um nível na árvore, pulando wrappers degenerados. */
export function parentTarget(element) {
  let node = parentOf(element);

  while (node) {
    if (isCapturable(node, 1) && node !== document.documentElement) return node;
    node = parentOf(node);
  }

  return null;
}

/** Desce para o primeiro filho capturável (inclui o conteúdo de shadow roots). */
export function childTarget(element) {
  for (const child of childrenOf(element)) {
    if (isCapturable(child)) return child;
  }

  // Nenhum filho direto serve: tenta os netos antes de desistir.
  for (const child of childrenOf(element)) {
    const deeper = childTarget(child);
    if (deeper) return deeper;
  }

  return null;
}

/**
 * Irmão anterior/seguinte que dá para capturar.
 * @param {Element} element
 * @param {-1|1} direction
 */
export function siblingTarget(element, direction) {
  let node = element;

  while (node) {
    node = direction < 0 ? node.previousElementSibling : node.nextElementSibling;
    if (node && isCapturable(node)) return node;
  }

  return null;
}

/** Rótulo curto para o balão do destaque: `div.card#hero`. */
export function describe(element) {
  if (!(element instanceof Element)) return '';

  const id = element.id && isSimpleIdent(element.id) ? `#${element.id}` : '';
  const cls = classNames(element)
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join('');

  return `${element.localName}${id}${cls}`;
}

/**
 * Caminho CSS aproximado, útil para colar em devtools ou num teste.
 * Shadow roots aparecem como `host >> filho`, que é a notação do Playwright.
 */
export function cssPath(element, maxDepth = 8) {
  const parts = [];
  let node = element;

  while (node instanceof Element && parts.length < maxDepth) {
    if (node.id && isSimpleIdent(node.id)) {
      parts.unshift(`#${node.id}`);
      break;
    }

    parts.unshift(nodeSelector(node));

    const parent = node.parentElement;
    if (parent) {
      node = parent;
      continue;
    }

    const root = node.getRootNode();
    if (root instanceof ShadowRoot) {
      parts.unshift('>>');
      node = root.host;
      continue;
    }

    break;
  }

  return parts.join(' > ').replace(/ > >> > /g, ' >> ');
}

/**
 * Menor retângulo (em coordenadas da viewport) em que o elemento pode aparecer,
 * considerando todo ancestral que corta o conteúdo com overflow.
 */
export function clipRect(element) {
  let rect = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  let node = parentOf(element);

  while (node instanceof Element) {
    const style = getComputedStyle(node);
    if (style.overflow !== 'visible' || style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      rect = intersect(rect, node.getBoundingClientRect());
    }
    node = parentOf(node);
  }

  return rect;
}

/** Ancestral com rolagem própria que corta o elemento, ou null se quem rola é a página. */
export function scrollableAncestor(element) {
  let node = parentOf(element);

  while (node instanceof Element) {
    if (node === document.body || node === document.documentElement) return null;

    const style = getComputedStyle(node);
    const scrollsY = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    const scrollsX = /(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
    if (scrollsY || scrollsX) return node;

    node = parentOf(node);
  }

  return null;
}

/** Está dentro de um iframe (ou é um)? Serve para avisar o usuário. */
export function isFrameRelated(element) {
  return element?.localName === 'iframe' || element?.localName === 'frame' || window.top !== window;
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function parentOf(node) {
  if (!node) return null;
  if (node.parentElement) return node.parentElement;

  const root = node.parentNode ?? node.getRootNode?.();
  return root instanceof ShadowRoot ? root.host : null;
}

function childrenOf(element) {
  const own = element.shadowRoot ? [...element.shadowRoot.children] : [];
  return [...own, ...element.children];
}

/**
 * Classes do elemento, sem as nossas.
 *
 * Enquanto o modo de captura está ligado, o `<html>` carrega `pageclip-on` (é
 * ela que troca o cursor). Sem este filtro o seletor copiado sairia como
 * `html.pageclip-on > body > main` — que não casa com nada depois que a
 * extensão sai de cena, justamente quando a pessoa vai colar no devtools.
 */
function classNames(element) {
  return [...(element.classList ?? [])].filter((name) => name && !name.startsWith('__') && !name.startsWith('pageclip-'));
}

function nodeSelector(node) {
  let selector = node.localName;

  const [firstClass] = classNames(node);
  if (firstClass) selector += `.${CSS.escape(firstClass)}`;

  const parent = node.parentElement;
  if (parent) {
    const twins = [...parent.children].filter((child) => child.localName === node.localName);
    if (twins.length > 1) selector += `:nth-of-type(${twins.indexOf(node) + 1})`;
  }

  return selector;
}

function isSimpleIdent(value) {
  return /^[A-Za-z][\w-]*$/.test(value);
}

function intersect(a, b) {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom)
  };
}
