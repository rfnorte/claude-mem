// Testes end-to-end do Kivo desktop (Electron real, via Playwright).
'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { launch, tmpUserData, stubSaveDialog } = require('./helpers');

const snap = page => page.evaluate(() => JSON.parse(window.KV.snapshot()));
const stateFile = ud => path.join(ud, 'data', 'kivo-state.json');
async function nav(page, view) {
  await page.evaluate(v => { location.hash = '#' + v; }, view);
  await expect(page.locator('.view[data-view="' + view + '"]')).toBeVisible();
}
async function waitMirror(ud, pred) {
  await expect.poll(() => { try { return pred(JSON.parse(fs.readFileSync(stateFile(ud), 'utf8'))); } catch (e) { return false; } }, { timeout: 5000 }).toBe(true);
}

test.describe.configure({ mode: 'serial' });

let ud; // pasta de dados partilhada pelos testes de persistência

test('1. Arranque: janela, título, sem erros, isolamento do Node', async () => {
  ud = tmpUserData('main');
  const { app, page } = await launch(ud);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const info = await app.evaluate(({ BrowserWindow, Menu }) => { const w = BrowserWindow.getAllWindows()[0]; return { visible: w.isVisible(), title: w.getTitle(), menu: !!Menu.getApplicationMenu() }; });
  expect(info.visible).toBe(true);
  expect(info.title).toBe('Kivo');
  expect(info.menu).toBe(true);
  const iso = await page.evaluate(() => ({ url: location.href, req: typeof require, proc: typeof process, ipc: typeof window.ipcRenderer, nativeKeys: Object.keys(window.kivoNative).sort(), font: document.fonts.check('650 24px Inter') }));
  expect(iso.url).toBe('kivo://app/index.html');
  expect(iso.req).toBe('undefined');
  expect(iso.proc).toBe('undefined');
  expect(iso.ipc).toBe('undefined');
  expect(iso.font).toBe(true);
  expect(iso.nativeKeys).toEqual(['clearState', 'exportBackup', 'exportDuetto', 'inspectBackup', 'onMenu', 'readInitialState', 'restoreBackup', 'writeState']);
  await expect(page.locator('h1.h1').first()).toHaveText('Início');
  expect(errors).toEqual([]);
  await app.close();
});

test('2. Navegação por todas as secções (barra lateral e menu nativo)', async () => {
  const { app, page } = await launch(ud);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const views = await page.$$eval('a.nav[data-nav]', as => [...new Set(as.map(a => a.getAttribute('data-nav')))]);
  expect(views.length).toBe(15);
  for (const v of views) {
    await page.locator('a.nav[data-nav="' + v + '"]').first().click();
    await expect(page.locator('.view[data-view="' + v + '"]')).toBeVisible();
    await expect(page.locator('.view:not([hidden])')).toHaveCount(1);
  }
  // Menu nativo "Ir > Investimentos"
  await app.evaluate(({ Menu }) => { const m = Menu.getApplicationMenu(); m.items.find(i => i.label === '&Ir').submenu.items.find(i => i.label === 'Investimentos').click(); });
  await expect(page.locator('.view[data-view="investments"]')).toBeVisible();
  expect(errors).toEqual([]);
  await app.close();
});

