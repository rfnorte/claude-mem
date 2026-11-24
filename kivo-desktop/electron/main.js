/* Kivo — processo principal do Electron.
 * Abre a aplicação original (app/index.html) numa janela nativa, totalmente offline. */
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { Storage, StorageError, parseState, writeAtomic, stamp } = require('./storage');
const { buildMenu } = require('./menu');

const APP_ID = 'pt.kivo.desktop';
const SCHEME = 'kivo';
const ORIGIN = SCHEME + '://app';
const ENTRY = ORIGIN + '/index.html';
const APP_DIR = path.join(__dirname, '..', 'app');

// Pasta de dados alternativa (apenas testes automáticos).
if (process.env.KIVO_USER_DATA) app.setPath('userData', path.resolve(process.env.KIVO_USER_DATA));

app.setAppUserModelId(APP_ID);
// Sandbox de todos os renderers. (--no-sandbox só é usado no contentor Linux de testes, que corre como root.)
if (!app.commandLine.hasSwitch('no-sandbox')) app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: false, corsEnabled: false } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); return; }

let win = null;
let storage = null;
const blocked = [];

/* ---------- erros compreensíveis ---------- */
function fatal(title, err) {
  const msg = err && err.message ? err.message : String(err);
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'kivo-erros.log'), new Date().toISOString() + ' ' + title + ': ' + (err && err.stack || msg) + '\n'); } catch (e) { /* ignorar */ }
  dialog.showErrorBox('Kivo — ' + title, msg + '\n\nOs teus dados não foram alterados. Se o problema persistir, contacta o suporte e indica o ficheiro kivo-erros.log na pasta de dados.');
}
process.on('uncaughtException', e => fatal('Erro inesperado', e));

/* ---------- servir a aplicação a partir do pacote ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
function serve(request) {
  try {
    const u = new URL(request.url);
    if (u.host !== 'app' || request.method !== 'GET') return new Response('Not found', { status: 404 });
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(APP_DIR, rel);
    if (!file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
    const type = MIME[path.extname(file).toLowerCase()];
    if (!type || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Not found', { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200, headers: { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' } });
  } catch (e) {
    return new Response('Error', { status: 500 });
  }
}

/* ---------- IPC (só aceita pedidos da própria aplicação) ---------- */
// Nota: new URL('kivo://…').origin devolve 'null' para esquemas personalizados; compara-se o prefixo exato.
const trusted = e => { try { return !!win && e.sender === win.webContents && !!e.senderFrame && e.senderFrame === win.webContents.mainFrame && e.senderFrame.url.startsWith(ORIGIN + '/'); } catch (x) { return false; } };
const fail = e => ({ ok: false, error: e instanceof StorageError ? e.message : 'Ocorreu um erro inesperado: ' + (e && e.message || e) });
const dateTag = () => new Date().toISOString().slice(0, 10);

