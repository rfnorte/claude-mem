/**
 * Classificação de entradas M3U em TV em direto, filme ou episódio de série.
 *
 * Não existe um campo padrão que indique o tipo: usamos sinais ponderados
 * (caminho do URL, extensão, padrões no nome e palavras na categoria).
 * A classificação pode falhar — por isso o utilizador pode corrigir uma
 * categoria inteira (override), que tem sempre prioridade.
 */
import { normalizeText } from '../core/format.js';

export const KINDS = ['live', 'movie', 'episode'];

const VOD_EXT = /\.(mp4|mkv|avi|mov|m4v|wmv|flv|webm|mpg|mpeg)(\?|$)/i;
const LIVE_EXT = /\.(m3u8|ts)(\?|$)/i;
const EPISODE_RE = [
  /^(.*?)[\s._\-–|:]*\bS(\d{1,2})[\s._-]*E(\d{1,3})\b/i,
  /^(.*?)[\s._\-–|:]*\b(\d{1,2})x(\d{1,3})\b/i,
  /^(.*?)[\s._\-–|:]*\b(?:temporada|season|temp\.?)\s*(\d{1,2})[\s,._-]*(?:epis[oó]dio|episode|ep\.?|e)\s*(\d{1,3})\b/i,
];
const SERIES_GROUP = /\b(series?|s[eé]ries|tv shows?|novelas?|seriados?)\b/i;
const MOVIE_GROUP = /\b(vod|filmes?|movies?|cinema|peliculas?|films?)\b/i;
const LIVE_GROUP = /\b(live|direto|directo|canais|channels?|24\/7|tv)\b/i;

/** Extrai série/temporada/episódio do nome, se existir. */
export function parseEpisode(name) {
  for (const re of EPISODE_RE) {
    const m = re.exec(name);
    if (m) {
      const seriesName = m[1].replace(/[\s._\-–|:([]+$/, '').trim();
      if (!seriesName) continue;
      return { seriesName, season: Number(m[2]), episode: Number(m[3]) };
    }
  }
  return null;
}

/** Ano entre parênteses ou no fim do nome: "Filme (2019)" → 2019. */
export function parseYear(name) {
  const m = /[([]\s*((?:19|20)\d{2})\s*[)\]]|\b((?:19|20)\d{2})\s*$/.exec(name);
  const y = m ? Number(m[1] ?? m[2]) : null;
  return y && y <= new Date().getFullYear() + 1 ? y : null;
}

export const seriesKeyOf = (seriesName) => normalizeText(seriesName).replace(/[^a-z0-9 ]/g, '').trim();

/**
 * @param {{name: string, url: string, group?: string|null, duration?: number}} entry
 * @param {Record<string, 'live'|'movie'|'episode'>} [overrides] por nome de categoria (group-title)
 * @returns {{kind: 'live'|'movie'|'episode', episode: ReturnType<typeof parseEpisode>, reason: string}}
 */
export function classify(entry, overrides = {}) {
  const group = entry.group ?? '';
  const ep = parseEpisode(entry.name);

  const forced = overrides[group];
  if (forced && KINDS.includes(forced)) {
    return { kind: forced, episode: forced === 'episode' ? (ep ?? { seriesName: group || entry.name, season: 1, episode: 0 }) : null, reason: 'override' };
  }

  let path = '';
  try { path = new URL(entry.url).pathname.toLowerCase(); } catch { /* url já validado */ }

  // 1. Convenção Xtream nos URLs (sinal mais forte)
  if (/\/series\//.test(path)) return { kind: 'episode', episode: ep ?? { seriesName: group || entry.name, season: 1, episode: 0 }, reason: 'url-series' };
  if (/\/movie\//.test(path)) return { kind: 'movie', episode: null, reason: 'url-movie' };
  if (/\/live\//.test(path)) return { kind: 'live', episode: null, reason: 'url-live' };

  // 2. Pontuação por sinais
  const score = { live: 0, movie: 0, episode: 0 };
  if (VOD_EXT.test(path)) { score.movie += 3; score.episode += 3; }
  if (LIVE_EXT.test(path)) score.live += 2;
  if (!/\.[a-z0-9]{2,4}$/.test(path)) score.live += 1; // sem extensão: típico de direto
  if (ep) score.episode += 4;
  if (SERIES_GROUP.test(group)) score.episode += 2;
  if (MOVIE_GROUP.test(group)) score.movie += 2;
  if (LIVE_GROUP.test(group)) score.live += 1;
  if (entry.duration > 0) { score.movie += 1; score.episode += 1; }
  if (parseYear(entry.name)) score.movie += 1;

  // Episódio sem padrão SxxEyy reconhecível não pode ser agrupado → trata como filme.
  if (!ep) score.episode = Math.min(score.episode, score.movie - 1);

  // Desempate por ordem de prioridade: direto > filme > episódio (o erro menos grave).
  let kind = 'live';
  for (const k of ['movie', 'episode']) if (score[k] > score[kind]) kind = k;
  return { kind: /** @type {'live'|'movie'|'episode'} */ (kind), episode: kind === 'episode' ? ep : null, reason: 'score' };
}
