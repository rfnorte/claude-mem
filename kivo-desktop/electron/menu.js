/* Kivo — menus nativos do Windows (PT-PT). */
'use strict';
const { Menu, dialog } = require('electron');

function buildMenu(ctx) {
  const go = (label, view, accelerator) => ({ label, accelerator, click: () => ctx.send('nav:' + view) });
  const template = [
    {
      label: '&Ficheiro',
      submenu: [
        { label: 'Descarregar cópia de segurança…', accelerator: 'CmdOrCtrl+S', click: () => ctx.send('backup') },
        { label: 'Restaurar cópia de segurança…', click: () => ctx.send('restore') },
        { label: 'Exportar para o Duetto…', click: () => ctx.send('duetto') },
        { type: 'separator' },
        { label: 'Abrir pasta de dados', click: () => ctx.openDataFolder() },
        { label: 'Abrir pasta de cópias de segurança', click: () => ctx.openBackupFolder() },
        { type: 'separator' },
        { label: 'Sair', role: 'quit', accelerator: 'Alt+F4' }
      ]
    },
    {
      label: '&Editar',
      submenu: [
        { label: 'Anular', role: 'undo' }, { label: 'Refazer', role: 'redo' }, { type: 'separator' },
        { label: 'Cortar', role: 'cut' }, { label: 'Copiar', role: 'copy' }, { label: 'Colar', role: 'paste' },
        { label: 'Selecionar tudo', role: 'selectAll' }, { type: 'separator' },
        { label: 'Pesquisar…', accelerator: 'CmdOrCtrl+K', click: () => ctx.send('search') }
      ]
    },
    {
      label: '&Ir',
      submenu: [
        go('Início', 'home', 'CmdOrCtrl+1'), go('Revisão', 'review', 'CmdOrCtrl+2'), go('Transações', 'transactions', 'CmdOrCtrl+3'),
        go('Contas a pagar', 'bills', 'CmdOrCtrl+4'), go('Análises', 'insights', 'CmdOrCtrl+5'), go('Orçamento', 'budget', 'CmdOrCtrl+6'),
        go('Objetivos', 'goals', 'CmdOrCtrl+7'), go('Investimentos', 'investments', 'CmdOrCtrl+8'), go('Património líquido', 'networth', 'CmdOrCtrl+9'),
        { type: 'separator' },
        go('Previsão', 'forecast'), go('Dívida', 'debt'), go('Revisão semanal', 'weekly'), go('Contas', 'accounts'),
        go('Importar', 'import'), go('Definições', 'settings', 'CmdOrCtrl+,')
      ]
    },
    {
      label: '&Ver',
      submenu: [
        { label: 'Aumentar zoom', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: 'Reduzir zoom', role: 'zoomOut' },
        { label: 'Tamanho real', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Ecrã inteiro', role: 'togglefullscreen' },
        ...(ctx.isPackaged ? [] : [{ type: 'separator' }, { label: 'Recarregar', role: 'reload' }, { label: 'Ferramentas de programador', role: 'toggleDevTools' }])
      ]
    },
    {
      label: 'Aj&uda',
      submenu: [
        {
          label: 'Onde estão os meus dados?',
          click: () => dialog.showMessageBox(ctx.win(), { type: 'info', title: 'Kivo', message: 'Os teus dados estão guardados neste computador.', detail: 'Pasta de dados:\n' + ctx.userData + '\n\nCópias automáticas: backups\\auto (últimas 10, criadas em cada arranque).\nDesinstalar o Kivo não apaga esta pasta.', buttons: ['Abrir pasta', 'OK'], defaultId: 1 }).then(r => { if (r.response === 0) ctx.openDataFolder(); })
        },
        { type: 'separator' },
        { label: 'Sobre o Kivo', click: () => dialog.showMessageBox(ctx.win(), { type: 'info', title: 'Sobre o Kivo', message: 'Kivo ' + ctx.version, detail: 'Finanças pessoais, totalmente offline.\nTodos os dados ficam neste computador.' }) }
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
