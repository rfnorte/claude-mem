/**
 * Web Worker de importação: transfere, analisa, classifica e grava listas
 * sem bloquear a interface. Comunica por mensagens:
 *
 *  ← {cmd: 'import', sourceId, job, overrides}
 *       job: {type: 'm3u-url', url} | {type: 'm3u-file', file} | {type: 'xtream', server, username, password}
 *  ← {cmd: 'reclassify', sourceId, overrides}
 *  → {type: 'progress', phase, bytes, total, entries}
 *  → {type: 'done', summary}
 *  → {type: 'error', code, message, hint}
 *
 * As credenciais existem apenas em memória durante a importação.
 * Em caso de erro, os dados anteriores da fonte mantêm-se intactos.
 */
import { M3UParser } from '../iptv/m3u-parser.js';
import { createM3UCollector, buildXtreamItems } from '../iptv/collector.js';
import { createXtreamClient } from '../iptv/xtream-api.js';
import { fetchWithTimeout, readTextStream, NetError } from '../iptv/net.js';
import { putMany, getAllByIndex, deleteByIndex } from '../data/db.js';

const BATCH = 500;
let lastProgress = 0;

function progress(data, force = false) {
  const now = Date.now();
  if (!force && now - lastProgress < 200) return;
  lastProgress = now;
  self.postMessage({ type: 'progress', ...data });
}

async function writeInBatches(items, onWritten) {
  for (let i = 0; i < items.length; i += BATCH) {
    await putMany('items', items.slice(i, i + BATCH));
    onWritten?.(Math.min(items.length, i + BATCH));
  }
}

/** Remove itens desta fonte que já não existem na nova versão da lista. */
async function removeStale(sourceId, ids, { keepEpisodes = false } = {}) {
  return deleteByIndex('items', 'sourceId', IDBKeyRange.only(sourceId),
    (item) => ids.has(item.id) || (keepEpisodes && item.kind === 'episode'));
}

/* ---------------- M3U (URL, ficheiro ou reclassificação) ---------------- */
async function importM3U(sourceId, stream, total, overrides) {
  const collector = createM3UCollector(sourceId, overrides);
  let pending = [];
  const parser = new M3UParser((entry) => {
    const item = collector.add(entry);
    if (item) pending.push(item);
  });

  let bytes = 0;
  await readTextStream(stream, async (text, read) => {
    bytes = read;
    parser.feed(text);
    if (pending.length >= BATCH) {
      const batch = pending;
      pending = [];
      await putMany('items', batch);
    }
    progress({ phase: 'parse', bytes, total, entries: parser.stats.entries });
  });
  const stats = parser.end();

  if (stats.entries === 0) {
    if (stats.hlsTags) {
      throw new NetError('format', 'Este endereço é um stream de vídeo (HLS), não uma lista de canais.', {
        hint: 'Use o endereço da lista fornecido pelo seu fornecedor (normalmente termina em get.php?… ou .m3u).',
      });
    }
    if (!stats.header) {
      throw new NetError('format', 'O conteúdo recebido não é uma lista M3U.', {
        hint: 'O endereço pode apontar para uma página web ou para um único stream. Confirme o URL fornecido.',
      });
    }
    throw new NetError('empty', 'A lista está vazia ou não contém endereços válidos.');
  }

  if (pending.length) await putMany('items', pending);
  progress({ phase: 'save', bytes, total, entries: stats.entries }, true);
  await writeInBatches(collector.seriesItems());
  const removed = await removeStale(sourceId, collector.ids);

  return {
    ...collector.counts,
    entries: stats.entries,
    invalid: stats.invalid,
    unsupported: stats.unsupported,
    orphanInfo: stats.orphanInfo,
    removed,
    groups: collector.groups(),
    epgUrls: parser.epgUrls.slice(0, 5),
    bytes,
  };
}

