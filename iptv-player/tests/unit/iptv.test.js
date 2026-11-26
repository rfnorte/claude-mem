import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseM3U, parseExtinf, M3UParser } from '../../js/iptv/m3u-parser.js';
import { classify, parseEpisode, parseYear } from '../../js/iptv/classifier.js';
import { createM3UCollector, buildXtreamItems } from '../../js/iptv/collector.js';
import {
  validateAuth, normalizeLive, normalizeVod, normalizeSeries, normalizeSeriesInfo, normalizeCategories, buildStreamUrl, buildApiUrl,
} from '../../js/iptv/xtream-api.js';
import { redactUrl, describeFetchError } from '../../js/iptv/net.js';

const FIX = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const sample = () => readFile(join(FIX, 'sample.m3u'), 'utf8');

/* ---------------- Parser ---------------- */
test('parseExtinf: vírgulas e aspas', () => {
  const r = parseExtinf('#EXTINF:-1 tvg-id="a,b" group-title=\'X, Y\' tvg-chno=7,Nome, com vírgula');
  assert.equal(r.duration, -1);
  assert.equal(r.attrs['tvg-id'], 'a,b');
  assert.equal(r.attrs['group-title'], 'X, Y');
  assert.equal(r.attrs['tvg-chno'], '7');
  assert.equal(r.title, 'Nome, com vírgula');
});

test('parser: fixture com casos difíceis', async () => {
  const { entries, stats, epgUrls } = parseM3U(await sample());
  assert.equal(stats.header, true, 'cabeçalho com BOM reconhecido');
  assert.deepEqual(epgUrls, ['https://epg.example.com/guide.xml.gz', 'https://epg.example.com/alt.xml']);
  assert.equal(stats.unsupported, 1, 'rtmp');
  assert.ok(stats.invalid >= 1, 'URL inválido');
  assert.ok(stats.orphanInfo >= 1, '#EXTINF sem URL');

  const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
  assert.equal(byName['Exemplo Desporto, Canal 1'].group, 'Desporto, Internacional');
  assert.equal(byName['Canal com aspas simples'].group, 'Aspas simples');
  assert.equal(byName['Canal com aspas simples'].chno, 7);
  assert.equal(byName['Canal com EXTGRP'].group, 'Grupo EXTGRP');
  assert.ok(entries.some((e) => e.url === 'https://live.example.com/sem-extinf.m3u8'), 'URL sem #EXTINF aceite');
  // texto malicioso é mantido como TEXTO (escapado na renderização), nunca executado
  assert.ok(byName['<img src=x onerror=alert(1)>Canal malicioso']);
});

test('parser: blocos arbitrários (streaming) dão o mesmo resultado', async () => {
  const text = await sample();
  const whole = parseM3U(text).entries;
  const chunked = [];
  const p = new M3UParser((e) => chunked.push(e));
  for (let i = 0; i < text.length; i += 7) p.feed(text.slice(i, i + 7));
  p.end();
  assert.deepEqual(chunked, whole);
});

test('parser: CRLF e lista vazia', () => {
  assert.equal(parseM3U('#EXTM3U\r\n#EXTINF:-1,A\r\nhttps://a.example.com/1\r\n').entries[0].name, 'A');
  const empty = parseM3U('#EXTM3U\n');
  assert.equal(empty.entries.length, 0);
  assert.equal(empty.stats.header, true);
  assert.equal(parseM3U('<html><body>Login</body></html>').stats.header, false);
});

test('parser: 100 000 entradas em tempo razoável', () => {
  const lines = ['#EXTM3U'];
  for (let i = 0; i < 100_000; i++) lines.push(`#EXTINF:-1 tvg-id="c${i}" group-title="G${i % 50}",Canal ${i}`, `https://live.example.com/${i}.m3u8`);
  const t0 = performance.now();
  const { entries } = parseM3U(lines.join('\n'));
  const ms = performance.now() - t0;
  assert.equal(entries.length, 100_000);
  assert.ok(ms < 5000, `demorou ${ms.toFixed(0)} ms`);
});

