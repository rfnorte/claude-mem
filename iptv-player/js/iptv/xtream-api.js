/**
 * Cliente Xtream Codes (player_api.php).
 *
 * Não existe especificação oficial: cada fornecedor implementa variantes.
 * Este cliente valida cada resposta, aceita números em texto, nulls, objetos
 * em vez de arrays, e traduz erros para mensagens compreensíveis.
 *
 * Segurança: o protocolo envia username/password no URL. Se o servidor for
 * HTTP, viajam sem cifra — limitação do fornecedor, comunicada ao utilizador.
 */
import { fetchWithTimeout, NetError } from './net.js';
import { cleanText } from './m3u-parser.js';

const toNum = (v) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const toArray = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);
const toStr = (v, max) => cleanText(typeof v === 'string' || typeof v === 'number' ? String(v) : '', max);
const ext = (v, fallback) => (/^[a-z0-9]{2,5}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : fallback);

export function buildApiUrl(server, username, password, params = {}) {
  const u = new URL('player_api.php', server.endsWith('/') ? server : `${server}/`);
  u.searchParams.set('username', username);
  u.searchParams.set('password', password);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.href;
}

/**
 * URL de reprodução. Direto em HLS (.m3u8) porque o Safari não reproduz
 * MPEG-TS contínuo; VOD com a extensão indicada pelo servidor.
 */
export function buildStreamUrl(server, username, password, kind, id, extension) {
  const base = server.replace(/\/+$/, '');
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  if (kind === 'live') return `${base}/live/${u}/${p}/${encodeURIComponent(id)}.m3u8`;
  const folder = kind === 'movie' ? 'movie' : 'series';
  return `${base}/${folder}/${u}/${p}/${encodeURIComponent(id)}.${ext(extension, 'mp4')}`;
}

export function validateAuth(json) {
  if (!json || typeof json !== 'object' || !json.user_info) {
    throw new NetError('format', 'O servidor não respondeu como um serviço Xtream Codes.', {
      hint: 'Confirme o endereço do servidor (normalmente inclui a porta, ex.: http://servidor.com:8080).',
    });
  }
  const ui = json.user_info;
  if (Number(ui.auth) !== 1) throw new NetError('auth', 'Utilizador ou password incorretos.');
  const status = String(ui.status ?? '').toLowerCase();
  const exp = toNum(ui.exp_date);
  if (status && status !== 'active') {
    const map = { expired: 'A subscrição expirou.', banned: 'A conta foi bloqueada pelo fornecedor.', disabled: 'A conta está desativada.' };
    throw new NetError('expired', map[status] ?? `Conta não ativa (estado: ${toStr(status, 30)}).`);
  }
  if (exp && exp * 1000 < Date.now()) throw new NetError('expired', 'A subscrição expirou.');
  return {
    status: status || 'active',
    expiresAt: exp ? exp * 1000 : null,
    maxConnections: toNum(ui.max_connections),
    activeConnections: toNum(ui.active_cons),
    formats: toArray(ui.allowed_output_formats).map(String),
    serverTimezone: toStr(json.server_info?.timezone, 60) || null,
  };
}

export function normalizeCategories(json) {
  return toArray(json)
    .filter((c) => c && (c.category_id !== undefined))
    .map((c) => ({ id: toStr(c.category_id, 40), name: toStr(c.category_name) || 'Sem categoria' }));
}

export function normalizeLive(json) {
  return toArray(json).filter((s) => s && toNum(s.stream_id) !== null).map((s) => ({
    streamId: String(toNum(s.stream_id)),
    num: toNum(s.num),
    name: toStr(s.name) || `Canal ${s.stream_id}`,
    logo: toStr(s.stream_icon, 2048) || null,
    tvgId: toStr(s.epg_channel_id, 200) || null,
    categoryId: toStr(s.category_id, 40),
    archive: Number(s.tv_archive) === 1,
  }));
}

