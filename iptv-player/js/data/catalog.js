/**
 * Catálogo — fachada única de acesso aos conteúdos para todos os ecrãs.
 *
 * Os ecrãs nunca sabem de onde vêm os dados: modo demonstração (dados
 * fictícios) ou as listas do utilizador guardadas em IndexedDB. Os dados reais
 * são carregados uma vez para memória (pesquisa instantânea) e a cache é
 * invalidada quando uma lista muda.
 */
import { prefs } from './prefs.js';
import { favorites } from './favorites.js';
import { normalizeText } from '../core/format.js';
import { getAllByIndex, putMany } from './db.js';
import { listSources, getCredentials } from './sources.js';
import { syncEvents } from '../iptv/source-sync.js';
import { createXtreamClient } from '../iptv/xtream-api.js';

const EMPTY = Object.freeze({ categories: [], channels: [], movies: [], series: [], history: [], popular: [], demo: false, sourceCount: 0 });
let demoModule = null;
let demoData = null;
let realPromise = null;

function invalidate() { realPromise = null; }
syncEvents.on('changed', invalidate);
prefs.on('change', ({ key }) => { if (key === 'demo' || key === '*') invalidate(); });

/* ---------- Mapeamento dos itens guardados para o modelo dos ecrãs ---------- */
const toChannel = (i) => ({
  id: i.id, kind: 'live', name: i.name, logo: i.logo, categoryId: i.categoryId, categoryName: i.group,
  number: i.chno ?? i.order + 1, sourceId: i.sourceId, tvgId: i.tvgId, order: i.order,
});
const toMovie = (i) => ({
  id: i.id, kind: 'movie', name: i.name, poster: i.logo, year: i.year ?? null, genres: [i.group],
  rating: i.rating ?? null, addedAt: i.addedAt ?? null, durationMin: null, description: null,
  categoryId: i.categoryId, sourceId: i.sourceId, order: i.order,
});
const toSeries = (i) => ({
  id: i.id, kind: 'series', name: i.name, poster: i.poster, year: i.year ?? null, genres: [i.group],
  rating: i.rating ?? null, addedAt: i.addedAt ?? null, description: i.description ?? null,
  seasonCount: i.seasonCount ?? null, episodeCount: i.episodeCount ?? null, seasons: null,
  categoryId: i.categoryId, sourceId: i.sourceId, seriesKey: i.seriesKey, xtSeriesId: i.seriesId ?? null, order: i.order,
});

async function loadReal() {
  const sources = (await listSources()).filter((s) => s.enabled);
  if (!sources.length) return { ...EMPTY };
  const byKind = async (kind) => (await Promise.all(sources.map((s) =>
    getAllByIndex('items', 'source_kind', IDBKeyRange.only([s.id, kind]))))).flat();
  const [live, movies, series] = await Promise.all([byKind('live'), byKind('movie'), byKind('series')]);
  const channels = live.map(toChannel);

  const cats = new Map();
  for (const c of channels) {
    const cat = cats.get(c.categoryId) ?? { id: c.categoryId, name: c.categoryName, kind: 'live' };
    cats.set(c.categoryId, cat);
  }
  return {
    categories: [...cats.values()],
    channels,
    movies: movies.map(toMovie),
    series: series.map(toSeries),
    history: [],   // Fase 4/7
    popular: [],   // depende do histórico de utilização
    demo: false,
    sourceCount: sources.length,
    sources,
  };
}

async function source() {
  if (prefs.get('demo')) {
    demoModule ??= await import('./demo-data.js');
    demoData ??= { ...demoModule.createDemoCatalog(), demo: true, sourceCount: 0 };
    return demoData;
  }
  realPromise ??= loadReal().catch((err) => { realPromise = null; throw err; });
  return realPromise;
}