/* ---------------- Classificação ---------------- */
test('classify: sinais de URL, extensão, nome e categoria', () => {
  const c = (name, url, group = '', duration = -1) => classify({ name, url, group, duration }).kind;
  assert.equal(c('X', 'http://s.example.com/live/u/p/1.ts'), 'live');
  assert.equal(c('X', 'http://s.example.com/movie/u/p/1.mkv'), 'movie');
  assert.equal(c('X S01E02', 'http://s.example.com/series/u/p/1.mp4'), 'episode');
  assert.equal(c('Canal', 'https://a.example.com/x.m3u8', 'Desporto'), 'live');
  assert.equal(c('Filme (2020)', 'https://a.example.com/f.mp4', 'Filmes'), 'movie');
  assert.equal(c('Show S03E04', 'https://a.example.com/f.mkv', 'Séries'), 'episode');
  assert.equal(c('Cinema 24h', 'https://a.example.com/c.m3u8', 'Cinema 24/7'), 'live', 'categoria "Cinema" de canais em direto não vira filme');
  assert.equal(c('Ficheiro', 'https://a.example.com/f.mp4', 'Séries'), 'movie', 'sem SxxEyy não é agrupável → filme');
});

test('classify: correção do utilizador tem prioridade', () => {
  const entry = { name: 'Algo', url: 'https://a.example.com/x.m3u8', group: 'Docs' };
  assert.equal(classify(entry).kind, 'live');
  assert.equal(classify(entry, { Docs: 'movie' }).kind, 'movie');
  const ep = classify(entry, { Docs: 'episode' });
  assert.equal(ep.kind, 'episode');
  assert.ok(ep.episode.seriesName);
});

test('parseEpisode e parseYear', () => {
  assert.deepEqual(parseEpisode('Série Exemplo S01 E01'), { seriesName: 'Série Exemplo', season: 1, episode: 1 });
  assert.deepEqual(parseEpisode('Outra Série 1x05'), { seriesName: 'Outra Série', season: 1, episode: 5 });
  assert.deepEqual(parseEpisode('Show - Temporada 2 Episódio 3'), { seriesName: 'Show', season: 2, episode: 3 });
  assert.equal(parseEpisode('Canal 24'), null);
  assert.equal(parseYear('Filme (2019)'), 2019);
  assert.equal(parseYear('Filme 2019'), 2019);
  assert.equal(parseYear('Canal 3000'), null);
});

/* ---------------- Coletor ---------------- */
test('coletor: duplicados, séries agrupadas, IDs estáveis', async () => {
  const { entries } = parseM3U(await sample());
  const a = createM3UCollector('src1');
  const items = entries.map((e) => a.add(e)).filter(Boolean);
  const series = a.seriesItems();

  assert.equal(a.counts.duplicates, 1);
  assert.equal(series.length, 2);
  const s = series.find((x) => x.name === 'Série Exemplo');
  assert.equal(s.seasonCount, 2);
  assert.equal(s.episodeCount, 3);
  assert.equal(s.poster, 'https://img.example.com/serie.png');
  const ep2 = items.find((i) => i.kind === 'episode' && i.season === 1 && i.episode === 2);
  assert.equal(ep2.title, 'O Regresso');
  assert.equal(ep2.seriesId, s.id);

  // Mesma lista com URLs diferentes (tokens) → mesmos IDs (favoritos sobrevivem)
  const b = createM3UCollector('src1');
  const items2 = entries.map((e) => b.add({ ...e, url: `${e.url}#t=2` })).filter(Boolean);
  assert.deepEqual(items2.map((i) => i.id), items.map((i) => i.id));
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'IDs únicos');
});

test('coletor: resumo de categorias e override', async () => {
  const { entries } = parseM3U(await sample());
  const c = createM3UCollector('s', { Filmes: 'live' });
  entries.forEach((e) => c.add(e));
  const groups = c.groups();
  assert.equal(groups.find((g) => g.name === 'Filmes').override, 'live');
  assert.ok(groups.find((g) => g.name === 'Notícias').count >= 3);
});

/* ---------------- Xtream ---------------- */
test('xtream: autenticação e estados da conta', () => {
  assert.throws(() => validateAuth({ user_info: { auth: 0 } }), { code: 'auth' });
  assert.throws(() => validateAuth({ user_info: { auth: 1, status: 'Expired' } }), { code: 'expired' });
  assert.throws(() => validateAuth({ user_info: { auth: 1, status: 'Active', exp_date: '1000' } }), { code: 'expired' });
  assert.throws(() => validateAuth('<html>'), { code: 'format' });
  const ok = validateAuth({ user_info: { auth: '1', status: 'Active', exp_date: null, max_connections: '2' }, server_info: { timezone: 'Europe/Lisbon' } });
  assert.equal(ok.maxConnections, 2);
  assert.equal(ok.expiresAt, null);
});

