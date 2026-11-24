/* Kivo v3 — interface (navegação, diálogos, revisão, importação, definições).
   Extraído sem alterações funcionais do <script> inline de "Kivo v3.html" para permitir uma CSP sem 'unsafe-inline'.
   Alterações desktop assinaladas com "[desktop]". */
(function () {
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function eur(v) { var p = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '−' : '') + '€ ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + p[1]; }
  function parseEur(s) { s = String(s || '').replace(/[^\d,.]/g, ''); if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? null : n; }
  function fmtDate(iso) { var d = iso.split('-'); return d[2] + ' ' + MESES[+d[1] - 1] + ' ' + d[0]; }
  function fill(tpl, map) { var node = $(tpl).content.firstElementChild.cloneNode(true); Object.keys(map).forEach(function (k) { var el = $('[data-f="' + k + '"]', node); if (el) el.textContent = map[k]; }); return node; }
  function setErr(input, errId, bad) { $('#' + errId).hidden = !bad; if (bad) { input.setAttribute('aria-invalid', 'true'); input.focus(); } else input.removeAttribute('aria-invalid'); return bad; }

  /* Aviso */
  var toastEl = $('#toast'), toastT;
  function toast(msg) { $('[data-toast-msg]', toastEl).textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, 4500); }

  /* Rotas */
  var views = $$('.view'), navs = $$('[data-nav]');
  function show() {
    var key = (location.hash || '#home').slice(1);
    if (!$('.view[data-view="' + key + '"]')) key = 'home';
    views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== key; });
    navs.forEach(function (n) { if (n.getAttribute('data-nav') === key) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
    document.body.classList.remove('menu-open');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', show);
  show();

  /* Diálogos */
  function openDialog(id, opener) { var d = $('#' + id); d._opener = opener; $$('.err', d).forEach(function (e) { e.hidden = true; }); $$('[aria-invalid]', d).forEach(function (e) { e.removeAttribute('aria-invalid'); }); d.showModal(); var f = $('input:not([type=hidden]), select', d); if (f) f.focus(); }
  $$('dialog').forEach(function (d) { d.addEventListener('close', function () { if (d._opener && document.contains(d._opener)) d._opener.focus(); }); });

  /* Revisão */
  var items = $$('[data-rv-item]'), cur = 0, hist = [], pending = 12;
  var picker = $('#picker'), pickerBtn = $('[data-picker-open]');
  function setPicker(open) { picker.hidden = !open; pickerBtn.setAttribute('aria-expanded', String(open)); if (open) { $('#pick-q').value = ''; filterPicks(); $('#pick-q').focus(); } }
  function rvShow(i) {
    cur = i;
    var done = i >= items.length;
    items.forEach(function (it, k) { it.hidden = k !== i; });
    $('[data-rv-done]').hidden = !done;
    $('[data-rv-actions]').hidden = done;
    setPicker(false);
    $('#rv-always').checked = false;
    if (!done) $('[data-rv-merchant]').textContent = items[i].getAttribute('data-merchant');
    $('[data-rv-pos]').textContent = Math.min(i + 1, 12);
    $('[data-rv-bar]').style.width = Math.max(2, (12 - pending) / 12 * 100) + '%';
    var nc = $('.nav-count'); nc.textContent = pending; nc.setAttribute('aria-label', pending + ' pendentes'); nc.hidden = pending === 0;
    if (window.KV) KV.saveReview(cur, pending);
    updateSteps();
  }
  function rvCategorize(label, parts) {
    if (cur >= items.length) return;
    var m = items[cur].getAttribute('data-merchant'), always = $('#rv-always').checked;
    if (window.KV) KV.categorize(m, label, always, parts);
    hist.push({ i: cur, cat: true }); pending--;
    toast(m + ': ' + label + '.' + (always ? ' Regra criada para as próximas.' : ''));
    rvShow(cur + 1);
  }
  function rvLater() { if (cur >= items.length) return; hist.push({ i: cur, cat: false }); toast('Fica para mais tarde.'); rvShow(cur + 1); }
  function rvUndo() { if (!hist.length) { toast('Não há nada para desfazer.'); return; } var x = hist.pop(); if (x.cat) { pending++; if (window.KV) KV.uncategorize(items[x.i].getAttribute('data-merchant')); } rvShow(x.i); toast('Desfeito.'); }
  function filterPicks() {
    var q = $('#pick-q').value.trim().toLowerCase();
    $$('.picker > div').forEach(function (g) {
      var any = false;
      $$('.pick', g).forEach(function (p) { var ok = !q || p.textContent.toLowerCase().indexOf(q) > -1 || $('h3', g).textContent.toLowerCase().indexOf(q) > -1; p.hidden = !ok; if (ok) any = true; });
      g.hidden = !any;
    });
  }
  $('#pick-q').addEventListener('input', filterPicks);
  function rvOpenSplit(opener) { var it = items[cur]; if (!it) return; var f = $('#split-dialog form'); f.reset(); $('[data-split-total]').textContent = eur(-parseFloat(it.getAttribute('data-amount'))); openDialog('split-dialog', opener); }
  function rvOpenRename(opener) { var it = items[cur]; if (!it) return; $('#rename-nome').value = it.getAttribute('data-merchant'); openDialog('rename-dialog', opener); }
  function openBill(opener, name, value) { var f = $('#bill-dialog form'); f.reset(); f._editId = null; if (window.KV) KV.billMode(false); f.elements.nome.value = name || ''; f.elements.valor.value = value ? eur(value) : ''; openDialog('bill-dialog', opener); }

  /* Revisão semanal */
  function setStep(name, done) {
    var s = $('[data-step="' + name + '"]'); if (!s) return;
    s.setAttribute('stroke', done ? 'var(--pos)' : 'var(--warn)');
    s.setAttribute('aria-label', done ? 'Feito' : 'Por fazer');
    s.innerHTML = done ? '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>' : '<circle cx="12" cy="12" r="10"/>';
    return done;
  }
  function updateSteps() {
    var n = 1;
    if (setStep('review', cur >= items.length)) n++;
    if (setStep('bills', $$('[data-week-bill]').every(function (c) { return c.checked; }))) n++;
    if (setStep('alerts', !$('[data-view="weekly"] .alert-warn'))) n++;
    $('[data-steps]').textContent = n;
  }

  /* Dívida: simulação */
  function sim() {
    var input = $('#extra'), x = parseEur(input.value) || 0, P = 6842.15, r = 0.079 / 12, A = 214.30 + x;
    var n = -Math.log(1 - r * P / A) / Math.log(1 + r), N = Math.ceil(n - 1e-9), m = 10 + N - 1;
    var interest = n * A - P, base = parseFloat(input.getAttribute('data-base-interest'));
    $('[data-sim-end]').textContent = MESES[m % 12] + ' ' + (2026 + Math.floor(m / 12));
    $('[data-sim-sooner]').textContent = 36 - N;
    $('[data-sim-sooner-wrap]').hidden = 36 - N <= 0;
    $('[data-sim-same]').hidden = 36 - N > 0;
    $('[data-sim-save]').textContent = eur(Math.max(0, base - interest));
    $('[data-sim-total]').textContent = eur(interest);
  }
  $('#extra').addEventListener('input', sim);

  /* Importar */
  var FORMATS = { bank: ['pdf', 'xlsx', 'csv', 'ofx'], xtb: ['xlsx', 'xls'] };
  function setPending(delta) { pending = Math.max(0, pending + delta); if (window.KV) KV.saveReview(cur, pending); var nc = $('.nav-count'); nc.textContent = pending; nc.setAttribute('aria-label', pending + ' pendentes'); nc.hidden = pending === 0; }
  window.KVmain = { setPending: setPending, resetReview: function () { hist = []; pending = 12; rvShow(0); } };
  function showImp(kind) { $$('[data-imp]').forEach(function (a) { a.hidden = a.getAttribute('data-imp') !== kind; }); return $('[data-imp="' + kind + '"]'); }
  function runImport(kind, file) {
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (FORMATS[kind].indexOf(ext) < 0) {
      var er = showImp('error'); $('[data-imp-file]', er).textContent = file.name;
      $('[data-imp-formats]', er).textContent = FORMATS[kind].map(function (x) { return '.' + x; }).join(', ');
      return;
    }
    var dup = $$('#imp-list [data-f="file"], #imp-list .row.imp .ellipsis').some(function (s) { return s.textContent === file.name; });
    var acc = kind === 'bank' ? $('#conta').value : $('#xtb').value;
    if (kind === 'bank') { $('#dz').hidden = true; $('#dz-reading').hidden = false; $('[data-reading-file]').textContent = file.name; }
    else { var b = $('#xtb-btn'); b.disabled = true; b.children[0].hidden = true; b.children[1].hidden = false; }
    setTimeout(function () {
      if (kind === 'bank') { $('#dz').hidden = false; $('#dz-reading').hidden = true; }
      else { var b = $('#xtb-btn'); b.disabled = false; b.children[0].hidden = false; b.children[1].hidden = true; }
      if (dup) { var d = showImp('dup'); $('[data-imp-file]', d).textContent = file.name; return; }
      var n = kind === 'bank' ? 41 : 3, pend = kind === 'bank' ? 9 : 0;
      var a = showImp(kind);
      $('[data-imp-file]', a).textContent = file.name;
      $('[data-imp-n]', a).textContent = n;
      if (kind === 'bank') { $('[data-imp-acc]', a).textContent = acc; $('[data-imp-pend]', a).textContent = pend; }
      var row = fill('#tpl-import', { file: file.name, acc: acc, n: n });
      row.setAttribute('data-n', n); row.setAttribute('data-pend', pend);
      $('#imp-list .row-head').after(row);
      a._row = row;
      setPending(pend);
      if (window.KV) KV.onImport(kind, file.name);
    }, 1200);
  }
  var restoreFile = null, restoreText = null;
  var DESK = window.kivoDesktop || null; /* [desktop] API segura exposta pelo preload do Electron (ausente no browser) */
  function showRestore(kind, name, reason) {
    $$('[data-restore]').forEach(function (a) { a.hidden = a.getAttribute('data-restore') !== kind; });
    if (kind) $('[data-restore="' + kind + '"] [data-restore-file]').textContent = name;
    var r = $('[data-restore-reason]'); if (r) r.textContent = kind === 'error' && reason ? reason + ' ' : '';
  }
  function restoreBusy(on) { var b = $('#restore-btn'); b.disabled = on; b.children[0].hidden = on; b.children[1].hidden = !on; }
  $('#file-backup').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    if (!/\.(kivo|json)$/i.test(f.name)) { showRestore('error', f.name); return; }
    if (!DESK) { restoreFile = f; restoreText = null; showRestore(null); $('#restore-dialog [data-restore-file]').textContent = f.name; openDialog('restore-dialog', $('#restore-btn')); return; }
    if (f.size > 50 * 1024 * 1024) { showRestore('error', f.name, 'O ficheiro é demasiado grande.'); return; }
    f.text().then(function (txt) {
      return DESK.inspectBackup(txt).then(function (r) {
        if (!r.ok) { showRestore('error', f.name, r.error); return; }
        restoreFile = f; restoreText = txt; showRestore(null);
        $('#restore-dialog [data-restore-file]').textContent = f.name;
        openDialog('restore-dialog', $('#restore-btn'));
      });
    }).catch(function () { showRestore('error', f.name, 'Não foi possível ler o ficheiro.'); });
  });
  $('[data-restore-confirm]').addEventListener('click', function () {
    $('#restore-dialog').close();
    restoreBusy(true);
    if (!DESK) { setTimeout(function () { restoreBusy(false); showRestore('ok', restoreFile.name); }, 1200); return; }
    var current = window.KV && KV.snapshot ? KV.snapshot() : localStorage.getItem('kivo:v3');
    DESK.restoreBackup(restoreText, current).then(function (r) {
      if (!r.ok) { restoreBusy(false); showRestore('error', restoreFile.name, r.error); return; }
      DESK.applyRestoredState(r.state);
      try { sessionStorage.setItem('kivo:restored', JSON.stringify({ file: restoreFile.name, safety: r.safetyName })); } catch (e) { /* sem sessão */ }
      location.hash = '#settings'; location.reload();
    }).catch(function () { restoreBusy(false); showRestore('error', restoreFile.name, 'Ocorreu um erro inesperado.'); });
  });
  /* [desktop] Depois de restaurar, a página é recarregada: mostrar a confirmação original. */
  (function () {
    var info = null;
    try { info = JSON.parse(sessionStorage.getItem('kivo:restored')); sessionStorage.removeItem('kivo:restored'); } catch (e) { info = null; }
    if (!info) return;
    showRestore('ok', info.file);
    var sf = $('[data-restore-safety]'); if (sf && info.safety) sf.textContent = info.safety;
  })();
  /* [desktop] Cópia de segurança e exportação para o Duetto (ficheiros reais, com escolha da pasta de destino). */
  function desktopSave(kind) {
    if (!DESK) { toast('Disponível apenas na aplicação desktop.'); return; }
    var p = kind === 'backup' ? DESK.exportBackup(KV.snapshot()) : DESK.exportDuetto(JSON.stringify(KV.duetto(), null, 2));
    p.then(function (r) {
      if (r.canceled) return;
      if (!r.ok) { toast(r.error || 'Não foi possível guardar o ficheiro.'); return; }
      toast(kind === 'backup' ? 'Cópia de segurança descarregada: ' + r.name : 'Exportação criada: ' + r.name);
    }).catch(function () { toast('Não foi possível guardar o ficheiro.'); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-desktop-backup], [data-desktop-duetto]'); if (!t) return;
    desktopSave(t.hasAttribute('data-desktop-backup') ? 'backup' : 'duetto');
  });
  /* [desktop] Ações do menu nativo */
  if (DESK) DESK.onMenu(function (action) {
    if (action === 'backup') desktopSave('backup');
    else if (action === 'duetto') desktopSave('duetto');
    else if (action === 'restore') { location.hash = '#settings'; setTimeout(function () { $('#file-backup').click(); }, 50); }
    else if (action === 'search') { var c = $('[data-kv-cmdk]'); if (c) c.click(); }
    else if (/^nav:[a-z]+$/.test(action)) location.hash = '#' + action.slice(4);
  });
  $$('input[type=file]:not(#file-backup)').forEach(function (inp) { inp.addEventListener('change', function () { runImport(inp.id === 'file-xtb' ? 'xtb' : 'bank', inp.files[0]); inp.value = ''; }); });
  var dz = $('#dz');
  ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); }); });
  dz.addEventListener('drop', function (e) { runImport('bank', e.dataTransfer.files[0]); });
  function undoImportRow(row) {
    var n = row ? +(row.getAttribute('data-n') || row.children[3].textContent) : 38;
    if (row) { setPending(-(+(row.getAttribute('data-pend') || 0))); row.remove(); }
    toast('Importação desfeita. ' + n + ' transações removidas.');
  }

  $('#wipe-input').addEventListener('input', function () { $('[data-wipe-confirm]').disabled = this.value.trim().toUpperCase() !== 'APAGAR'; });
  /* Cliques */
  var editingRow = null, editingGroup = null, pendingDelete = null, billOrigin = null;
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, a'); if (!t) return;
    if (t.hasAttribute('data-menu-open')) document.body.classList.add('menu-open');
    if (t.hasAttribute('data-menu-close')) document.body.classList.remove('menu-open');
    if (t.hasAttribute('data-toast')) toast(t.getAttribute('data-toast'));
    if (t.hasAttribute('data-toast-close')) toastEl.hidden = true;
    if (t.hasAttribute('data-close')) t.closest('dialog').close();
    if (t.hasAttribute('data-wipe-open')) { $('#wipe-input').value = ''; $('[data-wipe-confirm]').disabled = true; openDialog('wipe-dialog', t); $('#wipe-input').focus(); }
    if (t.hasAttribute('data-wipe-confirm')) {
      $('#wipe-dialog').close();
      $$('[data-imp]').forEach(function (al) { al.hidden = true; al._row = null; });
      hist = []; pending = 0; rvShow(items.length);
      KV.wipe();
      toast('Todos os dados foram apagados.');
    }

    if (t.hasAttribute('data-dismiss')) {
      var txt = $('span', t.closest('.alert')).textContent;
      $$('.alert-warn').forEach(function (a) { if ($('span', a).textContent === txt) a.remove(); });
      $('[data-empty-alerts]').hidden = !!$('[data-view="home"] .alert-warn');
      updateSteps();
    }

    if (t.hasAttribute('data-split-toggle')) {
      var open = t.getAttribute('aria-expanded') !== 'true';
      t.setAttribute('aria-expanded', String(open));
      t.closest('.row').nextElementSibling.hidden = !open;
    }
    if (t.hasAttribute('data-bill-from-tx')) { var row = t.closest('.row'); openBill(t, $('span > span', row.children[1]).textContent.trim(), parseEur(row.children[4].textContent)); billOrigin = null; }

    if (t.hasAttribute('data-picker-open')) setPicker(picker.hidden);
    if (t.hasAttribute('data-picker-close')) { setPicker(false); pickerBtn.focus(); }
    if (t.hasAttribute('data-rv-pick')) rvCategorize(t.getAttribute('data-rv-pick'));
    if (t.classList.contains('pick')) rvCategorize(t.textContent);
    if (t.hasAttribute('data-rv-later')) rvLater();
    if (t.hasAttribute('data-rv-undo')) rvUndo();
    if (t.hasAttribute('data-rv-transfer')) rvCategorize('Entre contas minhas');
    if (t.hasAttribute('data-rv-split')) rvOpenSplit(t);
    if (t.hasAttribute('data-rv-rename')) rvOpenRename(t);
    if (t.hasAttribute('data-rv-bill') && items[cur]) { openBill(t, items[cur].getAttribute('data-merchant'), parseFloat(items[cur].getAttribute('data-amount'))); }

    if (t.hasAttribute('data-file')) $('#' + t.getAttribute('data-file')).click();
    if (t.hasAttribute('data-undo-import')) {
      var al = t.closest('.alert'); al.hidden = true;
      var r0 = al._row || (al.getAttribute('data-imp') === 'bank' ? $('#imp-list .row.imp:not(.row-head)') : null);
      undoImportRow(r0); al._row = null;
    }
    if (t.hasAttribute('data-undo-row')) {
      var rr = t.closest('.row');
      $$('[data-imp]').forEach(function (a) { if (a._row === rr || (!a._row && a.getAttribute('data-imp') === 'bank' && rr === $('#imp-list .row.imp:not(.row-head)'))) a.hidden = true; });
      undoImportRow(rr);
    }

    if (t.classList.contains('swatch')) $$('.swatch').forEach(function (o) { o.setAttribute('aria-pressed', String(o === t)); });
    if (t.hasAttribute('data-edit-account')) {
      editingRow = t.closest('.row');
      var f = $('#acc-dialog form'), name = $('.hl', editingRow).textContent, cap = $('.hl', editingRow).nextElementSibling.textContent, sal = editingRow.children[3];
      f.reset(); f.elements.nome.value = name;
      var tipo = cap.split(' · ')[0]; if ($$('option', f.elements.tipo).some(function (o) { return o.textContent === tipo; })) f.elements.tipo.value = tipo;
      f.elements.saldo.value = sal.classList.contains('tnum') ? sal.textContent.replace('−', '') : '';
      openDialog('acc-dialog', t);
    }
    if (t.hasAttribute('data-delete-account')) {
      pendingDelete = t.closest('.row');
      var dlg = $('#del-dialog');
      $('[data-del-name]', dlg).textContent = $('.hl', pendingDelete).textContent;
      $('[data-del-count]', dlg).textContent = pendingDelete.children[2].textContent;
      dlg._opener = t; dlg.showModal(); $('[data-del-cancel]', dlg).focus();
    }
    if (t.hasAttribute('data-del-cancel')) $('#del-dialog').close();
    if (t.hasAttribute('data-del-confirm') && pendingDelete) {
      var nm = $('.hl', pendingDelete).textContent; pendingDelete.remove(); pendingDelete = null;
      var dlg2 = $('#del-dialog'); dlg2._opener = null; dlg2.close();
      var done = $('#del-done'); $('[data-del-done-name]', done).textContent = nm; done.hidden = false;
    }
    if (t.hasAttribute('data-add-account')) {
      var n = $('#n'); if (setErr(n, 'n-err', !n.value.trim())) return;
      var sw = $('.swatch[aria-pressed="true"]');
      var node = fill('#tpl-account', { name: n.value.trim(), cap: $('#t').value + ' · sem extratos importados' });
      $('[data-f="color"]', node).style.background = sw ? sw.style.background : 'var(--accent)';
      $('[data-edit-account]', node).setAttribute('aria-label', 'Editar ' + n.value.trim());
      var del = $('[data-delete-account]', node); del.setAttribute('aria-label', 'Eliminar ' + n.value.trim()); del.setAttribute('data-delete-account', n.value.trim());
      $('#acc-list').appendChild(node);
      n.value = ''; $('#i').value = ''; $('#del-done').hidden = true;
      toast('Conta adicionada.');
    }

    if (t.hasAttribute('data-open-bill')) { openBill(t); billOrigin = null; }
    if (t.hasAttribute('data-paid-toggle')) {
      var cell = t.parentElement, paid = $('[data-paid]', cell).hidden;
      $('[data-paid]', cell).hidden = !paid;
      t.children[0].hidden = paid; t.children[1].hidden = !paid;
      toast(paid ? 'Marcada como paga.' : 'Pagamento desfeito.');
    }

    if (t.hasAttribute('data-sub-toggle')) {
      var o2 = t.getAttribute('aria-expanded') !== 'true';
      t.setAttribute('aria-expanded', String(o2));
      $('[data-chev]', t).style.transform = o2 ? 'rotate(90deg)' : '';
      $$('tr[data-sub="' + t.getAttribute('data-sub-toggle') + '"]').forEach(function (r) { r.hidden = !o2; });
    }

    if (t.hasAttribute('data-save-payday')) { var d = $('#d'), v = +d.value; if (!setErr(d, 'd-err', !(v >= 1 && v <= 31 && Math.floor(v) === v))) toast('Dia do vencimento guardado.'); }
    if (t.hasAttribute('data-remove-chip')) { var chip = t.closest('.chip'); var nmx = chip.textContent.trim(); chip.remove(); toast('Removido: ' + nmx + '.'); }
    if (t.hasAttribute('data-add-person')) {
      var p = $('#pessoa'), val = p.value.trim(); if (!val) { p.focus(); return; }
      var c = fill('#tpl-person', { name: val }); $('[data-remove-chip]', c).setAttribute('aria-label', 'Remover ' + val);
      $('#people').appendChild(c); p.value = ''; p.focus();
    }
    if (t.hasAttribute('data-edit-group') || t.hasAttribute('data-add-group')) {
      var adding = t.hasAttribute('data-add-group'), gf = $('#grp-dialog form');
      editingGroup = adding ? null : t.closest('.row');
      gf.reset();
      $$('[data-mode]', $('#grp-dialog')).forEach(function (s) { s.hidden = s.getAttribute('data-mode') !== (adding ? 'add' : 'edit'); });
      if (!adding) {
        gf.elements.nome.value = editingGroup.children[0].textContent.trim();
        gf.elements.tipo.value = editingGroup.children[1].textContent.trim();
        gf.elements.subs.value = editingGroup.children[2].textContent.split(' · ').join(', ');
      }
      openDialog('grp-dialog', t);
    }
    if (t.hasAttribute('data-finish-weekly')) { $('[data-weekly-done]').hidden = false; var dot = $('#weekly-dot'); if (dot) dot.remove(); window.scrollTo(0, 0); }
  });

  document.addEventListener('change', function (e) { if (e.target.hasAttribute('data-week-bill')) updateSteps(); });

  /* Formulários */
  function updateGroupCounts() {
    var rows = $$('#groups > .row');
    $('[data-groups-n]').textContent = rows.length;
    $('[data-subs-n]').textContent = rows.reduce(function (s, r) { var x = r.children[2].textContent.trim(); return s + (x ? x.split(' · ').length : 0); }, 0);
  }
  function badgeClass(tipo) { return 'badge' + (tipo === 'Rendimento' ? ' badge-pos' : tipo === 'Poupança' ? ' badge-info' : ''); }
  document.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-form'); if (!kind) return;
    e.preventDefault();
    var dlg = f.closest('dialog');
    if (kind === 'account') {
      var nome = f.elements.nome.value.trim(); if (setErr(f.elements.nome, 'acc-nome-err', !nome)) return;
      var tipo = f.elements.tipo.value, capEl = $('.hl', editingRow).nextElementSibling, rest = capEl.textContent.split(' · ').slice(1).join(' · ');
      $('.hl', editingRow).textContent = nome;
      capEl.textContent = tipo + (rest ? ' · ' + rest : '');
      var sv = parseEur(f.elements.saldo.value), cell = editingRow.children[3];
      if (sv !== null && cell.classList.contains('tnum')) cell.textContent = eur(/Crédito|Cartão/.test(tipo) ? -sv : sv);
      $('[data-edit-account]', editingRow).setAttribute('aria-label', 'Editar ' + nome);
      var del = $('[data-delete-account]', editingRow); del.setAttribute('aria-label', 'Eliminar ' + nome); del.setAttribute('data-delete-account', nome);
      dlg.close(); toast('Alterações guardadas.');
    }
    if (kind === 'bill') {
      var bn = f.elements.nome.value.trim(), bv = parseEur(f.elements.valor.value);
      if (setErr(f.elements.nome, 'bill-nome-err', !bn)) return;
      if (setErr(f.elements.valor, 'bill-valor-err', !(bv > 0))) return;
      dlg.close(); KV.saveBill(f, bn, bv);
    }
    if (kind === 'group') {
      var gn = f.elements.nome.value.trim(); if (setErr(f.elements.nome, 'grp-nome-err', !gn)) return;
      var gt = f.elements.tipo.value, subs = f.elements.subs.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean).join(' · ');
      var row = editingGroup;
      if (!row) { row = fill('#tpl-group', {}); $('#groups').appendChild(row); }
      var nameEl = row.children[0], dotEl = $('.dot', nameEl);
      nameEl.textContent = ''; nameEl.appendChild(dotEl); nameEl.appendChild(document.createTextNode(gn));
      var b = $('.badge', row.children[1]); b.className = badgeClass(gt); b.textContent = gt;
      row.children[2].textContent = subs;
      $('[data-edit-group]', row).setAttribute('aria-label', 'Editar ' + gn);
      updateGroupCounts();
      dlg.close(); toast(editingGroup ? 'Grupo atualizado.' : 'Grupo adicionado.');
    }
    if (kind === 'split') {
      var total = parseFloat(items[cur].getAttribute('data-amount')), v1 = parseEur(f.elements.v1.value) || 0, v2 = parseEur(f.elements.v2.value) || 0;
      var bad = Math.abs(v1 + v2 - total) > 0.005 || v1 <= 0 || v2 <= 0;
      $('#split-err').hidden = !bad; if (bad) { f.elements.v1.focus(); return; }
      dlg._opener = null; dlg.close(); rvCategorize('Divisão · ' + f.elements.c1.value + ' e ' + f.elements.c2.value, [{ cat: f.elements.c1.value, amt: -v1 }, { cat: f.elements.c2.value, amt: -v2 }]);
    }
    if (kind === 'rename') {
      var rn = f.elements.nome.value.trim(); if (setErr(f.elements.nome, 'rename-err', !rn)) return;
      var it = items[cur]; it.setAttribute('data-merchant', rn); $('[data-rv-title]', it).textContent = rn; $('[data-rv-merchant]').textContent = rn;
      dlg.close(); toast('Comerciante renomeado para ' + rn + '.');
    }
  });

  /* Teclado */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!picker.hidden) setPicker(false); document.body.classList.remove('menu-open'); }
    if (location.hash !== '#review' || $('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
    var ae = document.activeElement, typing = /INPUT|SELECT|TEXTAREA/.test(ae.tagName);
    if (typing) return;
    var k = e.key.toLowerCase(), it = items[cur];
    if (k === '/') { e.preventDefault(); setPicker(true); return; }
    if (k === 'z') { rvUndo(); return; }
    if (!it) return;
    var picks = $$('[data-rv-pick]', it);
    if (/^[1-9]$/.test(k) && picks[+k - 1]) { picks[+k - 1].click(); return; }
    if (k === 'enter' && ae.tagName !== 'BUTTON' && ae.tagName !== 'A' && picks[0]) { e.preventDefault(); picks[0].click(); return; }
    if (k === 'arrowright') { rvLater(); return; }
    if (k === 's') { rvOpenSplit($('[data-rv-split]')); return; }
    if (k === 't') { rvCategorize('Entre contas minhas'); return; }
    if (k === 'a') { var cb = $('#rv-always'); cb.checked = !cb.checked; return; }
    if (k === 'b') { openBill($('[data-rv-bill]'), it.getAttribute('data-merchant'), parseFloat(it.getAttribute('data-amount'))); return; }
    if (k === 'n') { rvOpenRename($('[data-rv-rename]')); return; }
  });

  var rs = window.KV ? KV.loadReview() : null;
  if (rs) pending = rs.pending;
  rvShow(rs ? Math.min(rs.cur, items.length) : 0);
})();
