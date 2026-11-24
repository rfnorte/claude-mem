/* Kivo desktop — ponte entre a aplicação (localStorage) e o armazenamento persistente do Electron.
 *
 * Carregado ANTES de kivo-v3.js. Não altera o comportamento da aplicação:
 *  1. No arranque, se o localStorage não tiver dados mas existir uma cópia em disco (userData/data/kivo-state.json),
 *     repõe-a antes de a aplicação ler o estado.
 *  2. Cada gravação da chave "kivo:v3" é espelhada para disco pelo processo principal (escrita atómica + .bak).
 *  3. "Repor dados de exemplo" (removeItem) é também espelhado (o ficheiro anterior é guardado, não apagado).
 *
 * No browser (sem Electron) não faz nada.
 */
(function () {
  'use strict';
  var N = window.kivoNative;
  if (!N) return;
  var KEY = 'kivo:v3';
  var proto = Storage.prototype, origSet = proto.setItem, origRemove = proto.removeItem;
  var locked = false;

  // 1) Recuperação a partir do disco, antes de a aplicação ler o estado.
  try {
    var disk = N.readInitialState();
    var local = localStorage.getItem(KEY);
    if (local == null && typeof disk === 'string') origSet.call(localStorage, KEY, disk);
    else if (local != null && local !== disk) N.writeState(local);
  } catch (e) { /* o arranque continua com o que existir no localStorage */ }

  // 2) Espelho das gravações.
  proto.setItem = function (k, v) {
    if (this === window.localStorage && k === KEY) {
      if (locked) return;
      origSet.call(this, k, v);
      N.writeState(String(v));
      return;
    }
    return origSet.apply(this, arguments);
  };
  proto.removeItem = function (k) {
    if (this === window.localStorage && k === KEY) {
      if (locked) return;
      origRemove.call(this, k);
      N.clearState();
      return;
    }
    return origRemove.apply(this, arguments);
  };

  // API usada pela interface (kivo-ui.js).
  window.kivoDesktop = Object.freeze({
    isDesktop: true,
    exportBackup: N.exportBackup,
    exportDuetto: N.exportDuetto,
    inspectBackup: N.inspectBackup,
    restoreBackup: N.restoreBackup,
    onMenu: N.onMenu,
    // Substitui o estado pelo restaurado e bloqueia gravações pendentes da sessão atual até recarregar.
    applyRestoredState: function (state) {
      origSet.call(localStorage, KEY, state);
      N.writeState(state);
      locked = true;
    }
  });
})();
