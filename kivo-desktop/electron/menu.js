/* Kivo — menus nativos (PT-PT). Windows: Ficheiro/Editar/Ir/Ver/Ajuda. macOS: acrescenta o menu da aplicação (Sobre, Ocultar, Sair ⌘Q). */
'use strict';
const { Menu, dialog } = require('electron');

function buildMenu(ctx) {
  const mac = process.platform === 'darwin';
  const L = s => (mac ? s.replace('&', '') : s); // mnemónicas (&) só fazem sentido em Windows
  const go = (label, view, accelerator) => ({ label, accelerator, click: () => ctx.send('nav:' + view) });
  const about = () => dialog.showMessageBox(ctx.win(), { type: 'info', title: 'Sobre o Kivo', message: 'Kivo ' + ctx.version, detail: 'Finanças pessoais, totalmente offline.\nTodos os dados ficam neste computador.' });
  const appMenu = {
    label: 'Kivo',
    submenu: [
      { label: 'Sobre o Kivo', click: about },
      { type: 'separator' },
      { label: 'Definições…', accelerator: 'Cmd+,', click: () => ctx.send('nav:settings') },
      { type: 'separator' },
      { label: 'Ocultar Kivo', role: 'hide' }, { label: 'Ocultar outras', role: 'hideOthers' }, { label: 'Mostrar tudo', role: 'unhide' },
      { type: 'separator' },
      { label: 'Sair do Kivo', role: 'quit' }
    ]
  };
  const template = [
    ...(mac ? [appMenu] : []),
    {
      label: L('&Ficheiro'),
      submenu: [
        { label: 'Descarregar cópia de segurança…', accelerator: 'CmdOrCtrl+S', click: () => ctx.send('backup') },
        { label: 'Restaurar cópia de segurança…', click: () => ctx.send('restore') },
        { label: 'Exportar para o Duetto…', click: () => ctx.send('duetto') },
        { type: 'separator' },
        { label: 'Abrir pasta de dados', click: () => ctx.openDataFolder() },
        { label: 'Abrir pasta de cópias de segurança', click: () => ctx.openBackupFolder() },
        ...(mac ? [{ type: 'separator' }, { label: 'Fechar janela', role: 'close' }] : [{ type: 'separator' }, { label: 'Sair', role: 'quit', accelerator: 'Alt+F4' }])
      ]
    },
    {
      label: L('&Editar'),
      submenu: [
        { label: 'Anular', role: 'undo' }, { label: 'Refazer', role: 'redo' }, { type: 'separator' },
        { label: 'Cortar', role: 'cut' }, { label: 'Copiar', role: 'copy' }, { label: 'Colar', role: 'paste' },
        { label: 'Selecionar tudo', role: 'selectAll' }, { type: 'separator' },
        { label: 'Pesquisar…', accelerator: 'CmdOrCtrl+K', click: () => ctx.send('search') }
      ]
    },
    {
      label: L('&Ir'),
      submenu: [
        go('Início', 'home', 'CmdOrCtrl+1'), go('Revisão', 'review', 'CmdOrCtrl+2'), go('Transações', 'transactions', 'CmdOrCtrl+3'),
        go('Contas a pagar', 'bills', 'CmdOrCtrl+4'), go('Análises', 'insights', 'CmdOrCtrl+5'), go('Orçamento', 'budget', 'CmdOrCtrl+6'),
        go('Objetivos', 'goals', 'CmdOrCtrl+7'), go('Investimentos', 'investments', 'CmdOrCtrl+8'), go('Património líquido', 'networth', 'CmdOrCtrl+9'),
        { type: 'separator' },
        go('Previsão', 'forecast'), go('Dívida', 'debt'), go('Revisão semanal', 'weekly'), go('Contas', 'accounts'),
        go('Importar', 'import'), go('Definições', 'settings', mac ? undefined : 'CmdOrCtrl+,')
      ]
    },
    {
      label: L('&Ver'),
      submenu: [
        { label: 'Aumentar zoom', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: 'Reduzir zoom', role: 'zoomOut' },
        { label: 'Tamanho real', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Ecrã inteiro', role: 'togglefullscreen' },
        ...(ctx.isPackaged ? [] : [{ type: 'separator' }, { label: 'Recarregar', role: 'reload' }, { label: 'Ferramentas de programador', role: 'toggleDevTools' }])
      ]
    },
    ...(mac ? [{ label: 'Janela', role: 'windowMenu' }] : []),
    {
      label: L('Aj&uda'),
      submenu: [
        {
          label: 'Onde estão os meus dados?',
          click: () => dialog.showMessageBox(ctx.win(), { type: 'info', title: 'Kivo', message: 'Os teus dados estão guardados neste computador.', detail: 'Pasta de dados:\n' + ctx.userData + '\n\nCópias automáticas: ' + require('path').join('backups', 'auto') + ' (últimas 10, criadas em cada arranque).\n' + (mac ? 'Apagar a aplicação não apaga esta pasta.' : 'Desinstalar o Kivo não apaga esta pasta.'), buttons: ['Abrir pasta', 'OK'], defaultId: 1 }).then(r => { if (r.response === 0) ctx.openDataFolder(); })
        },
        ...(mac ? [] : [{ type: 'separator' }, { label: 'Sobre o Kivo', click: about }])
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