async function importM3UUrl(sourceId, url, overrides) {
  progress({ phase: 'connect' }, true);
  const res = await fetchWithTimeout(url, { timeoutMs: 30_000 });
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) throw new NetError('empty', 'O servidor não devolveu conteúdo.');
  return importM3U(sourceId, res.body, total, overrides);
}

async function importM3UFile(sourceId, file, overrides) {
  if (!file || typeof file.stream !== 'function') throw new NetError('format', 'Ficheiro inválido.');
  return importM3U(sourceId, file.stream(), file.size, overrides);
}

/** Reaplica a classificação aos itens já guardados (após corrigir categorias). */
async function reclassify(sourceId, overrides) {
  const stored = (await getAllByIndex('items', 'sourceId', IDBKeyRange.only(sourceId)))
    .filter((i) => i.kind !== 'series' && i.url)
    .sort((a, b) => a.order - b.order);
  const collector = createM3UCollector(sourceId, overrides);
  const items = [];
  for (const i of stored) {
    const item = collector.add({ name: i.name, url: i.url, group: i.group, logo: i.logo, tvgId: i.tvgId, tvgName: i.tvgName, chno: i.chno, duration: i.duration });
    if (item) items.push(item);
  }
  await writeInBatches(items, (n) => progress({ phase: 'save', entries: n }));
  await writeInBatches(collector.seriesItems());
  const removed = await removeStale(sourceId, collector.ids);
  return { ...collector.counts, entries: items.length, removed, groups: collector.groups() };
}

/* ---------------- Xtream ---------------- */
async function importXtream(sourceId, { server, username, password }) {
  progress({ phase: 'connect' }, true);
  const client = createXtreamClient({ server, username, password });
  const account = await client.authenticate();

  progress({ phase: 'download', entries: 0 }, true);
  // Algumas contas não têm VOD/séries: essas falhas não invalidam a importação.
  const optional = (p) => p.catch((err) => ({ __error: err }));
  const [liveCats, live, vodCats, vod, seriesCats, series] = await Promise.all([
    client.liveCategories(), client.liveStreams(),
    optional(client.vodCategories()), optional(client.vodStreams()),
    optional(client.seriesCategories()), optional(client.series()),
  ]);
  const ok = (v) => (Array.isArray(v) ? v : []);
  const warnings = [vod, series].filter((v) => v?.__error).map((v) => v.__error.message);

  const built = buildXtreamItems(sourceId, {
    liveCats, live, vodCats: ok(vodCats), vod: ok(vod), seriesCats: ok(seriesCats), series: ok(series),
  });
  if (built.items.length === 0) throw new NetError('empty', 'A conta não tem canais, filmes nem séries disponíveis.');

  await writeInBatches(built.items, (n) => progress({ phase: 'save', entries: n }));
  const removed = await removeStale(sourceId, built.ids, { keepEpisodes: true });
  return {
    ...built.counts,
    entries: built.items.length,
    removed,
    warnings,
    account: { status: account.status, expiresAt: account.expiresAt, maxConnections: account.maxConnections },
  };
}

self.onmessage = async ({ data }) => {
  try {
    let summary;
    if (data.cmd === 'reclassify') summary = await reclassify(data.sourceId, data.overrides ?? {});
    else if (data.job?.type === 'm3u-url') summary = await importM3UUrl(data.sourceId, data.job.url, data.overrides ?? {});
    else if (data.job?.type === 'm3u-file') summary = await importM3UFile(data.sourceId, data.job.file, data.overrides ?? {});
    else if (data.job?.type === 'xtream') summary = await importXtream(data.sourceId, data.job);
    else throw new NetError('format', 'Pedido de importação inválido.');
    self.postMessage({ type: 'done', summary });
  } catch (err) {
    const e = err instanceof NetError ? err : new NetError('format', err?.message || 'Erro inesperado durante a importação.');
    self.postMessage({ type: 'error', code: e.code, message: e.message, hint: e.hint ?? null });
  }
};