test('3. Criar, editar e eliminar registos (contas a pagar, transações, regras)', async () => {
  const { app, page } = await launch(ud);
  const before = await snap(page);

  // Criar conta a pagar
  await nav(page, 'bills');
  await page.locator('[data-open-bill]').click();
  await page.fill('#bill-nome', 'Teste Desktop Lda');
  await page.fill('#bill-valor', '12,34');
  await page.locator('#bill-dialog button[type=submit]').click();
  let s = await snap(page);
  expect(s.bills.length).toBe(before.bills.length + 1);
  const bill = s.bills.find(b => b.name === 'Teste Desktop Lda');
  expect(bill.value).toBeCloseTo(12.34);

  // Editar conta a pagar
  await page.locator('[data-kv-bill-edit="' + bill.id + '"]').click();
  await page.fill('#bill-valor', '56,78');
  await page.locator('#bill-dialog button[type=submit]').click();
  s = await snap(page);
  expect(s.bills.find(b => b.id === bill.id).value).toBeCloseTo(56.78);

  // Editar transação
  await nav(page, 'transactions');
  const txId = await page.locator('[data-kv-tx-edit]').first().getAttribute('data-kv-tx-edit');
  await page.locator('[data-kv-tx-edit="' + txId + '"]').click();
  await page.fill('#tx-merchant', 'Comerciante Editado');
  await page.locator('#tx-dialog button[type=submit]').click();
  s = await snap(page);
  expect(s.tx.find(t => t.id === txId).merchant).toBe('Comerciante Editado');

  // Criar e eliminar regra
  await nav(page, 'settings');
  const nRules = s.rules.length;
  await page.locator('[data-kv-rule-add]').first().click();
  await page.fill('#rule-match', 'REGRA TESTE');
  await page.locator('#rule-dialog button[type=submit]').click();
  s = await snap(page);
  const rule = s.rules.find(r => r.match === 'REGRA TESTE');
  expect(rule).toBeTruthy();
  expect(s.rules.length).toBe(nRules + 1);
  await page.locator('[data-kv-rule-del="' + rule.id + '"]').click();
  await page.locator('[data-kv-confirm-ok]').click();
  s = await snap(page);
  expect(s.rules.find(r => r.id === rule.id)).toBeUndefined();

  // Criar uma segunda conta a pagar e eliminá-la
  await nav(page, 'bills');
  await page.locator('[data-open-bill]').click();
  await page.fill('#bill-nome', 'Para Apagar');
  await page.fill('#bill-valor', '1,00');
  await page.locator('#bill-dialog button[type=submit]').click();
  s = await snap(page);
  const del = s.bills.find(b => b.name === 'Para Apagar');
  await page.locator('[data-kv-bill-del="' + del.id + '"]').click();
  await page.locator('[data-kv-confirm-ok]').click();
  s = await snap(page);
  expect(s.bills.find(b => b.id === del.id)).toBeUndefined();

  await waitMirror(ud, o => o.bills.some(b => b.name === 'Teste Desktop Lda' && Math.abs(b.value - 56.78) < 1e-9) && !o.bills.some(b => b.name === 'Para Apagar'));
  await app.close();
});

test('4/8. Persistência após fechar e reabrir (+ janela e cópia automática)', async () => {
  const { app, page } = await launch(ud);
  const s = await snap(page);
  expect(s.bills.find(b => b.name === 'Teste Desktop Lda').value).toBeCloseTo(56.78);
  expect(s.tx.some(t => t.merchant === 'Comerciante Editado')).toBe(true);
  const autos = fs.readdirSync(path.join(ud, 'backups', 'auto')).filter(n => n.endsWith('.kivo'));
  expect(autos.length).toBeGreaterThan(0);
  const settings = JSON.parse(fs.readFileSync(path.join(ud, 'settings.json'), 'utf8'));
  expect(settings.window && settings.window.bounds).toBeTruthy();
  await app.close();
});

test('4b. Recuperação a partir do disco se o armazenamento do browser se perder', async () => {
  fs.rmSync(path.join(ud, 'Local Storage'), { recursive: true, force: true });
  const { app, page } = await launch(ud);
  const s = await snap(page);
  expect(s.bills.find(b => b.name === 'Teste Desktop Lda')).toBeTruthy();
  await app.close();
});

test('5. Funcionamento offline: nenhum pedido sai do computador', async () => {
  const { app, page } = await launch(ud);
  for (const v of ['home', 'insights', 'investments', 'networth', 'forecast', 'settings']) await nav(page, v);
  const r = await page.evaluate(async () => { try { await fetch('https://example.com/'); return 'ok'; } catch (e) { return 'blocked'; } });
  expect(r).toBe('blocked');
  const diag = await app.evaluate(() => global.kivoDiagnostics());
  expect(diag.blocked.filter(u => !u.startsWith('https://example.com'))).toEqual([]);
  // Todas as fontes carregadas são locais
  const fontsOk = await page.evaluate(() => [...document.fonts].every(f => f.status !== 'error'));
  expect(fontsOk).toBe(true);
  await app.close();
});

