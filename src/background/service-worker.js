/**
 * Service worker: ponto de entrada da extensão.
 *
 * Faz três coisas e nada além disso:
 *   1. reage aos gatilhos do usuário (ícone, atalho, menu de contexto);
 *   2. injeta o content script sob demanda (modelo activeTab, sem host_permissions);
 *   3. executa o que só existe aqui — `captureVisibleTab` e a galeria em IndexedDB.
 *
 * O estado de "está selecionando?" NÃO é guardado aqui: o service worker pode ser
 * encerrado a qualquer momento e o Map ficaria mentindo. Em vez disso perguntamos
 * à aba (PING), que é a única fonte de verdade.
 */

import { ToBackground, ToContent, Mode, createMessageListener, askTab } from '../shared/protocol.js';
import { getSettings, MIME } from '../shared/settings.js';
import { putCapture, pruneTo, listCaptures, getCapture } from '../shared/db.js';

const CONTENT_BOOTSTRAP = 'src/content/boot.js';
const HUB_PAGE = 'src/hub-boardui/index.html';
const THUMB_MAX_SIDE = 360;

// ---------------------------------------------------------------------------
// Gatilhos
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'pick', title: 'Capturar elemento…', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'page', title: 'Capturar página inteira', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'sep', type: 'separator', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'hub', title: 'Abrir galeria do PageClip', contexts: ['all'] });
});

chrome.action.onClicked.addListener((tab) => {
  run(tab, async () => {
    const { mode } = await getSettings();
    await startPicker(tab.id, mode);
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  const tab = await activeTab();
  if (!tab) return;

  run(tab, async () => {
    if (command === 'capture-page') {
      await ensureContent(tab.id);
      await askTab(tab.id, ToContent.CAPTURE_NOW, { mode: Mode.PAGE });
      return;
    }

    const { mode } = await getSettings();
    await startPicker(tab.id, mode);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'hub') {
    openHub();
    return;
  }

  if (!tab?.id) return;

  run(tab, async () => {
    if (info.menuItemId === 'page') {
      await ensureContent(tab.id);
      await askTab(tab.id, ToContent.CAPTURE_NOW, { mode: Mode.PAGE });
      return;
    }

    await startPicker(tab.id, Mode.ELEMENT);
  });
});

// A badge é por aba; ao navegar, o content script morre e ela precisa sumir junto.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') setBadge(tabId, false);
});

/** Alterna: se a aba já está selecionando, o mesmo gatilho cancela. */
async function startPicker(tabId, mode) {
  const state = await ping(tabId);

  if (state?.picking) {
    await askTab(tabId, ToContent.STOP);
    return;
  }

  if (!state) await ensureContent(tabId);
  await askTab(tabId, ToContent.START, { mode });
}

// ---------------------------------------------------------------------------
// Injeção sob demanda
// ---------------------------------------------------------------------------

async function ping(tabId) {
  try {
    return await askTab(tabId, ToContent.PING);
  } catch {
    return null;
  }
}

async function ensureContent(tabId) {
  if (await ping(tabId)) return;

  await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_BOOTSTRAP] });

  // `executeScript` volta antes do `import()` dinâmico terminar de resolver,
  // então esperamos o módulo se anunciar.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await ping(tabId)) return;
    await sleep(50);
  }

  throw new Error('O PageClip não conseguiu iniciar nesta página.');
}

/** Executa uma ação e transforma falhas em feedback visível no ícone. */
async function run(tab, action) {
  try {
    await action();
  } catch (error) {
    console.error('[PageClip]', error);
    await flashError(tab?.id, describeFailure(error, tab));
  }
}

/**
 * Sem a permissão `tabs`, `tab.url` chega vazio justamente nas páginas
 * restritas — que é onde a gente precisaria dele. Então a detecção vem da
 * mensagem do próprio Chrome, e a URL só serve de reforço quando existe.
 */
function describeFailure(error, tab) {
  const message = error?.message || '';
  const url = tab?.url || '';

  const blocked =
    /cannot access|host permission|extension manifest|chrome:\/\/|showing error page/i.test(message) ||
    /^(chrome|edge|about|devtools|chrome-extension|view-source):/.test(url) ||
    url.startsWith('https://chromewebstore.google.com') ||
    url.startsWith('https://microsoftedge.microsoft.com');

  if (blocked) return 'O navegador bloqueia extensões nesta página. Abra um site normal e tente de novo.';
  return message || 'Falha inesperada.';
}

