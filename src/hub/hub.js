/**
 * Hub: galeria das capturas e ajustes.
 *
 * Roda numa aba da própria extensão, então lê o IndexedDB direto — o service
 * worker escreve, aqui a gente só consome. As miniaturas viram object URLs
 * revogadas a cada redesenho, o que evita segurar dezenas de megabytes de
 * imagem na memória enquanto a aba fica aberta.
 */

import { listCaptures, getCapture, deleteCapture, clearCaptures } from '../shared/db.js';
import { getSettings, patchSettings, resetSettings, normalize, DEFAULTS } from '../shared/settings.js';
import { buildFilename, formatBytes, formatRelative } from '../shared/format.js';

const el = {
  tabs: [...document.querySelectorAll('[role="tab"]')],
  panels: [...document.querySelectorAll('.tab-panel')],
  grid: document.getElementById('grid'),
  empty: document.getElementById('empty'),
  count: document.getElementById('count'),
  filter: document.getElementById('filter'),
  clear: document.getElementById('clear'),
  form: document.getElementById('form'),
  preview: document.getElementById('preview'),
  saved: document.getElementById('saved'),
  reset: document.getElementById('reset'),
  shortcuts: document.getElementById('shortcuts')
};

/** URLs vivas da listagem atual, para revogar antes de redesenhar. */
let liveUrls = [];
let captures = [];

// ---------------------------------------------------------------------- abas

function showTab(name) {
  for (const tab of el.tabs) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  for (const panel of el.panels) panel.hidden = panel.id !== name;
  if (location.hash.slice(1) !== name) history.replaceState(null, '', `#${name}`);
}