/** Episódios de uma série real (M3U: da BD; Xtream: pedidos ao servidor na 1.ª vez). */
async function loadEpisodes(d, s) {
  const stored = (await getAllByIndex('items', 'source_series', IDBKeyRange.only([s.sourceId, s.seriesKey])))
    .filter((i) => i.kind === 'episode');
  if (stored.length || !s.xtSeriesId) return stored;

  const src = d.sources.find((x) => x.id === s.sourceId);
  if (!src) return [];
  const client = createXtreamClient(await getCredentials(src));
  const eps = await client.seriesInfo(s.xtSeriesId);
  const items = eps.map((e, n) => ({
    id: `xt:${s.sourceId}:episode:${e.episodeId}`, sourceId: s.sourceId, kind: 'episode',
    seriesKey: s.seriesKey, seriesId: s.id, season: e.season, episode: e.episode, title: e.name,
    name: `${s.name} T${e.season}E${e.episode}`, episodeId: e.episodeId, extension: e.extension,
    durationMin: e.durationMin, description: e.description, order: n,
  }));
  if (items.length) await putMany('items', items);
  return items;
}

function groupSeasons(episodes) {
  const map = new Map();
  for (const e of [...episodes].sort((a, b) => a.season - b.season || a.episode - b.episode || a.order - b.order)) {
    const season = map.get(e.season) ?? { number: e.season, episodes: [] };
    season.episodes.push({ id: e.id, season: e.season, episode: e.episode, name: e.title || e.name, durationMin: e.durationMin ?? null });
    map.set(e.season, season);
  }
  return [...map.values()];
}

export function seasonLabel(s) {
  const n = s.seasons?.length || s.seasonCount;
  if (n) return `${n} ${n === 1 ? 'temporada' : 'temporadas'}`;
  return s.genres?.[0] ?? '';
}

function withEpg(channel) {
  if (!demoModule || !channel.demoShows) return channel;
  return { ...channel, epg: demoModule.demoEpg(channel) };
}

const collator = new Intl.Collator('pt-PT', { sensitivity: 'base', numeric: true });

function matches(item, q) {
  if (!q) return true;
  item._norm ??= normalizeText(item.name);
  return item._norm.includes(q);
}

function sortItems(list, sort) {
  const copy = [...list];
  if (sort === 'az') copy.sort((a, b) => collator.compare(a.name, b.name));
  else if (sort === 'recent') copy.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0) || (b.order ?? 0) - (a.order ?? 0));
  else if (sort === 'list') copy.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  else if (sort === 'year') copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || collator.compare(a.name, b.name));
  return copy;
}

function genreCounts(items) {
  const counts = new Map();
  for (const it of items) for (const g of it.genres ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts].sort((a, b) => collator.compare(a[0], b[0])).map(([name, count]) => ({ id: name, name, count }));
}

function movieProgress(d, id) {
  const h = d.history.find((x) => x.kind === 'movie' && x.id === id);
  return h ? { percent: h.percent, updatedAt: h.updatedAt } : null;
}

function findEpisode(series, season, episode) {
  return series?.seasons.find((s) => s.number === season)?.episodes.find((e) => e.episode === episode) ?? null;
}

