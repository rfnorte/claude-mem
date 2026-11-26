/**
 * Sincronização de fontes: corre a importação no Web Worker, atualiza o estado
 * da fonte e notifica a interface. Também oferece o "teste de ligação".
 *
 * Nota iOS: não há execução em segundo plano numa PWA. A "atualização
 * automática" é verificada quando a app é aberta (refreshDueSources).
 */
import { getSource, updateSource, listSources, getCredentials, sourceEvents } from '../data/sources.js';
import { createXtreamClient } from './xtream-api.js';
import { fetchWithTimeout, NetError } from './net.js';
import { createEmitter } from '../core/store.js';
import { formatCount } from '../core/format.js';

export const syncEvents = createEmitter();
const running = new Map();

function runWorker(message, onProgress) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('../workers/import.worker.js', import.meta.url), { type: 'module' });
    } catch {
      reject(new NetError('format', 'Este browser não suporta importação em segundo plano (Web Workers de módulo). Atualize o iOS.'));
      return;
    }
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data);
      else if (data.type === 'done') { worker.terminate(); resolve(data.summary); }
      else if (data.type === 'error') { worker.terminate(); reject(new NetError(data.code, data.message, { hint: data.hint })); }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new NetError('format', `Falha no processo de importação${e.message ? `: ${e.message}` : '.'}`));
    };
    worker.postMessage(message);
  });
}

async function persistStorage() {
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
}

/**
 * Importa (ou atualiza) uma fonte. Pedidos repetidos para a mesma fonte
 * reutilizam a importação em curso.
 * @param {string} sourceId
 * @param {{file?: File, onProgress?: Function}} [opts]
 */
export function importSource(sourceId, { file, onProgress } = {}) {
  if (running.has(sourceId)) return running.get(sourceId);
  const task = (async () => {
    const source = await getSource(sourceId);
    if (!source) throw new Error('Lista não encontrada.');

    let job;
    if (source.type === 'm3u-file') {
      if (!file) throw new NetError('format', 'Escolha novamente o ficheiro M3U para atualizar esta lista.');
      job = { type: 'm3u-file', file };
    } else if (source.type === 'm3u-url') {
      job = { type: 'm3u-url', ...(await getCredentials(source)) };
    } else {
      job = { type: 'xtream', ...(await getCredentials(source)) };
    }

    await updateSource(sourceId, { status: 'importing' });
    syncEvents.emit('start', { sourceId });
    persistStorage();

    try {
      const summary = await runWorker({ cmd: 'import', sourceId, job, overrides: source.overrides ?? {} }, (p) => {
        onProgress?.(p);
        syncEvents.emit('progress', { sourceId, ...p });
      });
      const patch = {
        status: 'ok',
        lastError: null,
        lastUpdated: Date.now(),
        counts: { live: summary.live, movie: summary.movie, series: summary.series },
        warnings: summary.warnings ?? [],
        ...(summary.groups ? { groups: summary.groups } : {}),
        ...(summary.account ? { account: summary.account } : {}),
        ...(summary.epgUrls?.length ? { epgUrls: summary.epgUrls } : {}),
        ...(file ? { fileName: file.name, fileSize: file.size } : {}),
      };
      await updateSource(sourceId, patch);
      syncEvents.emit('changed', { sourceId });
      syncEvents.emit('done', { sourceId, summary });
      return summary;
    } catch (err) {
      await updateSource(sourceId, {
        status: 'error',
        lastError: { code: err.code ?? 'format', message: err.message, hint: err.hint ?? null, at: Date.now() },
      });
      syncEvents.emit('error', { sourceId, error: err });
      throw err;
    }
  })().finally(() => running.delete(sourceId));
  running.set(sourceId, task);
  return task;
}

export const isImporting = (sourceId) => running.has(sourceId);

/** Reaplica a classificação após alterar as correções de categorias. */
export async function reclassifySource(sourceId, overrides, { onProgress } = {}) {
  await updateSource(sourceId, { overrides });
  const summary = await runWorker({ cmd: 'reclassify', sourceId, overrides }, onProgress);
  await updateSource(sourceId, {
    counts: { live: summary.live, movie: summary.movie, series: summary.series },
    groups: summary.groups,
  });
  syncEvents.emit('changed', { sourceId });
  return summary;
}

/** Atualiza fontes cujo intervalo de atualização expirou (ao abrir a app). */
export async function refreshDueSources({ onStart } = {}) {
  const now = Date.now();
  const due = (await listSources()).filter((s) => s.enabled && s.type !== 'm3u-file' && s.refreshHours > 0
    && s.status !== 'importing' && (!s.lastUpdated || now - s.lastUpdated > s.refreshHours * 3_600_000));
  const results = [];
  for (const s of due) {
    onStart?.(s);
    try { results.push({ source: s, summary: await importSource(s.id) }); }
    catch (error) { results.push({ source: s, error }); }
  }
  return results;
}

/**
 * Testa uma fonte SEM a guardar: confirma acesso e formato.
 * @returns {Promise<{ok: true, title: string, detail: string}>}
 */
export async function testConnection(input) {
  if (input.type === 'xtream') {
    const account = await createXtreamClient({ server: input.server, username: input.username, password: input.password }).authenticate();
    const parts = [];
    if (account.expiresAt) parts.push(`expira a ${new Date(account.expiresAt).toLocaleDateString('pt-PT')}`);
    if (account.maxConnections) parts.push(formatCount(account.maxConnections, 'ligação simultânea', 'ligações simultâneas'));
    return { ok: true, title: 'Conta ativa', detail: parts.length ? `Ligação estabelecida — ${parts.join(' · ')}.` : 'Ligação estabelecida.' };
  }

  const res = await fetchWithTimeout(input.url, { timeoutMs: 20_000 });
  const reader = res.body?.getReader();
  if (!reader) throw new NetError('empty', 'O servidor não devolveu conteúdo.');
  let text = '';
  const decoder = new TextDecoder();
  while (text.length < 64 * 1024) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  const head = text.replace(/^\ufeff/, '').trimStart();
  // Uma playlist HLS (stream de vídeo) também começa por #EXTM3U: distinguir primeiro.
  if (/^#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE|PLAYLIST-TYPE|KEY|MAP)\b/im.test(head)) {
    throw new NetError('format', 'Este endereço é um stream de vídeo (HLS), não uma lista de canais.', {
      hint: 'Use o endereço da lista fornecido pelo seu fornecedor (normalmente termina em get.php?… ou .m3u).',
    });
  }
  if (!/^#EXTM3U/i.test(head) && !/#EXTINF/i.test(head)) {
    throw new NetError('format', 'O conteúdo recebido não é uma lista M3U.', { hint: 'Confirme o endereço fornecido pelo seu fornecedor.' });
  }
  const size = Number(res.headers.get('content-length'));
  const approx = (head.match(/#EXTINF/gi) ?? []).length;
  return {
    ok: true,
    title: 'Lista acessível',
    detail: `Formato M3U válido${size ? ` · ${(size / 1_048_576).toFixed(1)} MB` : ''}${approx ? ` · ${approx}+ entradas no início do ficheiro` : ''}.`,
  };
}

// Mudanças nas fontes (editar/eliminar/ativar) também alteram o catálogo.
sourceEvents.on('changed', (e) => syncEvents.emit('changed', e));