function lastDir(key, fallback) {
  const d = storage.readSettings()[key];
  return d && fs.existsSync(d) ? d : fallback;
}
async function saveFile({ title, defaultName, dirKey, filters, ext, content }) {
  const r = await dialog.showSaveDialog(win, { title, defaultPath: path.join(lastDir(dirKey, app.getPath('documents')), defaultName), filters, properties: ['createDirectory', 'showOverwriteConfirmation'] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  let file = r.filePath;
  if (path.extname(file).toLowerCase() !== ext) file += ext;
  // Proteção contra sobrescrita: o diálogo nativo já pede confirmação; para nomes alterados aqui, nunca sobrescreve em silêncio.
  if (file !== r.filePath && fs.existsSync(file)) {
    const c = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Substituir', 'Cancelar'], defaultId: 1, cancelId: 1, title: 'Kivo', message: 'Já existe um ficheiro com o nome ' + path.basename(file) + '.', detail: 'Queres substituí-lo?' });
    if (c.response !== 0) return { ok: false, canceled: true };
  }
  writeAtomic(file, content);
  storage.writeSettings({ [dirKey]: path.dirname(file) });
  return { ok: true, name: path.basename(file), path: file };
}

function registerIpc() {
  ipcMain.on('kivo:state:read-initial', e => { e.returnValue = trusted(e) ? storage.readState() : null; });
  ipcMain.on('kivo:state:write', (e, s) => { if (trusted(e) && typeof s === 'string') storage.queueWrite(s); });
  ipcMain.on('kivo:state:clear', e => { if (trusted(e)) { try { storage.clearState(); } catch (x) { fatal('Não foi possível limpar os dados', x); } } });

  ipcMain.handle('kivo:backup:export', async (e, state) => {
    if (!trusted(e)) return { ok: false, error: 'Pedido recusado.' };
    try {
      const content = storage.makeBackup(state);
      return await saveFile({ title: 'Guardar cópia de segurança do Kivo', defaultName: 'kivo-' + dateTag() + '.kivo', dirKey: 'lastBackupDir', filters: [{ name: 'Cópia de segurança do Kivo', extensions: ['kivo'] }], ext: '.kivo', content });
    } catch (x) { return fail(x); }
  });
  ipcMain.handle('kivo:duetto:export', async (e, json) => {
    if (!trusted(e)) return { ok: false, error: 'Pedido recusado.' };
    try {
      let o; try { o = JSON.parse(json); } catch (x) { throw new StorageError('Exportação inválida.'); }
      if (!o || o.formato !== 'kivo-duetto') throw new StorageError('Exportação inválida.');
      return await saveFile({ title: 'Exportar para o Duetto', defaultName: 'duetto-' + dateTag() + '.json', dirKey: 'lastExportDir', filters: [{ name: 'JSON', extensions: ['json'] }], ext: '.json', content: json });
    } catch (x) { return fail(x); }
  });
  ipcMain.handle('kivo:backup:inspect', (e, text) => {
    if (!trusted(e)) return { ok: false, error: 'Pedido recusado.' };
    try { return { ok: true, meta: storage.inspectBackup(text).meta }; } catch (x) { return fail(x); }
  });
  ipcMain.handle('kivo:backup:restore', (e, text, current) => {
    if (!trusted(e)) return { ok: false, error: 'Pedido recusado.' };
    try {
      const { state } = storage.inspectBackup(text);          // 1. validar a cópia
      const safety = storage.safetyBackup(current);           // 2. guardar o estado atual (não apaga nada)
      storage.queueWrite(state); storage.flush();             // 3. gravar o novo estado em disco
      return { ok: true, state, safetyName: safety ? path.basename(safety) : null };
    } catch (x) { return fail(x); }
  });
}

/* ---------- janela ---------- */
function windowOptions() {
  const s = storage.readSettings().window || {};
  const o = { width: 1440, height: 900 };
  const area = screen.getPrimaryDisplay().workAreaSize;
  o.width = Math.min(o.width, area.width); o.height = Math.min(o.height, area.height);
  if (s.bounds && s.bounds.width >= 800 && s.bounds.height >= 560) {
    const vis = screen.getAllDisplays().some(d => { const b = d.workArea; return s.bounds.x < b.x + b.width - 50 && s.bounds.x + s.bounds.width > b.x + 50 && s.bounds.y >= b.y - 10 && s.bounds.y < b.y + b.height - 50; });
    if (vis) Object.assign(o, s.bounds);
  }
  return { o, maximized: !!s.maximized };
}

function createWindow() {
  const { o, maximized } = windowOptions();
  win = new BrowserWindow(Object.assign(o, {
    minWidth: 800, minHeight: 560,
    show: false,
    title: 'Kivo',
    backgroundColor: '#F5F7FA',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      navigateOnDragDrop: false,
      devTools: !app.isPackaged || process.env.KIVO_DEVTOOLS === '1'
    }
  }));
  if (maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  const wc = win.webContents;
  // Navegação restrita à própria aplicação; links externos nunca abrem dentro da janela.
  wc.on('will-navigate', (e, url) => { if (!url.startsWith(ENTRY)) e.preventDefault(); });
  wc.on('will-redirect', (e, url) => { if (!url.startsWith(ORIGIN + '/')) e.preventDefault(); });
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-attach-webview', e => e.preventDefault());
  wc.on('page-title-updated', e => e.preventDefault());
  wc.on('render-process-gone', async (_e, d) => {
    if (d.reason === 'clean-exit') return;
    const r = await dialog.showMessageBox({ type: 'error', title: 'Kivo', buttons: ['Recarregar', 'Fechar'], defaultId: 0, message: 'A janela do Kivo deixou de responder.', detail: 'Os dados gravados até ao último momento estão seguros. Escolhe Recarregar para continuar.' });
    if (r.response === 0 && win && !win.isDestroyed()) win.reload(); else app.quit();
  });
  wc.on('did-fail-load', (_e, code, desc, url) => { if (url && url.startsWith(ORIGIN)) fatal('Não foi possível abrir a aplicação', new Error(desc + ' (' + code + ')')); });

  const saveBounds = () => { if (!win || win.isDestroyed()) return; storage.writeSettings({ window: { bounds: win.isMaximized() || win.isMinimized() ? (storage.readSettings().window || {}).bounds : win.getBounds(), maximized: win.isMaximized() } }); };
  let bt; const later = () => { clearTimeout(bt); bt = setTimeout(saveBounds, 400); };
  win.on('resize', later); win.on('move', later); win.on('maximize', saveBounds); win.on('unmaximize', saveBounds);
  win.on('close', () => { saveBounds(); try { storage.flush(); } catch (e) { /* ignorar */ } });
  win.on('closed', () => { win = null; });

  Menu.setApplicationMenu(buildMenu({ send: a => { if (win && !win.isDestroyed()) win.webContents.send('kivo:menu', a); }, openDataFolder: () => shell.openPath(app.getPath('userData')), openBackupFolder: () => shell.openPath(storage.backupDir), isPackaged: app.isPackaged, version: app.getVersion(), win: () => win, userData: app.getPath('userData') }));
  win.loadURL(ENTRY);
}

function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  // Garantia de funcionamento offline: nenhum pedido sai do computador.
  ses.webRequest.onBeforeRequest((d, cb) => {
    const ok = d.url.startsWith(ORIGIN + '/') || d.url.startsWith('data:') || d.url.startsWith('devtools:') || d.url.startsWith('blob:' + ORIGIN);
    if (!ok) blocked.push(d.url);
    cb({ cancel: !ok });
  });
  ses.on('will-download', e => e.preventDefault());
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { try { storage && storage.flush(); } catch (e) { /* ignorar */ } });
app.on('web-contents-created', (_e, wc) => { wc.on('will-attach-webview', e => e.preventDefault()); wc.setWindowOpenHandler(() => ({ action: 'deny' })); });

// Diagnóstico para testes automáticos (sem efeito no uso normal).
global.kivoDiagnostics = () => ({ blocked: blocked.slice(), userData: app.getPath('userData') });

app.whenReady().then(() => {
  try {
    storage = new Storage(app.getPath('userData'), app.getVersion());
    try { storage.autoBackup(); } catch (e) { /* a cópia automática nunca impede o arranque */ }
    protocol.handle(SCHEME, serve);
    hardenSession();
    registerIpc();
    createWindow();
  } catch (e) {
    fatal('Não foi possível iniciar', e);
    app.quit();
  }
});

module.exports = { parseState, stamp };