export const catalog = {
  async status() {
    const d = await source();
    return {
      demo: d.demo,
      sourceCount: d.sourceCount,
      hasContent: d.channels.length + d.movies.length + d.series.length > 0,
      counts: { live: d.channels.length, movie: d.movies.length, series: d.series.length },
    };
  },

  /* ---------------- TV ---------------- */
  async channelCategories() {
    const d = await source();
    const counts = new Map();
    for (const c of d.channels) counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1);
    return d.categories.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
  },

  async channels({ category = 'all', query = '', sort = 'list' } = {}) {
    const d = await source();
    const q = normalizeText(query);
    const favIds = category === 'fav' ? new Set(favorites.ids('live')) : null;
    const list = d.channels.filter((c) =>
      (category === 'all' || (favIds ? favIds.has(c.id) : c.categoryId === category)) && matches(c, q));
    return sortItems(list, sort).map(withEpg);
  },

  async channel(id) {
    const d = await source();
    const c = d.channels.find((x) => x.id === id);
    return c ? withEpg(c) : null;
  },

  async popularChannels(limit = 10) {
    return (await source()).popular.slice(0, limit).map(withEpg);
  },

  async favoriteChannels() {
    const d = await source();
    const ids = new Set(favorites.ids('live'));
    return d.channels.filter((c) => ids.has(c.id)).map(withEpg);
  },

  async recentChannels(limit = 10) {
    const d = await source();
    return d.history
      .filter((h) => h.kind === 'live')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((h) => d.channels.find((c) => c.id === h.id))
      .filter(Boolean)
      .slice(0, limit)
      .map(withEpg);
  },

  /* ---------------- Filmes ---------------- */
  async movieGenres() { return genreCounts((await source()).movies); },

  async movies({ genre = 'all', query = '', sort = 'recent' } = {}) {
    const d = await source();
    const q = normalizeText(query);
    const favIds = genre === 'fav' ? new Set(favorites.ids('movie')) : null;
    const list = d.movies.filter((m) =>
      (genre === 'all' || (favIds ? favIds.has(m.id) : m.genres.includes(genre))) && matches(m, q));
    return sortItems(list, sort).map((m) => ({ ...m, progress: movieProgress(d, m.id) }));
  },

  async movie(id) {
    const d = await source();
    const m = d.movies.find((x) => x.id === id);
    return m ? { ...m, progress: movieProgress(d, id) } : null;
  },

  async recentMovies(limit = 12) {
    const d = await source();
    // Sem data de adição (M3U), "recentes" = últimos da lista.
    const hasDates = d.movies.some((m) => m.addedAt);
    return (hasDates ? sortItems(d.movies, 'recent') : [...d.movies].reverse()).slice(0, limit);
  },

  /* ---------------- Séries ---------------- */
  async seriesGenres() { return genreCounts((await source()).series); },

  async seriesList({ genre = 'all', query = '', sort = 'recent' } = {}) {
    const d = await source();
    const q = normalizeText(query);
    const favIds = genre === 'fav' ? new Set(favorites.ids('series')) : null;
    const list = d.series.filter((s) =>
      (genre === 'all' || (favIds ? favIds.has(s.id) : s.genres.includes(genre))) && matches(s, q));
    return sortItems(list, sort);
  },

  async series(id) {
    const d = await source();
    const s = d.series.find((x) => x.id === id);
    if (!s) return null;
    if (!d.demo) {
      try {
        return { ...s, seasons: groupSeasons(await loadEpisodes(d, s)), lastWatched: null };
      } catch (err) {
        return { ...s, seasons: [], lastWatched: null, episodesError: err.message || 'Não foi possível obter os episódios.' };
      }
    }
    const last = d.history
      .filter((h) => h.kind === 'episode' && h.seriesId === id)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { ...s, lastWatched: last ? { season: last.season, episode: last.episode, percent: last.percent } : null };
  },

  async featuredSeries(limit = 10) {
    return sortItems((await source()).series, 'recent').slice(0, limit);
  },

  /* ---------------- Transversal ---------------- */
  /** Itens VOD com progresso, do mais recente para o mais antigo. */
  async continueWatching() {
    const d = await source();
    return d.history
      .filter((h) => h.kind === 'movie' || h.kind === 'episode')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((h) => {
        if (h.kind === 'movie') {
          const m = d.movies.find((x) => x.id === h.id);
          return m && { item: m, href: `#/movies/${encodeURIComponent(m.id)}`, title: m.name, meta: `${100 - h.percent}% por ver`, percent: h.percent };
        }
        const s = d.series.find((x) => x.id === h.seriesId);
        const ep = findEpisode(s, h.season, h.episode);
        return s && ep && { item: s, href: `#/series/${encodeURIComponent(s.id)}?season=${h.season}`, title: s.name, meta: `T${h.season} · E${h.episode} — ${ep.name}`, percent: h.percent };
      })
      .filter(Boolean);
  },

  async search(query, limit = 20) {
    const q = normalizeText(query);
    if (q.length < 2) return { channels: [], movies: [], series: [] };
    const d = await source();
    return {
      channels: d.channels.filter((c) => matches(c, q)).slice(0, limit).map(withEpg),
      movies: d.movies.filter((m) => matches(m, q)).slice(0, limit),
      series: d.series.filter((s) => matches(s, q)).slice(0, limit),
    };
  },
};