test('6/7. Exportar cópia, restaurar, ficheiro de segurança e validação', async () => {
  const { app, page } = await launch(ud);
  const out = path.join(ud, 'export-test');
  fs.mkdirSync(out, { recursive: true });
  const backupPath = path.join(out, 'kivo-teste.kivo');

  // Exportar
  await nav(page, 'settings');
  await stubSaveDialog(app, backupPath);
  await page.locator('[data-desktop-backup]').click();
  await expect(page.locator('#toast')).toContainText('kivo-teste.kivo');
  const env = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  expect(env.formato).toBe('kivo-backup');
  expect(crypto.createHash('sha256').update(env.dados).digest('hex')).toBe(env.sha256);
  expect(JSON.parse(env.dados).bills.some(b => b.name === 'Teste Desktop Lda')).toBe(true);

  // Alterar dados depois da cópia
  await nav(page, 'bills');
  await page.locator('[data-open-bill]').click();
  await page.fill('#bill-nome', 'Depois da Copia');
  await page.fill('#bill-valor', '9,99');
  await page.locator('#bill-dialog button[type=submit]').click();
  expect((await snap(page)).bills.some(b => b.name === 'Depois da Copia')).toBe(true);

  // Ficheiro inválido: recusado, dados intactos
  await nav(page, 'settings');
  const bad = path.join(out, 'estragado.kivo');
  fs.writeFileSync(bad, '{ isto não é json');
  await page.setInputFiles('#file-backup', bad);
  await expect(page.locator('[data-restore="error"]')).toBeVisible();
  await expect(page.locator('#restore-dialog')).not.toBeVisible();
  // Cópia adulterada (verificação de integridade)
  const tampered = path.join(out, 'adulterado.kivo');
  const t = Object.assign({}, env, { dados: env.dados.replace('Teste Desktop Lda', 'Teste Adulterado') });
  fs.writeFileSync(tampered, JSON.stringify(t));
  await page.setInputFiles('#file-backup', tampered);
  await expect(page.locator('[data-restore="error"]')).toContainText('integridade');
  // Extensão errada
  const wrong = path.join(out, 'outra.db'); fs.writeFileSync(wrong, 'x');
  await page.setInputFiles('#file-backup', wrong);
  await expect(page.locator('[data-restore="error"]')).toBeVisible();
  expect((await snap(page)).bills.some(b => b.name === 'Depois da Copia')).toBe(true);

  // Restaurar a cópia válida: pede confirmação
  await page.setInputFiles('#file-backup', backupPath);
  await expect(page.locator('#restore-dialog')).toBeVisible();
  await expect(page.locator('#restore-dialog [data-restore-file]')).toHaveText('kivo-teste.kivo');
  // Cancelar não altera nada
  await page.locator('#restore-dialog [data-close]').click();
  expect((await snap(page)).bills.some(b => b.name === 'Depois da Copia')).toBe(true);
  // Confirmar
  await page.setInputFiles('#file-backup', backupPath);
  const reloaded = page.waitForEvent('load');
  await page.locator('[data-restore-confirm]').click();
  await reloaded;
  await page.waitForFunction(() => !!window.KV);
  await expect(page.locator('[data-restore="ok"]')).toBeVisible();
  const s = await snap(page);
  expect(s.bills.some(b => b.name === 'Depois da Copia')).toBe(false);
  expect(s.bills.some(b => b.name === 'Teste Desktop Lda')).toBe(true);
  // Cópia de segurança do estado anterior (contém os dados substituídos)
  const safety = fs.readdirSync(path.join(ud, 'backups')).filter(n => n.startsWith('kivo-antes-de-restaurar-'));
  expect(safety.length).toBe(1);
  await expect(page.locator('[data-restore-safety]')).toHaveText(safety[0]);
  const sEnv = JSON.parse(fs.readFileSync(path.join(ud, 'backups', safety[0]), 'utf8'));
  expect(JSON.parse(sEnv.dados).bills.some(b => b.name === 'Depois da Copia')).toBe(true);
  await waitMirror(ud, o => !o.bills.some(b => b.name === 'Depois da Copia'));
  await app.close();

  // Persistência da restauração após reabrir
  const r2 = await launch(ud);
  expect((await snap(r2.page)).bills.some(b => b.name === 'Depois da Copia')).toBe(false);
  await r2.app.close();
});