el.tabs.forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
showTab(['gallery', 'settings', 'help'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'gallery');

// ------------------------------------------------------------------- galeria

async function renderGallery() {
  captures = await listCaptures();
  paintGallery();
}

function paintGallery() {
  for (const url of liveUrls) URL.revokeObjectURL(url);
  liveUrls = [];

  const needle = el.filter.value.trim().toLowerCase();
  const visible = needle ? captures.filter((item) => haystack(item).includes(needle)) : captures;

  el.count.textContent = summarize(captures, visible, needle);
  el.empty.hidden = captures.length > 0;
  el.grid.replaceChildren(...visible.map(renderCard));
}

function summarize(all, visible, needle) {
  if (!all.length) return '';
  const total = formatBytes(all.reduce((sum, item) => sum + (item.bytes || 0), 0));
  if (needle) return `${visible.length} de ${all.length} capturas · ${total}`;
  return `${all.length} captura${all.length === 1 ? '' : 's'} · ${total}`;
}

function haystack(item) {
  const meta = item.meta ?? {};
  return `${meta.site ?? ''} ${meta.title ?? ''} ${meta.selector ?? ''} ${meta.filename ?? ''} ${meta.tag ?? ''}`.toLowerCase();
}

function renderCard(item) {
  const meta = item.meta ?? {};
  const card = document.createElement('article');
  card.className = 'card';

  const figure = document.createElement('figure');
  // Muito mais alta que larga (página inteira): mostra o topo em vez de encolher tudo.
  if (isTall(meta)) figure.dataset.tall = '1';

  const image = document.createElement('img');
  image.alt = meta.filename ?? 'captura';
  image.loading = 'lazy';

  if (item.thumb) {
    const url = URL.createObjectURL(item.thumb);
    liveUrls.push(url);
    image.src = url;
  }

  figure.append(image);

  const info = document.createElement('div');
  info.className = 'meta';

  const site = document.createElement('b');
  site.className = 'site';
  site.textContent = meta.site || 'página local';
  site.title = meta.title || meta.url || '';

  const selector = document.createElement('span');
  selector.className = 'sel';
  selector.textContent = meta.selector || meta.filename || '';
  selector.title = selector.textContent;

  const facts = document.createElement('div');
  facts.className = 'facts';
  facts.textContent = `${meta.width} × ${meta.height} · ${formatBytes(item.bytes)} · ${formatRelative(item.createdAt)}`;

  info.append(site, selector, facts);

  const actions = document.createElement('div');
  actions.className = 'acts';
  actions.append(
    action('Baixar', () => downloadCapture(item)),
    action('Copiar', (button) => copyCapture(item, button)),
    action('Abrir', () => openCapture(item)),
    action('Excluir', () => removeCapture(item), 'danger')
  );

  card.append(figure, info, actions);
  return card;
}

/**
 * Proporção a partir da qual encolher a imagem inteira deixa de informar nada.
 * 2,2 já é mais alta que a maioria dos elementos; página inteira passa fácil de 5.
 */
function isTall(meta) {
  return Number(meta?.height) / Math.max(1, Number(meta?.width)) > 2.2;
}

function action(label, handler, variant = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (variant) button.className = variant;
  button.addEventListener('click', () => handler(button));
  return button;
}

/** Feedback curto no próprio botão, sem precisar de toast global. */
async function withFeedback(button, label, task) {
  const original = button.textContent;
  try {
    await task();
    button.textContent = label;
  } catch (error) {
    button.textContent = 'Erro';
    console.error('[PageClip]', error);
  }
  setTimeout(() => {
    button.textContent = original;
  }, 1600);
}

async function downloadCapture(item) {
  const record = await getCapture(item.id);
  if (!record) return;

  const url = URL.createObjectURL(record.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = record.meta?.filename || 'pageclip.png';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function copyCapture(item, button) {
  await withFeedback(button, 'Copiado', async () => {
    const record = await getCapture(item.id);
    const png = await toPng(record.blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  });
}

async function openCapture(item) {
  const record = await getCapture(item.id);
  if (!record) return;
  // A aba fica dona da URL; revogar aqui mataria a imagem antes de ela carregar.
  window.open(URL.createObjectURL(record.blob), '_blank', 'noopener');
}

async function removeCapture(item) {
  await deleteCapture(item.id);
  captures = captures.filter((entry) => entry.id !== item.id);
  paintGallery();
}

el.filter.addEventListener('input', paintGallery);

el.clear.addEventListener('click', async () => {
  if (!captures.length) return;
  if (!confirm(`Apagar as ${captures.length} capturas guardadas? Isso não tem volta.`)) return;
  await clearCaptures();
  captures = [];
  paintGallery();
});

async function toPng(blob) {
  if (blob.type === 'image/png') return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

// ------------------------------------------------------------------- ajustes

/** Joga os valores nos campos. Só em carga/reset — nunca enquanto o usuário digita. */
function fillForm(settings) {
  for (const [key, value] of Object.entries(settings)) {
    const field = el.form.elements[key];
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value;
  }

  refreshDerived(settings);
}

/** Atualiza só o que é consequência dos campos (prévia, rótulos, visibilidade). */
function refreshDerived(settings) {
  const lossy = settings.format !== 'png';
  for (const row of el.form.querySelectorAll('[data-when-lossy]')) row.hidden = !lossy;

  el.form.elements.qualityOut.value = `${Math.round(settings.quality * 100)}%`;
  el.preview.textContent = buildFilename(settings.filenameTemplate, {
    site: 'exemplo.com',
    tag: 'article',
    mode: 'element',
    width: 960,
    height: 540,
    format: settings.format
  });
}

function readForm() {
  const raw = {};
  for (const key of Object.keys(DEFAULTS)) {
    const field = el.form.elements[key];
    if (!field) continue;
    raw[key] = field.type === 'checkbox' ? field.checked : field.value;
  }
  return normalize({ ...raw, mode: undefined });
}

let saveTimer = 0;

el.form.addEventListener('input', () => {
  const draft = readForm();
  refreshDerived(draft);

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { mode, ...rest } = draft;
    await patchSettings(rest);
    el.saved.textContent = 'Salvo';
    setTimeout(() => {
      el.saved.textContent = '';
    }, 1400);
  }, 250);
});

el.reset.addEventListener('click', async () => {
  fillForm(await resetSettings());
  el.saved.textContent = 'Padrões restaurados';
  setTimeout(() => {
    el.saved.textContent = '';
  }, 1800);
});

el.shortcuts.addEventListener('click', () => {
  // Páginas chrome:// não abrem por link, mas a própria extensão pode abri-las.
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ---------------------------------------------------------------------- boot

getSettings().then(fillForm);
renderGallery();

// Ajustes mudados em outro lugar (ou noutro dispositivo) chegam aqui. Enquanto o
// formulário está em foco a gente não mexe nele, para não mover o cursor de quem digita.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || el.form.contains(document.activeElement)) return;
  getSettings().then(fillForm);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderGallery();
});
