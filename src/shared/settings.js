/**
 * Preferências do usuário.
 *
 * Ficam em `chrome.storage.sync` (poucos bytes, acompanham o perfil) e passam
 * por `normalize()` na leitura e na escrita, então o resto do código pode
 * confiar nos tipos sem ficar validando de novo.
 */

export const DEFAULTS = Object.freeze({
  /** Último modo usado, restaurado ao abrir o seletor. */
  mode: 'element',
  /** png | jpeg | webp */
  format: 'png',
  /** Qualidade de jpeg/webp (0.4 a 1). */
  quality: 0.92,
  /** Folga em pixels CSS ao redor do elemento. */
  padding: 10,
  /** Cor de fundo aplicada quando o formato não tem alfa. */
  matte: '#ffffff',
  /** device = resolução física da tela; css = 1 pixel CSS por pixel. */
  scale: 'device',
  /** Copia para a área de transferência assim que captura. */
  copyOnCapture: true,
  /** Baixa o arquivo assim que captura. */
  downloadOnCapture: true,
  /** Guarda a captura na galeria da extensão. */
  saveToGallery: true,
  /** Esconde elementos fixos/sticky ao costurar capturas roladas. */
  hideFixed: true,
  /** Espera por quadro de rolagem, em ms (dá tempo pro lazy-load). */
  tileDelay: 150,
  /** Tokens: {site} {tag} {mode} {date} {time} {w} {h} */
  filenameTemplate: 'pageclip-{site}-{tag}-{date}-{time}',
  /** Quantas capturas a galeria mantém. */
  historyLimit: 40,
  /** Azul principal (BoardUI blue-600). Sem ajuste na interface. */
  accent: '#2563eb',
  /** Mostra seletor e dimensões junto do destaque. */
  showLabels: true
});

const FORMATS = ['png', 'jpeg', 'webp'];
const MODES = ['element', 'region', 'page'];
const SCALES = ['device', 'css'];

/** MIME correspondente a cada formato suportado. */
export const MIME = Object.freeze({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' });

/** Extensão de arquivo de cada formato. */
export const EXTENSION = Object.freeze({ png: 'png', jpeg: 'jpg', webp: 'webp' });

/** Formatos com canal alfa; os demais recebem o `matte` por baixo. */
export function hasAlpha(format) {
  return format !== 'jpeg';
}

/** Devolve as preferências completas, com defaults preenchidos. */
export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return normalize(stored);
}

/** Grava um patch parcial e devolve o resultado já normalizado. */
export async function patchSettings(patch) {
  const merged = normalize({ ...(await getSettings()), ...patch });
  await chrome.storage.sync.set(merged);
  return merged;
}

/** Restaura tudo para os valores de fábrica. */
export async function resetSettings() {
  await chrome.storage.sync.set(DEFAULTS);
  return { ...DEFAULTS };
}

/**
 * Observa mudanças nas preferências.
 * @returns {() => void} função para cancelar a inscrição.
 */
export function onSettingsChanged(callback) {
  const listener = (changes, area) => {
    if (area !== 'sync') return;
    getSettings().then(callback);
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Coage qualquer objeto para uma configuração válida. */
export function normalize(raw = {}) {
  return {
    mode: pick(raw.mode, MODES, DEFAULTS.mode),
    format: pick(raw.format, FORMATS, DEFAULTS.format),
    quality: clamp(number(raw.quality, DEFAULTS.quality), 0.4, 1),
    padding: Math.round(clamp(number(raw.padding, DEFAULTS.padding), 0, 200)),
    matte: color(raw.matte, DEFAULTS.matte),
    scale: pick(raw.scale, SCALES, DEFAULTS.scale),
    copyOnCapture: Boolean(raw.copyOnCapture),
    downloadOnCapture: Boolean(raw.downloadOnCapture),
    saveToGallery: raw.saveToGallery !== false,
    hideFixed: raw.hideFixed !== false,
    tileDelay: Math.round(clamp(number(raw.tileDelay, DEFAULTS.tileDelay), 0, 2000)),
    filenameTemplate: text(raw.filenameTemplate, DEFAULTS.filenameTemplate, 120),
    historyLimit: Math.round(clamp(number(raw.historyLimit, DEFAULTS.historyLimit), 0, 200)),
    accent: color(raw.accent, DEFAULTS.accent),
    showLabels: raw.showLabels !== false
  };
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function number(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function color(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function text(value, fallback, maxLength) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}
