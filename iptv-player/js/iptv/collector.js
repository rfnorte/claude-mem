/**
 * Coletores: convertem entradas de uma fonte em itens normalizados para a BD.
 *
 * IDs estáveis: dependem de dados que não mudam entre atualizações (tvg-id,
 * nome, categoria ou IDs Xtream) e não do URL — muitos fornecedores incluem
 * tokens temporários nos URLs. Assim favoritos e histórico sobrevivem a uma
 * atualização da lista.
 */
import { hashString } from '../core/dom.js';
import { normalizeText } from '../core/format.js';
import { classify, parseYear, seriesKeyOf } from './classifier.js';

const NO_CATEGORY = 'Sem categoria';
export const categoryIdOf = (name) => normalizeText(name || NO_CATEGORY) || 'sem categoria';

function uniqueId(base, used) {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}~${n}`;
  used.add(id);
  return id;
}

function episodeTitle(name, ep) {
  const rest = name.replace(/^.*?\b(S\d{1,2}[\s._-]*E\d{1,3}|\d{1,2}x\d{1,3})\b[\s._\-–|:]*/i, '').trim();
  return rest && rest !== name ? rest : `Episódio ${ep.episode || ''}`.trim();
}

/**
 * @param {string} sourceId
 * @param {Record<string, string>} overrides  categoria → tipo
 */
export function createM3UCollector(sourceId, overrides = {}) {
  const usedIds = new Set();
  const seenUrls = new Set();
  const series = new Map();
  const groups = new Map();
  const counts = { live: 0, movie: 0, episode: 0, series: 0, duplicates: 0 };
  let order = 0;

  return {
    counts,
    ids: usedIds,
    /** @returns {object|null} item, ou null se duplicado */
    add(entry) {
      if (seenUrls.has(entry.url)) { counts.duplicates++; return null; }
      seenUrls.add(entry.url);

      const { kind, episode } = classify(entry, overrides);
      const group = entry.group || NO_CATEGORY;
      const g = groups.get(group) ?? { name: group, count: 0, kinds: { live: 0, movie: 0, episode: 0 } };
      g.count++;
      g.kinds[kind]++;
      groups.set(group, g);

      const fingerprint = `${entry.tvgId ?? ''}|${normalizeText(entry.name)}|${normalizeText(group)}`;
      const item = {
        id: uniqueId(`m3u:${sourceId}:${kind}:${hashString(fingerprint).toString(36)}`, usedIds),
        sourceId,
        kind,
        name: entry.name,
        logo: entry.logo ?? null,
        group,
        categoryId: categoryIdOf(group),
        url: entry.url,
        tvgId: entry.tvgId ?? null,
        tvgName: entry.tvgName ?? null,
        chno: entry.chno ?? null,
        duration: entry.duration ?? -1,
        order: order++,
      };

      if (kind === 'movie') item.year = parseYear(entry.name);
      if (kind === 'episode') {
        const key = seriesKeyOf(episode.seriesName) || seriesKeyOf(group);
        const seriesId = `m3u:${sourceId}:series:${hashString(key).toString(36)}`;
        Object.assign(item, { seriesKey: key, seriesId, season: episode.season, episode: episode.episode, title: episodeTitle(entry.name, episode) });
        const s = series.get(key) ?? {
          id: seriesId, sourceId, kind: 'series', name: episode.seriesName, poster: entry.logo ?? null,
          group, categoryId: categoryIdOf(group), seriesKey: key, seasons: new Set(), episodeCount: 0,
          order: item.order, year: parseYear(episode.seriesName),
        };
        s.seasons.add(episode.season);
        s.episodeCount++;
        if (!s.poster && entry.logo) s.poster = entry.logo;
        series.set(key, s);
      }
      counts[kind]++;
      return item;
    },
    /** Registos de série agregados (chamar no fim). */
    seriesItems() {
      const out = [...series.values()].map(({ seasons, ...s }) => ({ ...s, seasonCount: seasons.size }));
      for (const s of out) usedIds.add(s.id);
      counts.series = out.length;
      return out;
    },
    /** Resumo por categoria, para o ecrã de correção de categorias. */
    groups() {
      return [...groups.values()].map((g) => ({
        name: g.name,
        count: g.count,
        kind: Object.entries(g.kinds).sort((a, b) => b[1] - a[1])[0][0],
        override: overrides[g.name] ?? null,
      }));
    },
  };
}

/** Itens a partir das respostas normalizadas da API Xtream. */
export function buildXtreamItems(sourceId, { liveCats, live, vodCats, vod, seriesCats, series }) {
  const catName = (cats) => {
    const m = new Map(cats.map((c) => [c.id, c.name]));
    return (id) => m.get(id) ?? NO_CATEGORY;
  };
  const liveCat = catName(liveCats);
  const vodCat = catName(vodCats);
  const seriesCat = catName(seriesCats);
  const used = new Set();

  const items = [];
  live.forEach((s, i) => {
    const group = liveCat(s.categoryId);
    items.push({
      id: uniqueId(`xt:${sourceId}:live:${s.streamId}`, used), sourceId, kind: 'live', name: s.name, logo: s.logo,
      group, categoryId: categoryIdOf(group), streamId: s.streamId, tvgId: s.tvgId, chno: s.num, archive: s.archive, order: i,
    });
  });
  vod.forEach((s, i) => {
    const group = vodCat(s.categoryId);
    items.push({
      id: uniqueId(`xt:${sourceId}:movie:${s.streamId}`, used), sourceId, kind: 'movie', name: s.name, logo: s.poster,
      group, categoryId: categoryIdOf(group), streamId: s.streamId, extension: s.extension, rating: s.rating,
      addedAt: s.addedAt, year: s.year ?? parseYear(s.name), order: i,
    });
  });
  series.forEach((s, i) => {
    const group = seriesCat(s.categoryId);
    items.push({
      id: uniqueId(`xt:${sourceId}:series:${s.seriesId}`, used), sourceId, kind: 'series', name: s.name, poster: s.poster,
      group, categoryId: categoryIdOf(group), seriesId: s.seriesId, seriesKey: s.seriesId, description: s.description,
      genre: s.genre, year: s.year, rating: s.rating, addedAt: s.addedAt, order: i,
    });
  });
  return {
    items,
    ids: used,
    counts: { live: live.length, movie: vod.length, series: series.length, episode: 0, duplicates: 0 },
  };
}