test('xtream: normalização tolerante a variações', () => {
  assert.deepEqual(normalizeCategories({ a: { category_id: 1, category_name: 'Nx' } }), [{ id: '1', name: 'Nx' }]);
  const live = normalizeLive([{ stream_id: '10', name: 'C', num: '3', stream_icon: '', category_id: 1 }, { name: 'sem id' }, null]);
  assert.equal(live.length, 1);
  assert.equal(live[0].streamId, '10');
  assert.equal(live[0].num, 3);
  assert.equal(live[0].logo, null);
  const vod = normalizeVod([{ stream_id: 5, name: 'F', container_extension: 'MKV', added: '1700000000', rating: '7.5' }]);
  assert.equal(vod[0].extension, 'mkv');
  assert.equal(vod[0].addedAt, 1700000000000);
  assert.equal(vod[0].rating, 7.5);
  assert.equal(normalizeVod([{ stream_id: 6, name: 'G', container_extension: '../../x' }])[0].extension, 'mp4', 'extensão maliciosa rejeitada');
  const series = normalizeSeries([{ series_id: 9, name: 'S', releaseDate: '2018-02-01' }]);
  assert.equal(series[0].year, 2018);
  const eps = normalizeSeriesInfo({ episodes: { 2: [{ id: '3', episode_num: 1, title: 'B', season: 2 }], 1: [{ id: '1', episode_num: '2', title: 'A', info: { duration_secs: 2700 } }] } });
  assert.deepEqual(eps.map((e) => [e.season, e.episode]), [[1, 2], [2, 1]]);
  assert.equal(eps[0].durationMin, 45);
});

test('xtream: URLs de API e de stream', () => {
  const api = buildApiUrl('http://srv.example.com:8080', 'u s', 'p&w', { action: 'get_live_streams' });
  assert.equal(api, 'http://srv.example.com:8080/player_api.php?username=u+s&password=p%26w&action=get_live_streams');
  assert.equal(buildStreamUrl('http://srv.example.com:8080/', 'u', 'p', 'live', '10'), 'http://srv.example.com:8080/live/u/p/10.m3u8');
  assert.equal(buildStreamUrl('http://srv.example.com', 'u', 'p', 'movie', '5', 'mkv'), 'http://srv.example.com/movie/u/p/5.mkv');
  assert.equal(buildStreamUrl('http://srv.example.com', 'u', 'p', 'episode', '7', 'mp4'), 'http://srv.example.com/series/u/p/7.mp4');
});

test('xtream: itens com IDs estáveis e categorias', () => {
  const { items, counts } = buildXtreamItems('x1', {
    liveCats: [{ id: '1', name: 'Notícias' }], live: normalizeLive([{ stream_id: 1, name: 'A', category_id: '1' }]),
    vodCats: [], vod: normalizeVod([{ stream_id: 2, name: 'F (2020)' }]),
    seriesCats: [], series: normalizeSeries([{ series_id: 3, name: 'S' }]),
  });
  assert.deepEqual(items.map((i) => i.id), ['xt:x1:live:1', 'xt:x1:movie:2', 'xt:x1:series:3']);
  assert.equal(items[0].group, 'Notícias');
  assert.equal(items[1].group, 'Sem categoria');
  assert.equal(items[1].year, 2020);
  assert.deepEqual(counts, { live: 1, movie: 1, series: 1, episode: 0, duplicates: 0 });
});

/* ---------------- Rede ---------------- */
test('redactUrl esconde credenciais', () => {
  assert.equal(redactUrl('http://s.example.com/get.php?username=joao&password=123&type=m3u'),
    'http://s.example.com/get.php?username=%E2%80%A2%E2%80%A2%E2%80%A2&password=%E2%80%A2%E2%80%A2%E2%80%A2&type=m3u');
  assert.ok(!redactUrl('http://s.example.com/live/joao/123/1.ts').includes('joao'));
});

test('describeFetchError distingue mixed content', () => {
  globalThis.location = { protocol: 'https:' };
  assert.equal(describeFetchError(new TypeError('x'), 'http://a.example.com').code, 'mixed');
  assert.equal(describeFetchError(new TypeError('x'), 'https://a.example.com').code, 'network');
  delete globalThis.location;
});
