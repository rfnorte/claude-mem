/**
 * E2E da Fase 3 — importação real no browser (Chromium + IndexedDB + Web Worker).
 * Usa servidores simulados locais (tests/mocks.mjs). Sem dados reais.
 *
 * Uso: node tests/e2e/import.mjs [pasta-de-screenshots]
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../serve.mjs';
import { XT_USER, XT_PASS } from '../mocks.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 5201;
const NOCORS_PORT = 5202;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const APP = `${ORIGIN}/index.html`;
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'sample.m3u');
const SHOTS = process.argv[2];
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✓' : '✗'} ${msg}`); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const count = (page) => page.evaluate(() => parseInt(document.querySelector('[data-count]')?.textContent.replace(/\D/g, '') || '0', 10));

async function addSource(page, { type = 'url', name, url, server, user, pass, file }) {
  await page.evaluate(() => { location.hash = '#/settings/sources?add=1'; });
  await page.waitForSelector('[data-source-form]');
  if (type !== 'url') await page.click(`[data-seg="type"][data-value="${type}"]`);
  await page.fill('#src-name', name);
  if (url) await page.fill('#src-url', url);
  if (server) { await page.fill('#src-server', server); await page.fill('#src-user', user); await page.fill('#src-pass', pass); }
  if (file) await page.setInputFiles('#src-file', file);
}

async function waitResult(page) {
  await page.waitForSelector('.import-result', { timeout: 60_000 });
  return page.textContent('.import-result__title');
}

async function closeSheets(page) {
  while (await page.locator('.sheet [data-close].icon-btn').count()) {
    await page.locator('.sheet [data-close].icon-btn').first().click();
    await page.waitForTimeout(150);
  }
}

async function run() {
  const server = await startServer(PORT, { mocks: true });
  const noCors = await startServer(NOCORS_PORT, { mocks: true, cors: false });
  if (SHOTS) await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|CORS|Access-Control/i.test(m.text())) errors.push(m.text()); });

  await page.goto(APP);
  await page.waitForSelector('.empty__title');

  /* 1. Teste de ligação: página que não é M3U, stream HLS, servidor sem CORS */
  await addSource(page, { name: 'Teste', url: `${ORIGIN}/__mock/page.html` });
  check(!(await page.isVisible('#src-server')) && !(await page.isVisible('.file-drop')), 'formulário mostra apenas o painel do tipo escolhido');
  await page.click('[data-test]');
  await page.waitForSelector('[data-test-result] .notice');
  check((await page.textContent('[data-test-result]')).includes('não é uma lista M3U'), 'teste: HTML detetado como não-M3U');
  await page.fill('#src-url', `${ORIGIN}/__mock/stream.m3u8`);
  await page.click('[data-test]');
  await page.waitForFunction(() => document.querySelector('[data-test-result]')?.textContent.includes('stream'));
  check(true, 'teste: stream HLS distinguido de lista');
  await page.fill('#src-url', `http://127.0.0.1:${NOCORS_PORT}/__mock/list.m3u`);
  await page.click('[data-test]');
  await page.waitForFunction(() => document.querySelector('[data-test-result]')?.textContent.includes('Não foi possível ligar'));
  check((await page.textContent('[data-test-result]')).includes('CORS'), 'teste: servidor sem CORS → mensagem com causa provável');
  await page.fill('#src-url', `${ORIGIN}/__mock/list.m3u`);
  await page.click('[data-test]');
  await page.waitForFunction(() => document.querySelector('[data-test-result]')?.textContent.includes('Lista acessível'));
  check(true, 'teste: lista válida acessível');
  await shot(page, 'p3-01-test-ok');

  /* 2. Importar M3U por URL */
  await page.click('[data-source-form] [type="submit"]');
  check((await waitResult(page)) === 'Lista importada', 'import M3U por URL concluída');
  const stats = await page.$$eval('.stat__value', (els) => els.map((e) => Number(e.textContent.replace(/\D/g, ''))));
  check(stats[0] >= 8 && stats[1] >= 2 && stats[2] === 2, `contagens M3U (canais ${stats[0]}, filmes ${stats[1]}, séries ${stats[2]})`);
  check((await page.textContent('.import-result')).includes('duplicada'), 'resumo indica duplicados');
  await shot(page, 'p3-02-import-done');
  await page.click('.import-result a.btn--primary');
  await page.waitForSelector('.channel-row');
  const total = await count(page);
  check(total === stats[0], `TV mostra ${total} canais`);
  check(await page.evaluate(() => document.querySelectorAll('img[onerror], script:not([src])').length === 0), 'nome malicioso não gera HTML executável');
  check(await page.evaluate(() => document.body.textContent.includes('<img src=x onerror=alert(1)>Canal malicioso')), 'nome malicioso mostrado como texto');
  check(await page.evaluate(() => ![...document.querySelectorAll('img')].some((i) => i.src.startsWith('javascript:'))), 'logótipo javascript: rejeitado');
  await shot(page, 'p3-03-tv-real');

  /* 3. Filmes e séries reais */
  await page.click('[data-tab="movies"]');
  await page.waitForSelector('.vlist .poster');
  check(await page.locator('.poster__title', { hasText: 'O Grande Exemplo (2019)' }).count() === 1, 'filme importado visível');
  await page.click('[data-tab="series"]');
  await page.waitForSelector('.vlist .poster');
  await page.locator('.vlist .poster', { hasText: 'Série Exemplo' }).click();
  await page.waitForSelector('.episodes');
  check(await page.locator('[data-chip="season"]').count() === 2, 'série com 2 temporadas');
  check(await page.locator('.episode__title', { hasText: 'O Regresso' }).count() === 1, 'título do episódio extraído');
  await shot(page, 'p3-04-series-real');

  /* 4. Persistência após recarregar */
  await page.reload();
  await page.evaluate(() => { location.hash = '#/tv'; });
  await page.waitForSelector('.channel-row');
  check(await count(page) === total, 'dados persistem após recarregar (IndexedDB)');

  /* 5. Corrigir categorias: "Filmes" passa a TV */
  await page.evaluate(() => { location.hash = '#/settings/sources'; });
  await page.waitForSelector('.source-card');
  await page.click('.source-card');
  await page.waitForSelector('[data-action="categories"]');
  await shot(page, 'p3-05-source-detail');
  await page.click('[data-action="categories"]');
  await page.waitForSelector('.category-row');
  const idx = await page.$$eval('.category-row__name', (els) => els.findIndex((e) => e.textContent.trim() === 'Filmes'));
  await page.selectOption(`#cat-${idx}`, 'live');
  await shot(page, 'p3-06-categories');
  await page.click('[data-apply]');
  await page.waitForSelector('.toast--success');
  await page.evaluate(() => { location.hash = '#/tv'; });
  await page.waitForSelector('.channel-row');
  check(await count(page) === total + 1, `correção de categoria aplicada (${total} → ${await count(page)})`);

  /* 6. Xtream: password errada, depois correta */
  await addSource(page, { type: 'xtream', name: 'Xtream teste', server: `${ORIGIN}/__mock/xtream`, user: XT_USER, pass: 'errada' });
  await page.click('[data-test]');
  await page.waitForFunction(() => document.querySelector('[data-test-result]')?.textContent.includes('incorretos'));
  check(true, 'Xtream: credenciais erradas detetadas');
  await page.fill('#src-pass', XT_PASS);
  await page.click('[data-test]');
  await page.waitForFunction(() => document.querySelector('[data-test-result]')?.textContent.includes('Conta ativa'));
  check((await page.textContent('[data-test-result]')).includes('expira'), 'Xtream: conta ativa com validade');
  await page.click('[data-source-form] [type="submit"]');
  check((await waitResult(page)) === 'Lista importada', 'import Xtream concluída');
  await closeSheets(page);
  await page.evaluate(() => { location.hash = '#/series'; });
  await page.waitForSelector('.vlist .poster');
  await page.locator('.vlist .poster', { hasText: 'Série XT' }).click();
  await page.waitForSelector('.episodes');
  check(await page.locator('[data-chip="season"]').count() === 2, 'Xtream: episódios obtidos a pedido (2 temporadas)');

  /* 7. Credenciais não ficam em claro na base de dados */
  const leak = await page.evaluate(async ({ user, pass }) => {
    const db = await new Promise((r) => { const q = indexedDB.open('iptv-player'); q.onsuccess = () => r(q.result); });
    const all = await new Promise((r) => { const q = db.transaction('sources').objectStore('sources').getAll(); q.onsuccess = () => r(q.result); });
    db.close();
    const text = JSON.stringify(all);
    return text.includes(pass) || text.includes(user) || text.includes('__mock/list.m3u');
  }, { user: XT_USER, pass: XT_PASS });
  check(!leak, 'credenciais e URL da lista cifrados no IndexedDB');

  /* 8. Ficheiro local */
  await addSource(page, { type: 'file', name: 'Ficheiro', file: FIXTURE });
  await page.click('[data-source-form] [type="submit"]');
  check((await waitResult(page)) === 'Lista importada', 'import por ficheiro concluída');
  await closeSheets(page);

  /* 9. Lista grande (50 000 entradas) */
  const t0 = Date.now();
  await addSource(page, { name: 'Grande', url: `${ORIGIN}/__mock/big.m3u?n=50000` });
  await page.click('[data-source-form] [type="submit"]');
  await page.waitForSelector('.import-progress');
  // a interface tem de continuar responsiva durante a importação
  const lag = await page.evaluate(() => new Promise((r) => { const s = performance.now(); setTimeout(() => r(performance.now() - s), 50); }));
  check(lag < 500, `UI responsiva durante importação (atraso ${lag.toFixed(0)} ms)`);
  check((await waitResult(page)) === 'Lista importada', `lista de 50 000 importada em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await closeSheets(page);
  await page.evaluate(() => { location.hash = '#/tv'; });
  await page.waitForSelector('.channel-row');
  check(await count(page) > 50_000, `TV com ${await count(page)} canais (virtualizada: ${await page.locator('.vlist__item').count()} no DOM)`);
  await page.fill('#tv-search', 'grande 4999');
  await page.waitForTimeout(400);
  check(await count(page) >= 1 && await count(page) < 50, `pesquisa em lista grande (${await count(page)} resultados)`);

  /* 10. Desativar e eliminar */
  await page.evaluate(() => { location.hash = '#/settings/sources'; });
  await page.waitForSelector('.source-card');
  await page.locator('.source-card', { hasText: 'Grande' }).click();
  await page.waitForSelector('#source-enabled');
  await page.click('label.cell:has(#source-enabled)');
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#/tv'; });
  await page.waitForSelector('.channel-row');
  check(await count(page) < 50_000, 'lista desativada deixa de aparecer');
  await page.evaluate(() => { location.hash = '#/settings/sources'; });
  await page.waitForSelector('.source-card');
  await page.locator('.source-card', { hasText: 'Grande' }).click();
  await page.waitForSelector('[data-action="delete"]');
  await page.click('[data-action="delete"]');
  await page.click('.dialog [data-confirm]');
  await page.waitForSelector('.source-card');
  check(await page.locator('.source-card', { hasText: 'Grande' }).count() === 0, 'lista eliminada');
  await shot(page, 'p3-07-sources-list');

  /* 11. Eliminar todos os dados */
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForSelector('[data-action="wipe"]');
  await page.click('[data-action="wipe"]');
  await page.click('.dialog [data-confirm]');
  await page.waitForSelector('.empty__title');
  check((await page.textContent('.empty__title')).includes('Bem-vindo'), 'eliminar tudo limpa IndexedDB');

  check(errors.length === 0, `sem erros JS (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
  server.close();
  noCors.close();
  if (failures.length) { console.error(`\nFALHOU (${failures.length})`); process.exit(1); }
  console.log('\nOK — importação validada.');
}

run().catch((err) => { console.error(err); process.exit(1); });
