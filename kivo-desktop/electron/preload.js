/* Kivo — preload (contextIsolation: true, sandbox: true).
 * Expõe à página uma API mínima e fechada. Nenhuma API Node.js é exposta; o ipcRenderer não sai daqui. */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const str = v => (typeof v === 'string' ? v : '');
const MENU_ACTIONS = /^(backup|duetto|restore|search|nav:[a-z]+)$/;

contextBridge.exposeInMainWorld('kivoNative', {
  readInitialState: () => ipcRenderer.sendSync('kivo:state:read-initial'),
  writeState: s => ipcRenderer.send('kivo:state:write', str(s)),
  clearState: () => ipcRenderer.send('kivo:state:clear'),
  exportBackup: state => ipcRenderer.invoke('kivo:backup:export', str(state)),
  exportDuetto: json => ipcRenderer.invoke('kivo:duetto:export', str(json)),
  inspectBackup: text => ipcRenderer.invoke('kivo:backup:inspect', str(text)),
  restoreBackup: (text, current) => ipcRenderer.invoke('kivo:backup:restore', str(text), str(current)),
  onMenu: cb => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('kivo:menu', (_e, action) => { if (typeof action === 'string' && MENU_ACTIONS.test(action)) cb(action); });
  }
});
