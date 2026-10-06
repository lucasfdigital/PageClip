/**
 * Galeria persistente (IndexedDB, origem da extensão).
 *
 * Guardamos o Blob original mais uma miniatura, então a listagem do hub carrega
 * rápido mesmo com dezenas de capturas grandes. Só o service worker escreve;
 * o hub lê e apaga.
 */

// Nome interno mantido após o rename para PageClip: trocar aqui órfã
// a galeria de quem já usava a extensão.
const DB_NAME = 'neoshot';
const DB_VERSION = 1;
const STORE = 'captures';
const INDEX_CREATED = 'createdAt';

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex(INDEX_CREATED, 'createdAt');
      }
    };

    request.onsuccess = () => {
      // Se outra aba pedir upgrade, soltamos a conexão para não travá-la.
      request.result.onversionchange = () => {
        request.result.close();
        dbPromise = null;
      };
      resolve(request.result);
    };

    request.onerror = () => reject(request.error);
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

async function withStore(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const result = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(result.value);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Wrapper para capturar o resultado de um request dentro da transação. */
function collect(request) {
  const box = { value: undefined };
  request.onsuccess = () => {
    box.value = request.result;
  };
  return box;
}

/**
 * @typedef {object} CaptureRecord
 * @property {string} id
 * @property {number} createdAt epoch ms
 * @property {Blob} blob imagem final
 * @property {Blob|null} thumb miniatura para a listagem
 * @property {object} meta dados descritivos (url, seletor, dimensões, ...)
 */

/** Insere uma captura. */
export async function putCapture(record) {
  await withStore('readwrite', (store) => collect(store.put(record)));
  return record.id;
}

/** Lista as capturas da mais recente para a mais antiga (sem os blobs originais). */
export async function listCaptures() {
  const items = await withStore('readonly', (store) => {
    const box = { value: [] };
    const cursorRequest = store.index(INDEX_CREATED).openCursor(null, 'prev');
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const { blob, ...rest } = cursor.value;
      box.value.push({ ...rest, bytes: blob?.size ?? 0 });
      cursor.continue();
    };
    return box;
  });

  return items;
}

/** Devolve o registro completo, com o Blob original. */
export function getCapture(id) {
  return withStore('readonly', (store) => collect(store.get(id)));
}

/** Remove uma captura. */
export function deleteCapture(id) {
  return withStore('readwrite', (store) => collect(store.delete(id)));
}

/** Esvazia a galeria. */
export function clearCaptures() {
  return withStore('readwrite', (store) => collect(store.clear()));
}

/** Quantidade de capturas guardadas. */
export function countCaptures() {
  return withStore('readonly', (store) => collect(store.count()));
}

/** Apaga as capturas mais antigas até sobrarem no máximo `limit`. */
export async function pruneTo(limit) {
  const total = await countCaptures();
  let excess = total - Math.max(0, limit);
  if (excess <= 0) return 0;

  const removed = excess;
  await withStore('readwrite', (store) => {
    const box = { value: removed };
    const cursorRequest = store.index(INDEX_CREATED).openCursor(null, 'next');
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor || excess <= 0) return;
      cursor.delete();
      excess -= 1;
      cursor.continue();
    };
    return box;
  });

  return removed;
}
