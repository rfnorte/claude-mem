/* Kivo — armazenamento persistente no processo principal.
 *
 * Localização (Windows): %APPDATA%\Kivo\
 *   data\kivo-state.json          espelho do estado da aplicação (escrita atómica)
 *   data\kivo-state.json.bak      versão anterior (recuperação se o ficheiro principal estiver corrompido)
 *   backups\auto\                 cópias automáticas no arranque (últimas 10)
 *   backups\                      cópias "antes de restaurar"
 *   settings.json                 definições da janela e últimas pastas usadas
 * O localStorage do Electron (Local Storage\) continua a ser a fonte primária usada pela aplicação.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 50 * 1024 * 1024;
const BACKUP_FORMAT = 'kivo-backup';
const BACKUP_VERSION = 1;
const AUTO_KEEP = 10;

class StorageError extends Error {}

function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
const sha256 = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** Valida o estado da aplicação (string JSON). Devolve o objeto ou lança StorageError com mensagem para o utilizador. */
function parseState(str) {
  if (typeof str !== 'string' || !str.length) throw new StorageError('O ficheiro não contém dados.');
  if (Buffer.byteLength(str, 'utf8') > MAX_BYTES) throw new StorageError('O ficheiro é demasiado grande.');
  let o;
  try { o = JSON.parse(str); } catch (e) { throw new StorageError('O ficheiro está danificado ou não é uma cópia do Kivo.'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new StorageError('O ficheiro não é uma cópia do Kivo.');
  if (o.v !== 1) throw new StorageError('A cópia foi criada por uma versão do Kivo que esta aplicação não reconhece.');
  for (const k of ['tx', 'bills', 'rules']) if (!Array.isArray(o[k])) throw new StorageError('A cópia está incompleta (faltam ' + k + ').');
  if (o.snaps != null && (typeof o.snaps !== 'object' || Array.isArray(o.snaps))) throw new StorageError('A cópia está danificada.');
  for (const t of o.tx) if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.amount !== 'number') throw new StorageError('A cópia contém transações inválidas.');
  return o;
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, content, null, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

class Storage {
  constructor(userData, appVersion) {
    this.root = userData;
    this.appVersion = appVersion;
    this.dataDir = path.join(userData, 'data');
    this.stateFile = path.join(this.dataDir, 'kivo-state.json');
    this.backupDir = path.join(userData, 'backups');
    this.autoDir = path.join(this.backupDir, 'auto');
    this.settingsFile = path.join(userData, 'settings.json');
    this.pending = null;
    this.timer = null;
    this.lastWritten = null;
    for (const d of [this.dataDir, this.backupDir, this.autoDir]) fs.mkdirSync(d, { recursive: true });
  }

  /* ---------- estado ---------- */
  readState() {
    for (const f of [this.stateFile, this.stateFile + '.bak']) {
      try { const s = fs.readFileSync(f, 'utf8'); parseState(s); return s; } catch (e) { /* tenta o seguinte */ }
    }
    return null;
  }
  queueWrite(str) {
    try { parseState(str); } catch (e) { return false; } // nunca grava estado inválido
    this.pending = str;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
    return true;
  }
  flush() {
    clearTimeout(this.timer); this.timer = null;
    const s = this.pending; this.pending = null;
    if (s == null || s === this.lastWritten) return;
    if (fs.existsSync(this.stateFile)) fs.copyFileSync(this.stateFile, this.stateFile + '.bak');
    writeAtomic(this.stateFile, s);
    this.lastWritten = s;
  }
  clearState() {
    this.pending = null; clearTimeout(this.timer);
    const tag = stamp();
    if (fs.existsSync(this.stateFile)) fs.renameSync(this.stateFile, path.join(this.dataDir, 'kivo-state.removido-' + tag + '.json'));
    if (fs.existsSync(this.stateFile + '.bak')) fs.renameSync(this.stateFile + '.bak', path.join(this.dataDir, 'kivo-state.removido-' + tag + '.json.bak'));
    this.lastWritten = null;
  }

  /* ---------- cópias de segurança ---------- */
  makeBackup(stateStr) {
    const o = parseState(stateStr);
    return JSON.stringify({
      formato: BACKUP_FORMAT, versao: BACKUP_VERSION, aplicacao: 'Kivo', versaoApp: this.appVersion,
      criadoEm: new Date().toISOString(),
      resumo: { transacoes: o.tx.length, contasAPagar: o.bills.length, regras: o.rules.length },
      sha256: sha256(stateStr),
      dados: stateStr
    }, null, 1);
  }
  /** Valida um ficheiro de cópia de segurança. Devolve { state, meta }. */
  inspectBackup(text) {
    if (typeof text !== 'string' || !text.length) throw new StorageError('O ficheiro está vazio.');
    if (Buffer.byteLength(text, 'utf8') > MAX_BYTES * 1.2) throw new StorageError('O ficheiro é demasiado grande.');
    let env;
    try { env = JSON.parse(text); } catch (e) { throw new StorageError('O ficheiro está danificado ou não é uma cópia do Kivo.'); }
    if (!env || env.formato !== BACKUP_FORMAT) throw new StorageError('O ficheiro não é uma cópia de segurança do Kivo.');
    if (typeof env.versao !== 'number' || env.versao > BACKUP_VERSION) throw new StorageError('A cópia foi criada por uma versão mais recente do Kivo.');
    if (typeof env.dados !== 'string' || sha256(env.dados) !== env.sha256) throw new StorageError('A cópia está danificada (a verificação de integridade falhou).');
    const o = parseState(env.dados);
    return { state: env.dados, meta: { criadoEm: env.criadoEm, transacoes: o.tx.length } };
  }
  autoBackup() {
    const s = this.readState();
    if (!s) return null;
    const f = path.join(this.autoDir, 'kivo-auto-' + stamp() + '.kivo');
    writeAtomic(f, this.makeBackup(s));
    const all = fs.readdirSync(this.autoDir).filter(n => /^kivo-auto-.*\.kivo$/.test(n)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - AUTO_KEEP))) fs.unlinkSync(path.join(this.autoDir, old));
    return f;
  }
  safetyBackup(currentStr) {
    try { parseState(currentStr); } catch (e) { currentStr = this.readState(); }
    if (!currentStr) return null;
    const f = path.join(this.backupDir, 'kivo-antes-de-restaurar-' + stamp() + '.kivo');
    writeAtomic(f, this.makeBackup(currentStr));
    return f;
  }

  /* ---------- definições ---------- */
  readSettings() {
    try { const o = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  writeSettings(patch) {
    const s = Object.assign(this.readSettings(), patch);
    try { writeAtomic(this.settingsFile, JSON.stringify(s, null, 2)); } catch (e) { /* definições não críticas */ }
    return s;
  }
}

module.exports = { Storage, StorageError, parseState, writeAtomic, stamp, MAX_BYTES };