test('6b. Exportar para o Duetto (JSON real)', async () => {
  const { app, page } = await launch(ud);
  const f = path.join(ud, 'export-test', 'duetto.json');
  await nav(page, 'settings');
  await stubSaveDialog(app, f);
  await page.locator('[data-desktop-duetto]').click();
  await expect(page.locator('#toast')).toContainText('duetto.json');
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  expect(d.formato).toBe('kivo-duetto');
  expect(d.contas.length).toBeGreaterThan(0);
  expect(d.categorias.length).toBeGreaterThan(0);
  expect(d.transacoes.length).toBeGreaterThan(0);
  expect(d.investimentos.posicoes.length).toBeGreaterThan(0);
  await app.close();
});

test('7b. Cancelar o diálogo de gravação não cria ficheiros nem erros', async () => {
  const { app, page } = await launch(ud);
  await nav(page, 'settings');
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }); });
  await page.locator('[data-desktop-backup]').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#toast')).toBeHidden();
  await app.close();
});

test('9. Segurança: navegação externa, janelas e IPC não confiável', async () => {
  const { app, page } = await launch(ud);
  await page.evaluate(() => { location.href = 'https://example.com/'; });
  await page.waitForTimeout(500);
  expect(page.url()).toMatch(/^kivo:\/\/app\/index\.html/);
  expect(await page.evaluate(() => window.open('https://example.com/'))).toBeNull();
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  // O preload rejeita estados inválidos: nada é gravado
  const before = fs.readFileSync(stateFile(ud), 'utf8');
  await page.evaluate(() => window.kivoNative.writeState('{"v":2,"hack":true}'));
  await page.waitForTimeout(600);
  expect(fs.readFileSync(stateFile(ud), 'utf8')).toBe(before);
  // Caminhos fora da pasta da aplicação não são servidos
  const r = await page.evaluate(async () => { try { const x = await (await fetch('kivo://app/../electron/main.js')).text(); return x.slice(0, 20); } catch (e) { return 'blocked'; } });
  expect(r).not.toContain('use strict');
  await app.close();
});

test('10. Repor dados de exemplo guarda o ficheiro anterior (nunca apaga)', async () => {
  const { app, page } = await launch(ud);
  const reloaded = page.waitForEvent('load');
  await page.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-kv-demo', ''); b.type = 'button'; document.body.appendChild(b); b.click(); });
  await reloaded;
  await page.waitForFunction(() => !!window.KV);
  const removed = fs.readdirSync(path.join(ud, 'data')).filter(n => /^kivo-state\.removido-.*\.json$/.test(n));
  expect(removed.length).toBe(1);
  expect(JSON.parse(fs.readFileSync(path.join(ud, 'data', removed[0]), 'utf8')).bills.some(b => b.name === 'Teste Desktop Lda')).toBe(true);
  expect((await snap(page)).bills.some(b => b.name === 'Teste Desktop Lda')).toBe(false);
  await app.close();
  // Depois de reabrir, continuam os dados de exemplo (os dados removidos não ressuscitam)
  const r2 = await launch(ud);
  expect((await snap(r2.page)).bills.some(b => b.name === 'Teste Desktop Lda')).toBe(false);
  await r2.app.close();
});

test('11. Diferentes resoluções: sem deslocamento horizontal da página', async () => {
  const { app, page } = await launch(tmpUserData('res'));
  const shots = process.env.KIVO_SHOTS;
  for (const [w, h] of [[1920, 1080], [1366, 768], [1024, 700], [800, 600]]) {
    await app.evaluate(({ BrowserWindow }, sz) => { const win = BrowserWindow.getAllWindows()[0]; win.unmaximize(); win.setContentSize(sz[0], sz[1]); }, [w, h]);
    await page.waitForTimeout(250);
    for (const v of ['home', 'review', 'transactions', 'bills', 'accounts', 'import', 'insights', 'networth', 'investments', 'forecast', 'debt', 'budget', 'goals', 'weekly', 'settings']) {
      await nav(page, v);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      // Tolerância de 2px: o desenho original tem 1–2px de texto a mais em "Análises"/"Importar" exatamente a 1024px (ver docs/RELATORIO-TESTES.md).
      expect(over, v + ' @ ' + w + 'x' + h).toBeLessThanOrEqual(2);
      if (shots && v === 'home') await page.screenshot({ path: path.join(shots, 'kivo-' + w + 'x' + h + '.png') });
    }
  }
  await app.close();
});
