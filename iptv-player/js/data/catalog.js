/**
 * Catálogo — fachada única de acesso aos conteúdos para todos os ecrãs.
 *
 * Os ecrãs nunca sabem de onde vêm os dados. Fase 2: modo demonstração (dados
 * fictícios) ou vazio. Fase 3: as mesmas funções passam a ler do IndexedDB
 * alimentado pelas listas do utilizador. Todas as funções são assíncronas por
 * esse motivo.
 */
import { prefs } from './prefs.js';
import { favorites } from './favorites.js';
import { normalizeText } from '../core/format.js';

const EMPTY = Object.freeze({ categories: [], channels: [], movies: [], series: [], history: [], popular: [] });
let demoModule = null;
let demoData = null;

async function source() {
  if (!prefs.get('demo')) return EMPTY;
  demoModule ??= await import('./demo-data.js');
  demoData ??= demoModule.createDemoCatalog();
  return demoData;
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
  else if (sort === 'recent') copy.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
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
    const demo = d !== EMPTY;
    return {
      demo,
      sourceCount: 0, // listas reais: Fase 3
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
    return sortItems((await source()).movies, 'recent').slice(0, limit);
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