export function normalizeVod(json) {
  return toArray(json).filter((s) => s && toNum(s.stream_id) !== null).map((s) => ({
    streamId: String(toNum(s.stream_id)),
    name: toStr(s.name) || `Filme ${s.stream_id}`,
    poster: toStr(s.stream_icon, 2048) || null,
    rating: toNum(s.rating) || toNum(s.rating_5based) * 2 || null,
    addedAt: toNum(s.added) ? toNum(s.added) * 1000 : null,
    categoryId: toStr(s.category_id, 40),
    extension: ext(s.container_extension, 'mp4'),
    year: toNum(s.year) || null,
  }));
}

export function normalizeSeries(json) {
  return toArray(json).filter((s) => s && toNum(s.series_id) !== null).map((s) => ({
    seriesId: String(toNum(s.series_id)),
    name: toStr(s.name) || `Série ${s.series_id}`,
    poster: toStr(s.cover, 2048) || null,
    description: toStr(s.plot, 2000) || null,
    genre: toStr(s.genre, 120) || null,
    year: toNum(String(s.releaseDate ?? s.release_date ?? '').slice(0, 4)) || null,
    rating: toNum(s.rating) || null,
    addedAt: toNum(s.last_modified) ? toNum(s.last_modified) * 1000 : null,
    categoryId: toStr(s.category_id, 40),
  }));
}

/** get_series_info → [{season, episode, name, episodeId, extension, durationMin, description}] */
export function normalizeSeriesInfo(json) {
  if (!json || typeof json !== 'object') throw new NetError('format', 'Resposta inesperada ao obter os episódios.');
  const out = [];
  const groups = json.episodes && typeof json.episodes === 'object' ? json.episodes : {};
  for (const [seasonKey, list] of Object.entries(groups)) {
    for (const e of toArray(list)) {
      if (!e || toNum(e.id) === null) continue;
      const season = toNum(e.season) ?? toNum(seasonKey) ?? 1;
      const secs = toNum(e.info?.duration_secs);
      out.push({
        episodeId: String(toNum(e.id)),
        season,
        episode: toNum(e.episode_num) ?? out.filter((x) => x.season === season).length + 1,
        name: toStr(e.title) || `Episódio ${e.episode_num ?? ''}`.trim(),
        extension: ext(e.container_extension, 'mp4'),
        durationMin: secs ? Math.round(secs / 60) : null,
        description: toStr(e.info?.plot, 1000) || null,
      });
    }
  }
  return out.sort((a, b) => a.season - b.season || a.episode - b.episode);
}

export function createXtreamClient({ server, username, password, timeoutMs = 45_000, signal }) {
  async function call(params, { timeout = timeoutMs } = {}) {
    const res = await fetchWithTimeout(buildApiUrl(server, username, password, params), { timeoutMs: timeout, signal });
    const text = await res.text();
    if (!text.trim()) throw new NetError('empty', 'O servidor devolveu uma resposta vazia.');
    try {
      return JSON.parse(text);
    } catch {
      throw new NetError('format', 'O servidor devolveu uma resposta inesperada (não é JSON).', {
        hint: 'O endereço pode não ser de um servidor Xtream Codes, ou o fornecedor está com problemas.',
      });
    }
  }

  return {
    authenticate: async () => validateAuth(await call({}, { timeout: 20_000 })),
    liveCategories: async () => normalizeCategories(await call({ action: 'get_live_categories' })),
    liveStreams: async () => normalizeLive(await call({ action: 'get_live_streams' })),
    vodCategories: async () => normalizeCategories(await call({ action: 'get_vod_categories' })),
    vodStreams: async () => normalizeVod(await call({ action: 'get_vod_streams' })),
    seriesCategories: async () => normalizeCategories(await call({ action: 'get_series_categories' })),
    series: async () => normalizeSeries(await call({ action: 'get_series' })),
    seriesInfo: async (id) => normalizeSeriesInfo(await call({ action: 'get_series_info', series_id: id })),
    streamUrl: (kind, id, extension) => buildStreamUrl(server, username, password, kind, id, extension),
  };
}
