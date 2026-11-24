'use strict';
const { _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');

function tmpUserData(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kivo-test-' + tag + '-'));
}

async function launch(userData, extraEnv) {
  // KIVO_EXECUTABLE: testar a aplicação empacotada (app.asar) em vez do código-fonte.
  const exe = process.env.KIVO_EXECUTABLE;
  const args = exe ? [] : [ROOT];
  if (process.getuid && process.getuid() === 0) args.unshift('--no-sandbox'); // só no contentor de testes (root)
  const app = await electron.launch({ args, executablePath: exe || undefined, env: Object.assign({}, process.env, { KIVO_USER_DATA: userData }, extraEnv || {}) });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!window.KV);
  return { app, page };
}

/** Substitui os diálogos nativos de ficheiro (não automatizáveis) por respostas fixas. */
async function stubSaveDialog(app, filePath) {
  await app.evaluate(({ dialog }, fp) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: fp }); }, filePath);
}

module.exports = { launch, tmpUserData, stubSaveDialog, ROOT };
