/**
 * Contrato de mensagens entre content script, service worker e páginas da extensão.
 *
 * Todas as mensagens usam o envelope `{ type, payload }` e toda resposta usa
 * `{ ok, data, error }`. Isso evita o "às vezes é objeto, às vezes é undefined"
 * que costuma aparecer quando cada handler inventa o próprio formato.
 */

/** Mensagens que o service worker atende. */
export const ToBackground = Object.freeze({
  /** Devolve um PNG dataURL da viewport visível da aba que pediu. */
  GRAB_VIEWPORT: 'bg:grab-viewport',
  /** Persiste uma captura na galeria (IndexedDB da extensão). */
  SAVE_CAPTURE: 'bg:save-capture',
  /** Lista as capturas recentes (miniaturas) para o painel lateral. payload: { limit } */
  LIST_CAPTURES: 'bg:list-captures',
  /** Recupera a imagem cheia de uma captura guardada. payload: { id } */
  GET_CAPTURE: 'bg:get-capture',
  /** Marca a aba como em modo de seleção (badge do ícone). */
  SET_PICKING: 'bg:set-picking',
  /** Abre a página do hub numa aba nova. */
  OPEN_HUB: 'bg:open-hub',
  /** Abre o repositório do PageClip no GitHub numa aba nova. */
  OPEN_GITHUB: 'bg:open-github',
  /** Devolve a contagem de stars do GitHub (com cache local de 12h). */
  GET_STARS: 'bg:get-stars'
});

/** Mensagens que o content script atende. */
export const ToContent = Object.freeze({
  /** Sonda de vida: usada para saber se já injetamos nesta aba. */
  PING: 'ct:ping',
  /** Entra em modo de seleção. payload: { mode } */
  START: 'ct:start',
  /** Sai do modo de seleção e limpa a UI. */
  STOP: 'ct:stop',
  /** Captura direta, sem seleção. payload: { mode } */
  CAPTURE_NOW: 'ct:capture-now'
});

/** Modos de captura suportados. */
export const Mode = Object.freeze({
  ELEMENT: 'element',
  REGION: 'region',
  PAGE: 'page'
});

/** Resposta de sucesso. */
export function ok(data = null) {
  return { ok: true, data };
}

/** Resposta de erro, sempre com string legível. */
export function fail(error) {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

/**
 * Adapta um roteador assíncrono ao formato de `chrome.runtime.onMessage`.
 *
 * O listener precisa devolver `true` de forma síncrona para manter o canal
 * aberto; encapsular isso aqui evita repetir o padrão (e esquecer dele) em
 * cada arquivo.
 *
 * @param {(type: string, payload: any, sender: chrome.runtime.MessageSender) => Promise<any>} handler
 *   Deve devolver os dados crus; `undefined` significa "não sei tratar isso".
 */
export function createMessageListener(handler) {
  return (message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;

    handler(message.type, message.payload, sender)
      .then((data) => sendResponse(data === undefined ? fail(`Mensagem não suportada: ${message.type}`) : ok(data)))
      .catch((error) => sendResponse(fail(error)));

    return true;
  };
}

/** Envia uma mensagem ao service worker e devolve os dados ou lança o erro. */
export async function askBackground(type, payload = null) {
  return unwrap(await chrome.runtime.sendMessage({ type, payload }));
}

/** Envia uma mensagem a uma aba e devolve os dados ou lança o erro. */
export async function askTab(tabId, type, payload = null) {
  return unwrap(await chrome.tabs.sendMessage(tabId, { type, payload }));
}

function unwrap(response) {
  if (!response) throw new Error('Sem resposta do outro lado da extensão.');
  if (!response.ok) throw new Error(response.error || 'Falha desconhecida.');
  return response.data;
}
