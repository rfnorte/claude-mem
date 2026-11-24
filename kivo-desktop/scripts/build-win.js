/* Compila o instalador NSIS e a versão portátil para Windows.
 *
 * Em Windows: equivalente a `electron-builder --win nsis portable --x64`.
 * Em Linux/macOS: o electron-builder precisa de executar o instalador em Wine para extrair o desinstalador.
 * Onde o Wine não funciona, usa-se o extrator nativo do próprio electron-builder (UninstallerReader),
 * o mesmo caminho que ele usa no macOS Catalina+. O resultado é idêntico.
 */
'use strict';
const builder = require('electron-builder');

if (process.platform !== 'win32' && process.env.KIVO_USE_WINE !== '1') {
  const mv = require('app-builder-lib/out/util/macosVersion');
  mv.isMacOsCatalina = () => true;
}

builder.build({ win: ['nsis:x64', 'portable:x64'] })
  .then(files => { console.log('\nFicheiros gerados:\n' + files.map(f => '  ' + f).join('\n')); })
  .catch(e => { console.error(e); process.exit(1); });
