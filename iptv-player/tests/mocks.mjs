/**
 * Servidores simulados APENAS para testes automáticos (nunca usados pela app).
 * Dados 100% fictícios em domínios reservados (example.com).
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const XT_USER = 'utilizador-teste';
export const XT_PASS = 'password-secreta-123';

const xtream = {
  get_live_categories: [{ category_id: '1', category_name: 'Notícias XT' }, { category_id: '2', category_name: 'Desporto XT' }],
  get_live_streams: [
    { num: 1, name: 'XT Notícias', stream_id: 101, stream_icon: '', epg_channel_id: 'xt.news', category_id: '1' },
    { num: 2, name: 'XT Desporto', stream_id: '102', stream_icon: null, category_id: '2' },
    { num: 3, name: 'XT Sem Categoria', stream_id: 103, category_id: '99' },
  ],
  get_vod_categories: [{ category_id: '10', category_name: 'Filmes XT' }],
  get_vod_streams: [
    { stream_id: 201, name: 'Filme XT Um (2020)', stream_icon: '', rating: '7.1', added: '1700000000', category_id: '10', container_extension: 'mp4' },
    { stream_id: 202, name: 'Filme XT Dois', rating: 6, added: 1710000000, category_id: '10', container_extension: 'mkv' },
  ],
  get_series_categories: [{ category_id: '20', category_name: 'Séries XT' }],
  get_series: [{ series_id: 301, name: 'Série XT', cover: '', plot: 'Sinopse fictícia.', genre: 'Drama', releaseDate: '2019-05-01', category_id: '20' }],
};
const seriesInfo = {
  info: { name: 'Série XT' },
  episodes: {
    1: [{ id: '3011', episode_num: 1, title: 'Série XT - S01E01 - Início', container_extension: 'mp4', season: 1, info: { duration_secs: 2400 } },
      { id: '3012', episode_num: 2, title: 'Série XT - S01E02 - Meio', container_extension: 'mp4', season: 1 }],
    2: [{ id: '3021', episode_num: 1, title: 'Série XT - S02E01 - Fim', container_extension: 'mkv', season: 2 }],
  },
};

function bigList(n) {
  const out = ['#EXTM3U'];
  for (let i = 0; i < n; i++) {
    out.push(`#EXTINF:-1 tvg-id="big${i}" group-title="Grupo ${i % 40}",Canal Grande ${i}`, `https://live.example.com/big/${i}.m3u8`);
  }
  return out.join('\n');
}

/** Devolve true se tratou o pedido. */
export async function handleMock(req, res, { cors = true } = {}) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/__mock/')) return false;
  const headers = cors ? { 'Access-Control-Allow-Origin': '*' } : {};
  const send = (status, type, body) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers }); res.end(body); };

  switch (url.pathname) {
    case '/__mock/list.m3u':
      send(200, 'audio/x-mpegurl', await readFile(join(FIX, 'sample.m3u')));
      return true;
    case '/__mock/big.m3u': {
      const body = bigList(Number(url.searchParams.get('n')) || 20_000);
      res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl', 'Content-Length': Buffer.byteLength(body), ...headers });
      // envia em blocos para exercitar a leitura em streaming
      for (let i = 0; i < body.length; i += 64 * 1024) res.write(body.slice(i, i + 64 * 1024));
      res.end();
      return true;
    }
    case '/__mock/page.html':
      send(200, 'text/html', '<!doctype html><html><body><h1>Login</h1></body></html>');
      return true;
    case '/__mock/stream.m3u8':
      send(200, 'application/vnd.apple.mpegurl', '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg0.ts\n');
      return true;
    case '/__mock/xtream/player_api.php': {
      const ok = url.searchParams.get('username') === XT_USER && url.searchParams.get('password') === XT_PASS;
      const action = url.searchParams.get('action');
      if (!action) {
        send(200, 'application/json', JSON.stringify(ok
          ? { user_info: { auth: 1, status: 'Active', exp_date: String(Math.floor(Date.now() / 1000) + 86_400 * 30), max_connections: '1' }, server_info: { timezone: 'Europe/Lisbon' } }
          : { user_info: { auth: 0 } }));
      } else if (!ok) {
        send(200, 'application/json', '[]');
      } else if (action === 'get_series_info') {
        send(200, 'application/json', JSON.stringify(seriesInfo));
      } else {
        send(200, 'application/json', JSON.stringify(xtream[action] ?? []));
      }
      return true;
    }
    default:
      send(404, 'text/plain', 'mock not found');
      return true;
  }
}
