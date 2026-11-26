/**
 * Teste de fumo end-to-end (Playwright + Chromium).
 * Percorre os fluxos principais num viewport de iPhone, em vertical e
 * horizontal, e falha em: erros de consola/CSP, scroll horizontal, elementos
 * interativos com área de toque < 44px.
 *
 * Uso: node tests/e2e/smoke.mjs [pasta-de-screenshots]
 * NOTA: Chromium ≠ Safari iOS. Comportamentos WebKit são validados no iPhone real.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { startServer } from '../serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const SHOTS = process.argv[2];
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

async function noOverflow(page, label) {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  check(sw <= vw, `${label}: scroll horizontal (${sw}px > ${vw}px)`);
}

async function touchTargets(page, label) {
  const small = await page.evaluate(() => [...document.querySelectorAll('.icon-btn, .tabbar__item, .btn, .segmented__btn, .cell')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.height < (el.classList.contains('segmented__btn') || el.classList.contains('btn--sm') ? 34 : 44) || r.width < 34)
    .map(({ el, r }) => `${el.className.split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`));
  check(small.length === 0, `${label}: alvos de toque pequenos: ${small.slice(0, 5).join(', ')}`);
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function go(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(350);
}

async function run() {
  const server = await startServer(PORT);
  if (SHOTS) await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch();

  for (const [orientation, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const L = (s) => `[${orientation}] ${s}`;

    // 1. Estado inicial: sem listas → onboarding
    await page.goto(BASE);
    await page.waitForSelector('.empty__title');
    check((await page.textContent('.empty__title')).includes('Bem-vindo'), L('onboarding não apareceu'));
    await noOverflow(page, L('início vazio'));
    await touchTargets(page, L('início vazio'));
    await shot(page, `${orientation}-01-home-empty`);

    // 2. Ativar demonstração
    await page.click('[data-action="enable-demo"]');
    await page.waitForSelector('.demo-banner');
    await page.waitForTimeout(300);
    check(await page.locator('.rail').count() >= 4, L('rails do início em falta'));
    await noOverflow(page, L('início demo'));
    await shot(page, `${orientation}-02-home-demo`);

    // 3. TV: lista virtualizada
    await page.click('[data-tab="tv"]');
    await page.waitForSelector('.channel-row');
    const total = await page.evaluate(() => parseInt(document.querySelector('[data-count]').textContent.replace(/\D/g, ''), 10));
    const rendered = await page.locator('.vlist__item').count();
    check(total > 100 && rendered < total, L(`virtualização (total ${total}, no DOM ${rendered})`));
    await noOverflow(page, L('tv lista'));
    await touchTargets(page, L('tv lista'));
    await shot(page, `${orientation}-03-tv-list`);

    // scroll profundo mantém linhas visíveis
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const visibleAfterScroll = await page.evaluate(() => [...document.querySelectorAll('.vlist__item')]
      .some((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }));
    check(visibleAfterScroll, L('sem linhas visíveis após scroll até ao fim'));
    await page.evaluate(() => window.scrollTo(0, 0));

    // pesquisa + filtro
    await page.fill('#tv-search', 'notic');
    await page.waitForTimeout(250);
    const filtered = await page.evaluate(() => parseInt(document.querySelector('[data-count]').textContent.replace(/\D/g, ''), 10));
    check(filtered > 0 && filtered < total, L(`pesquisa TV (resultado ${filtered})`));
    await page.click('[data-search-clear]');
    await page.click('[data-chip="cat"][data-value="sport"]');
    await page.waitForTimeout(150);
    check(page.url().includes('cat=sport'), L('URL não reflete categoria'));

    // favorito
    await page.locator('[data-action="toggle-fav"]').first().click();
    await page.waitForTimeout(100);
    check(await page.locator('[data-action="toggle-fav"][aria-pressed="true"]').count() === 1, L('favorito não marcado'));

    // grelha
    await page.click('[data-seg="view"][data-value="grid"]');
    await page.waitForSelector('.channel-tile');
    await noOverflow(page, L('tv grelha'));
    await shot(page, `${orientation}-04-tv-grid`);

    // ficha de canal
    await page.locator('[data-action="open-channel"]').first().click();
    await page.waitForSelector('.sheet .channel-sheet');
    await page.waitForTimeout(100);
    await shot(page, `${orientation}-05-channel-sheet`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await page.locator('.sheet').count() === 0, L('sheet não fechou com Escape'));
    await page.click('[data-seg="view"][data-value="list"]');

    // 4. Filmes + detalhe
    await page.click('[data-tab="movies"]');
    await page.waitForSelector('.poster');
    await noOverflow(page, L('filmes'));
    await shot(page, `${orientation}-06-movies`);
    await page.locator('.vlist .poster').first().click();
    await page.waitForSelector('.detail-hero');
    await noOverflow(page, L('detalhe filme'));
    await touchTargets(page, L('detalhe filme'));
    await shot(page, `${orientation}-07-movie-detail`);
    await page.click('[data-action="back"]');
    await page.waitForSelector('[data-grid]');

    // 5. Séries + detalhe com temporadas
    await page.click('[data-tab="series"]');
    await page.waitForSelector('.poster');
    await page.locator('.vlist .poster').first().click();
    await page.waitForSelector('.episodes');
    const seasonChips = await page.locator('[data-chip="season"]').count();
    if (seasonChips > 1) {
      await page.locator('[data-chip="season"]').nth(1).click();
      check(page.url().includes('season=2'), L('mudança de temporada'));
    }
    await noOverflow(page, L('detalhe série'));
    await shot(page, `${orientation}-08-series-detail`);

    // 6. Pesquisa global
    await go(page, '#/search?q=farol');
    await page.waitForSelector('[data-results] .section-header');
    await noOverflow(page, L('pesquisa'));
    await shot(page, `${orientation}-09-search`);

    // 7. Definições + listas + formulário
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('.group');
    await touchTargets(page, L('definições'));
    await shot(page, `${orientation}-10-settings`);
    await page.click('a[href="#/settings/sources"]');
    await page.waitForSelector('[data-action="add-source"]');
    await page.locator('.empty [data-action="add-source"]').click();
    await page.waitForSelector('[data-source-form]');
    await page.fill('#src-url', 'javascript:alert(1)');
    await page.locator('#src-name').focus();
    check((await page.textContent('[data-msg-for="src-url"]')).length > 0, L('validação de URL inválido'));
    await page.fill('#src-url', 'http://exemplo.com/lista.m3u');
    await page.locator('#src-name').focus();
    check((await page.getAttribute('[data-msg-for="src-url"]', 'class')).includes('warning'), L('aviso http em falta'));
    await page.click('[data-seg="type"][data-value="xtream"]');
    check(await page.isVisible('#src-server'), L('painel Xtream não visível'));
    await noOverflow(page, L('formulário lista'));
    await shot(page, `${orientation}-11-add-source`);
    await page.click('.sheet [data-close].icon-btn');
    await page.waitForTimeout(150);

    // 8. Eliminar dados (diálogo próprio)
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('[data-action="wipe"]');
    await page.click('[data-action="wipe"]');
    await page.waitForSelector('.dialog');
    await shot(page, `${orientation}-12-wipe-dialog`);
    await page.click('.dialog [data-confirm]');
    await page.waitForSelector('.empty__title');
    check((await page.textContent('.empty__title')).includes('Bem-vindo'), L('dados não foram eliminados'));

    check(errors.length === 0, L(`erros na consola: ${errors.slice(0, 3).join(' | ')}`));
    await ctx.close();
  }

  await browser.close();
  server.close();

  if (failures.length) {
    console.error(`FALHOU (${failures.length}):\n - ${failures.join('\n - ')}`);
    process.exit(1);
  }
  console.log('OK — todos os fluxos de fumo passaram (vertical e horizontal).');
}

run().catch((err) => { console.error(err); process.exit(1); });
