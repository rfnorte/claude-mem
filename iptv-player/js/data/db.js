/**
 * IndexedDB — wrapper mínimo baseado em Promises.
 * Usado no thread principal e no Web Worker de importação.
 *
 * O esquema completo é criado já na versão 1 (incluindo EPG, favoritos e
 * histórico usados em fases seguintes) para evitar migrações desnecessárias.
 */

export const DB_NAME = 'iptv-player';
export const DB_VERSION = 1;

export const STORES = {
  sources: 'sources',
  items: 'items',
  favorites: 'favorites',
  history: 'history',
  settings: 'settings',
  keys: 'keys',
  epgChannels: 'epgChannels',
  epgProgrammes: 'epgProgrammes',
};

let dbPromise = null;

function upgrade(db) {
  if (!db.objectStoreNames.contains('sources')) db.createObjectStore('sources', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('items')) {
    const s = db.createObjectStore('items', { keyPath: 'id' });
    s.createIndex('sourceId', 'sourceId');
    s.createIndex('source_kind', ['sourceId', 'kind']);
    s.createIndex('source_series', ['sourceId', 'seriesKey']);
  }
  if (!db.objectStoreNames.contains('favorites')) {
    const s = db.createObjectStore('favorites', { keyPath: 'key' });
    s.createIndex('kind', 'kind');
  }
  if (!db.objectStoreNames.contains('history')) {
    const s = db.createObjectStore('history', { keyPath: 'key' });
    s.createIndex('kind', 'kind');
    s.createIndex('updatedAt', 'updatedAt');
  }
  if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
  if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('epgChannels')) db.createObjectStore('epgChannels', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('epgProgrammes')) {
    const s = db.createObjectStore('epgProgrammes', { keyPath: ['channelId', 'start'] });
    s.createIndex('channelId', 'channelId');
    s.createIndex('stop', 'stop');
  }
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Este browser não suporta armazenamento local (IndexedDB).'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => {
      const db = req.result;
      // Outra aba/worker pediu nova versão ou eliminação → fechar para não bloquear.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error ?? new Error('Não foi possível abrir a base de dados local.')); };
    req.onblocked = () => { /* aguarda que outras ligações fechem */ };
  });
  return dbPromise;
}

export const promisify = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/**
 * Executa `fn(stores)` numa transação e resolve quando a transação termina.
 * @template T
 * @param {string|string[]} names
 * @param {'readonly'|'readwrite'} mode
 * @param {(stores: Record<string, IDBObjectStore>, tx: IDBTransaction) => T|Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTx(names, mode, fn) {
  const db = await openDb();
  const list = Array.isArray(names) ? names : [names];
  const tx = db.transaction(list, mode);
  const stores = Object.fromEntries(list.map((n) => [n, tx.objectStore(n)]));
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transação cancelada.'));
  });
  const result = await fn(stores, tx);
  await done;
  return result;
}

export const get = (store, key) => withTx(store, 'readonly', (s) => promisify(s[store].get(key)));
export const getAll = (store) => withTx(store, 'readonly', (s) => promisify(s[store].getAll()));
export const getAllByIndex = (store, index, query) =>
  withTx(store, 'readonly', (s) => promisify(s[store].index(index).getAll(query)));
export const countByIndex = (store, index, query) =>
  withTx(store, 'readonly', (s) => promisify(s[store].index(index).count(query)));
export const put = (store, value) => withTx(store, 'readwrite', (s) => promisify(s[store].put(value)));
export const del = (store, key) => withTx(store, 'readwrite', (s) => promisify(s[store].delete(key)));

export function putMany(store, values) {
  return withTx(store, 'readwrite', (s) => { for (const v of values) s[store].put(v); });
}

/** Elimina todos os registos de um índice com uma dada chave. Devolve quantos apagou. */
export function deleteByIndex(store, index, query, keep) {
  return withTx(store, 'readwrite', (s) => new Promise((resolve, reject) => {
    let n = 0;
    const req = s[store].index(index).openCursor(query);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(n); return; }
      if (!keep || !keep(cursor.value)) { cursor.delete(); n++; }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

/** Fecha a ligação e apaga a base de dados inteira. */
export async function deleteDatabase() {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch { /* ignora */ }
    dbPromise = null;
  }
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // será concluída quando as outras ligações fecharem
  });
}
