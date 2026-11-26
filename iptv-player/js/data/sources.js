/**
 * Repositório de fontes IPTV (listas M3U e contas Xtream).
 *
 * Segredos (URL da lista — que muitas vezes contém credenciais —, utilizador e
 * password Xtream) são guardados cifrados. Para mostrar ao utilizador guarda-se
 * apenas o nome do servidor.
 */
import { getAll, get, put, del, deleteByIndex } from './db.js';
import { encryptText, decryptText } from './crypto.js';
import { createEmitter } from '../core/store.js';

export const sourceEvents = createEmitter();

const newId = () => `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };

export const SOURCE_TYPES = {
  'm3u-url': 'Lista M3U (endereço)',
  'm3u-file': 'Lista M3U (ficheiro)',
  xtream: 'Xtream Codes',
};

export async function listSources() {
  return (await getAll('sources')).sort((a, b) => a.createdAt - b.createdAt);
}

export const getSource = (id) => get('sources', id);

async function secretsFor(type, input) {
  if (type === 'm3u-url') return { url: await encryptText(input.url) };
  if (type === 'xtream') {
    return {
      username: await encryptText(input.username),
      password: await encryptText(input.password),
    };
  }
  return {};
}

/**
 * @param {{name: string, type: 'm3u-url'|'m3u-file'|'xtream', url?: string, server?: string,
 *          username?: string, password?: string, refreshHours?: number, fileName?: string, fileSize?: number}} input
 */
export async function createSource(input) {
  const now = Date.now();
  const source = {
    id: newId(),
    name: input.name.trim().slice(0, 80),
    type: input.type,
    enabled: true,
    refreshHours: input.type === 'm3u-file' ? 0 : Number(input.refreshHours) || 0,
    createdAt: now,
    updatedAt: now,
    lastUpdated: null,
    status: 'new',
    lastError: null,
    counts: { live: 0, movie: 0, series: 0 },
    host: input.type === 'xtream' ? hostOf(input.server) : input.type === 'm3u-url' ? hostOf(input.url) : null,
    insecure: (input.type === 'xtream' ? input.server : input.url ?? '').startsWith('http:'),
    server: input.type === 'xtream' ? input.server : null,
    fileName: input.fileName ?? null,
    fileSize: input.fileSize ?? null,
    overrides: {},
    groups: [],
    account: null,
    warnings: [],
    secrets: await secretsFor(input.type, input),
  };
  await put('sources', source);
  sourceEvents.emit('changed', { id: source.id });
  return source;
}

/** Atualiza campos não sensíveis e, opcionalmente, os segredos. */
export async function updateSource(id, patch, secretInput) {
  const current = await getSource(id);
  if (!current) throw new Error('Lista não encontrada.');
  const next = { ...current, ...patch, updatedAt: Date.now() };
  if (secretInput) {
    const merged = { ...(await getCredentials(current)), ...Object.fromEntries(Object.entries(secretInput).filter(([, v]) => v)) };
    next.secrets = await secretsFor(current.type, merged);
    if (current.type === 'm3u-url' && secretInput.url) { next.host = hostOf(secretInput.url); next.insecure = secretInput.url.startsWith('http:'); }
    if (current.type === 'xtream' && secretInput.server) { next.server = secretInput.server; next.host = hostOf(secretInput.server); next.insecure = secretInput.server.startsWith('http:'); }
  }
  await put('sources', next);
  sourceEvents.emit('changed', { id });
  return next;
}

/** Credenciais em claro — usar apenas no momento do pedido; nunca guardar nem registar. */
export async function getCredentials(source) {
  if (source.type === 'm3u-url') return { url: await decryptText(source.secrets.url) };
  if (source.type === 'xtream') {
    return {
      server: source.server,
      username: await decryptText(source.secrets.username),
      password: await decryptText(source.secrets.password),
    };
  }
  return {};
}

export async function deleteSource(id) {
  await deleteByIndex('items', 'sourceId', IDBKeyRange.only(id));
  await del('sources', id);
  sourceEvents.emit('changed', { id, deleted: true });
}