async function flashError(tabId, message) {
  if (!tabId) return;
  try {
    await chrome.action.setTitle({ tabId, title: `PageClip, ${message}` });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#e5484d' });
    await chrome.action.setBadgeText({ tabId, text: '!' });
    await sleep(4000);
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'PageClip, capturar elemento (Alt+Shift+S)' });
  } catch {
    // A aba pode ter sido fechada enquanto o aviso estava na tela.
  }
}

// ---------------------------------------------------------------------------
// Captura da viewport (serializada, com respeito à cota do Chrome)
// ---------------------------------------------------------------------------

let captureChain = Promise.resolve();
let lastCaptureAt = 0;
let minCaptureInterval = 90;

/**
 * `captureVisibleTab` é limitado a poucas chamadas por segundo quando a extensão
 * usa activeTab. Em vez de fixar um intervalo pessimista (que deixaria toda
 * captura costurada lenta), começamos rápido e só desaceleramos se o Chrome
 * reclamar de cota.
 */
function grabViewport(windowId) {
  const attempt = captureChain.then(async () => {
    for (let tries = 0; tries < 5; tries += 1) {
      const wait = minCaptureInterval - (Date.now() - lastCaptureAt);
      if (wait > 0) await sleep(wait);

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        lastCaptureAt = Date.now();
        return dataUrl;
      } catch (error) {
        lastCaptureAt = Date.now();
        if (!/quota|MAX_CAPTURE/i.test(error?.message || '')) throw error;
        minCaptureInterval = Math.min(600, Math.max(150, minCaptureInterval * 2));
      }
    }

    throw new Error('O Chrome limitou as capturas seguidas. Tente novamente em alguns segundos.');
  });

  captureChain = attempt.catch(() => {});
  return attempt;
}

// ---------------------------------------------------------------------------
// Galeria
// ---------------------------------------------------------------------------

async function saveCapture({ dataUrl, meta }) {
  const blob = await (await fetch(dataUrl)).blob();
  const record = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    blob,
    thumb: await makeThumbnail(blob),
    meta: { ...meta, bytes: blob.size }
  };

  await putCapture(record);
  const { historyLimit } = await getSettings();
  await pruneTo(historyLimit);
  return { id: record.id };
}

async function makeThumbnail(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, THUMB_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * ratio)), Math.max(1, Math.round(bitmap.height * ratio)));
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvas.convertToBlob({ type: MIME.webp, quality: 0.82 });
  } catch {
    return null; // sem miniatura o hub cai para o blob original
  }
}

/** Miniaturas recentes para o painel lateral do content script. */
async function recentCaptures(limit = 8) {
  const items = await listCaptures();
  return Promise.all(
    items.slice(0, limit).map(async (item) => ({
      id: item.id,
      createdAt: item.createdAt,
      meta: item.meta,
      thumb: item.thumb ? await blobToDataUrl(item.thumb) : null
    }))
  );
}

async function fullCapture(id) {
  const record = await getCapture(id);
  if (!record) throw new Error('Essa captura não está mais na galeria.');
  return { dataUrl: await blobToDataUrl(record.blob), meta: record.meta };
}

/**
 * Blob -> data URL sem `FileReader`, que não existe em service worker.
 * O fatiamento evita estourar a pilha em `String.fromCharCode(...)`.
 */
async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }

  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}

function openHub(hash = '') {
  return chrome.tabs.create({ url: chrome.runtime.getURL(HUB_PAGE) + hash });
}

// ---------------------------------------------------------------------------
// Roteador de mensagens
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  createMessageListener(async (type, payload, sender) => {
    switch (type) {
      case ToBackground.GRAB_VIEWPORT: {
        const windowId = sender.tab?.windowId;
        if (typeof windowId !== 'number') throw new Error('Captura pedida fora de uma aba.');
        return { dataUrl: await grabViewport(windowId) };
      }

      case ToBackground.SAVE_CAPTURE:
        return saveCapture(payload);

      case ToBackground.LIST_CAPTURES:
        return recentCaptures(payload?.limit);

      case ToBackground.GET_CAPTURE:
        return fullCapture(payload?.id);

      case ToBackground.SET_PICKING:
        setBadge(sender.tab?.id, payload?.picking);
        return { ok: true };

      case ToBackground.OPEN_HUB:
        await openHub(payload?.hash || '');
        return { ok: true };

      default:
        return undefined;
    }
  })
);

async function setBadge(tabId, picking) {
  if (!tabId) return;
  try {
    if (picking) {
      const { accent } = await getSettings();
      await chrome.action.setBadgeBackgroundColor({ tabId, color: accent });
      await chrome.action.setBadgeText({ tabId, text: '●' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch {
    // aba fechada no meio do caminho
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
