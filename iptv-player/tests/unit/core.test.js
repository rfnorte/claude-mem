import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { html, raw, escapeHtml, safeUrl, vars, initials, hashString } from '../../js/core/dom.js';
import { parseHash, compile, matchRoute } from '../../js/core/router.js';
import { validateSourceUrl } from '../../js/core/validate.js';
import { normalizeText, programmeProgress, formatDuration, greeting } from '../../js/core/format.js';
import { createDemoCatalog, demoEpg } from '../../js/data/demo-data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ---------- Renderização segura ---------- */
test('html escapa valores interpolados (anti-XSS)', () => {
  const name = '<img src=x onerror=alert(1)>"\'`&';
  const out = html`<span title="${name}">${name}</span>`.value;
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes('"<'));
  assert.equal(out, `<span title="${escapeHtml(name)}">${escapeHtml(name)}</span>`);
});

test('html aceita templates aninhados e arrays sem os escapar duas vezes', () => {
  const items = ['a<b', 'c'];
  const out = html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`.value;
  assert.equal(out, '<ul><li>a&lt;b</li><li>c</li></ul>');
});

test('html ignora null, undefined e booleanos', () => {
  assert.equal(html`${null}${undefined}${false}${true}x`.value, 'x');
});

test('raw só é usado para markup estático', () => {
  assert.equal(html`${raw('<b>ok</b>')}`.value, '<b>ok</b>');
});

test('safeUrl só aceita http/https', () => {
  assert.equal(safeUrl('https://a.pt/logo.png'), 'https://a.pt/logo.png');
  assert.equal(safeUrl('http://a.pt/x'), 'http://a.pt/x');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,<script>'), null);
  assert.equal(safeUrl('  '), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl('x'.repeat(5000)), null);
});

test('vars só produz pares numéricos', () => {
  assert.equal(vars({ 'art-h': 210, progress: 33.333, bad: NaN }), 'art-h:210;progress:33.33');
});

test('initials ignora marcadores de qualidade', () => {
  assert.equal(initials('Atlântico Notícias HD'), 'AN');
  assert.equal(initials('PT: Norte TV'), 'NO');
  assert.equal(initials('!!!'), '?');
});

test('hashString é estável', () => {
  assert.equal(hashString('abc'), hashString('abc'));
  assert.notEqual(hashString('abc'), hashString('abd'));
});

/* ---------- Router ---------- */
test('parseHash extrai caminho e query', () => {
  assert.deepEqual(parseHash('#/tv?cat=news'), { path: '/tv', query: { cat: 'news' } });
  assert.deepEqual(parseHash(''), { path: '/', query: {} });
  assert.deepEqual(parseHash('#/movies/a%20b/'), { path: '/movies/a b', query: {} });
  assert.deepEqual(parseHash('#/x/%E0%A4%A'), { path: '/x/%E0%A4%A', query: {} });
});

test('matchRoute resolve parâmetros', () => {
  const routes = ['/movies', '/movies/:id', '/settings/sources'].map((p) => ({ path: p, compiled: compile(p) }));
  assert.equal(matchRoute(routes, '/movies').route.path, '/movies');
  assert.deepEqual(matchRoute(routes, '/movies/demo-mv-1').params, { id: 'demo-mv-1' });
  assert.equal(matchRoute(routes, '/movies/1/extra'), null);
  assert.equal(matchRoute(routes, '/settings/sources').route.path, '/settings/sources');
});

/* ---------- Validação de URLs ---------- */
test('validateSourceUrl aceita https sem aviso', () => {
  const r = validateSourceUrl('https://exemplo.com/lista.m3u');
  assert.equal(r.ok, true);
  assert.equal(r.warning, undefined);
});

test('validateSourceUrl avisa em http e assume http sem esquema', () => {
  const r = validateSourceUrl('exemplo.com:8080/get.php?type=m3u');
  assert.equal(r.ok, true);
  assert.match(r.url, /^http:\/\/exemplo\.com:8080\//);
  assert.ok(r.warning);
});

test('validateSourceUrl rejeita entradas inválidas', () => {
  for (const bad of ['', '   ', 'ftp://x.com/a', 'javascript:alert(1)', 'http://user:pw@x.com', 'http://a b.com', 'http://exa_mple.com']) {
    assert.equal(validateSourceUrl(bad).ok, false, bad);
  }
});

test('validateSourceUrl (xtream) normaliza para a origem', () => {
  const r = validateSourceUrl('http://srv.tv:8080/player_api.php?username=a&password=b', { kind: 'xtream' });
  assert.equal(r.ok, true);
  assert.equal(r.url, 'http://srv.tv:8080');
  assert.equal(validateSourceUrl('https://srv.tv/painel/player_api.php', { kind: 'xtream' }).url, 'https://srv.tv/painel');
});

/* ---------- Formatação ---------- */
test('normalizeText remove acentos e normaliza espaços', () => {
  assert.equal(normalizeText('  Notícias   Ação '), 'noticias acao');
});

test('programmeProgress limita entre 0 e 100', () => {
  assert.equal(programmeProgress(0, 100, 50), 50);
  assert.equal(programmeProgress(0, 100, -10), 0);
  assert.equal(programmeProgress(0, 100, 200), 100);
  assert.equal(programmeProgress(100, 100, 100), 0);
});

test('formatDuration', () => {
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(120), '2 h');
  assert.equal(formatDuration(95), '1 h 35 min');
  assert.equal(formatDuration(0), '');
});

test('greeting por hora do dia', () => {
  assert.equal(greeting(new Date(2026, 0, 1, 8)), 'Bom dia');
  assert.equal(greeting(new Date(2026, 0, 1, 15)), 'Boa tarde');
  assert.equal(greeting(new Date(2026, 0, 1, 23)), 'Boa noite');
});

/* ---------- Dados de demonstração ---------- */
test('dados de demonstração são determinísticos e sem URLs de stream', () => {
  const a = createDemoCatalog(1);
  const b = createDemoCatalog(1);
  assert.deepEqual(a.channels.map((c) => c.name), b.channels.map((c) => c.name));
  assert.ok(a.channels.length > 100);
  const json = JSON.stringify(a);
  assert.ok(!/https?:\/\//.test(json), 'demo não deve conter URLs');
  const ids = new Set(a.channels.map((c) => c.id));
  assert.equal(ids.size, a.channels.length);
});

test('EPG de demonstração cobre o momento atual', () => {
  const { channels } = createDemoCatalog(1);
  const now = Date.now();
  for (const ch of channels.slice(0, 20)) {
    const epg = demoEpg(ch, now);
    assert.ok(epg.now.start <= now && now < epg.now.stop, ch.name);
    assert.equal(epg.next.start, epg.now.stop);
  }
});

/* ---------- Regras estáticas do código ---------- */
async function listFiles(dir, ext) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

test('templates não usam atributos style (bloqueados pela CSP)', async () => {
  for (const file of await listFiles(join(ROOT, 'js'), '.js')) {
    const src = await readFile(file, 'utf8');
    assert.ok(!/\sstyle="/.test(src), `atributo style em ${file}`);
  }
});

test('nenhum uso de alert/confirm/prompt nativos nem eval', async () => {
  for (const file of await listFiles(join(ROOT, 'js'), '.js')) {
    const src = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.ok(!/(^|[^.\w])(alert|confirm|prompt)\(/m.test(src), `diálogo nativo em ${file}`);
    assert.ok(!/\beval\(|new Function\(/.test(src), `eval em ${file}`);
  }
});

test('CSS dos componentes não usa cores hexadecimais fora dos tokens', async () => {
  for (const file of await listFiles(join(ROOT, 'css'), '.css')) {
    if (file.endsWith('tokens.css')) continue;
    const src = await readFile(file, 'utf8');
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(src), `cor literal em ${file}`);
  }
});

test('código-fonte sem caracteres invisíveis (BOM, separadores de linha Unicode)', async () => {
  for (const file of await listFiles(join(ROOT, 'js'), '.js')) {
    const src = await readFile(file, 'utf8');
    assert.ok(!/[\u200b-\u200f\u2028\u2029\ufeff]/.test(src), `carácter invisível em ${file}`);
  }
});
