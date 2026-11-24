/* Kivo v3: dados, persistência local, transações, contas a pagar, regras, análises, investimentos e pesquisa global. */
(function () {
  'use strict';
  var KEY = 'kivo:v3';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const TODAY = '2026-10-05', DATA_START = '2026-08-01', DATA_END = '2026-10-02';
  const eur = v => { const p = Math.abs(v).toFixed(2).split('.'); return (v < -0.004 ? '−' : '') + '€ ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + p[1]; };
  const num = v => String(Math.round(v * 1000) / 1000).replace('.', ',');
  const pct = (v, d) => (v * 100).toFixed(d == null ? 1 : d).replace('.', ',') + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtD = iso => { const d = iso.split('-'); return d[2] + ' ' + MESES[+d[1] - 1] + ' ' + d[0]; };
  const fmtS = iso => { const d = iso.split('-'); return d[2] + ' ' + MESES[+d[1] - 1]; };
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
  const lastDay = ym => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
  const ymLabel = ym => MESES_L[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
  const prevYm = ym => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; if (m === 0) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');

  const I = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const PEN = I('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>');
  const TRASH = I('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>');
  const CAL = I('<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>');
  const CHECK = I('<path d="M20 6 9 17l-5-5"/>');
  const CHEV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-chev><path d="m9 18 6-6-6-6"/></svg>';
  const NOTE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Tem nota"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13h4"/><path d="M10 17h4"/></svg>';
  const XFER = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Transferência entre contas"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>';
  const ACC_COLOR = { 'ActivoBank': 'var(--accent)', 'XTB': 'var(--pos)', 'Conta conjunta': 'var(--warnfill)' };

  const toastEl = $('#toast'); let toastT;
  function toast(m) { $('[data-toast-msg]', toastEl).textContent = m; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 4500); }
  function openDlg(id, opener) {
    const d = $('#' + id); d._opener = opener || document.activeElement;
    $$('.err', d).forEach(e => { e.hidden = true; }); $$('[aria-invalid]', d).forEach(e => e.removeAttribute('aria-invalid'));
    if (!d.open) d.showModal();
    const f = $('input:not([type=hidden]):not([type=checkbox]), select', d); if (f) f.focus();
    return d;
  }
  function setErr(input, id, bad) { $('#' + id).hidden = !bad; if (bad) { input.setAttribute('aria-invalid', 'true'); input.focus(); } else input.removeAttribute('aria-invalid'); return bad; }
  const go = k => { if (location.hash !== '#' + k) location.hash = '#' + k; };
  const later = fn => setTimeout(fn, 60);
  const pend = d => { if (d && window.KVmain) window.KVmain.setPending(d); };

  /* Categorias (lidas das Definições, para refletir grupos editados) */
  const TYPE = { 'Rendimento': 'income', 'Fixa': 'fixed', 'Variável': 'variable', 'Poupança': 'savings', 'Fora das contas': 'out' };
  function cats() {
    return $$('#groups > .row').map(r => {
      const dot = $('.dot', r), m = ((dot && dot.getAttribute('style')) || '').match(/--cat-([\w-]+)/), name = r.children[0].textContent.trim();
      return { key: m ? m[1] : slug(name), name, color: m ? 'var(--cat-' + m[1] + ')' : 'var(--accent)', type: TYPE[r.children[1].textContent.trim()] || 'variable', subs: r.children[2].textContent.split(' · ').map(s => s.trim()).filter(Boolean) };
    });
  }
  function subMap() { const m = {}; cats().forEach(g => g.subs.forEach(s => { if (!m[s]) m[s] = g; })); return m; }
  const NONE = { key: 'none', name: 'Sem categoria', color: 'var(--ink3)', type: 'variable' };
  function catOptions(none) { return (none ? '<option value="">Sem categoria</option>' : '') + cats().map(g => '<optgroup label="' + esc(g.name) + '">' + g.subs.map(s => '<option>' + esc(s) + '</option>').join('') + '</optgroup>').join(''); }
  function updateGroupCounts() {
    const rows = $$('#groups > .row');
    $('[data-groups-n]').textContent = rows.length;
    $('[data-subs-n]').textContent = rows.reduce((s, r) => { const x = r.children[2].textContent.trim(); return s + (x ? x.split(' · ').length : 0); }, 0);
  }

  /* Dados de exemplo */
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function seedTx() {
    const r = rng(7), out = []; let id = 1;
    const add = (date, merchant, desc, cat, amount, o) => out.push(Object.assign({ id: 't' + id++, date, merchant, desc, cat, amount: Math.round(amount * 100) / 100, account: 'ActivoBank', note: '', manual: false }, o || {}));
    const VAR = [
      ['Supermercado', [['Pingo Doce', 'COMPRA PINGO DOCE LOUSADA'], ['Continente', 'COMPRA CONTINENTE MODELO'], ['Lidl', 'COMPRA LIDL PENAFIEL']], 18, 78, 9, 4],
      ['Restaurantes', [['Tasca do Zé', 'COMPRA TASCA DO ZE'], ['Sushi Lousada', 'COMPRA SUSHI LOUSADA'], ['Pizzaria Bella', 'COMPRA PIZZARIA BELLA']], 14, 42, 5, 3],
      ['Café e snacks', [['Pastelaria Doce Vida', 'COMPRA PAST DOCE VIDA']], 1.5, 6.5, 8, 5],
      ['Combustível', [['Galp', 'COMPRA GALP AMARANTE'], ['Repsol', 'COMPRA REPSOL LOUSADA']], 45, 68, 3, 1],
      ['Portagens e Via Verde', [['Via Verde', 'DD VIA VERDE PORTUGAL']], 10, 25, 2, 0],
      ['Entregas ao domicílio', [['Uber Eats', 'COMPRA UBER EATS']], 15, 28, 2, 1],
      ['TVDE e táxi', [['Bolt', 'COMPRA BOLT.EU RIDE']], 6, 14, 2, 1],
      ['Farmácia', [['Farmácia Central', 'COMPRA FARMACIA CENTRAL LOUSADA']], 8, 22, 1, 0],
      ['Roupa e calçado', [['Zara', 'COMPRA ZARA NORTESHOPPING']], 29, 59, 1, 0],
      ['Compras online', [['Amazon', 'COMPRA AMAZON EU SARL']], 15, 50, 1, 1],
      ['Cinema e espetáculos', [['Cinemas NOS', 'COMPRA CINEMAS NOS']], 9, 16, 1, 1],
      ['Higiene e cosmética', [['Wells', 'COMPRA WELLS LOUSADA']], 8, 25, 0, 1]
    ];
    [['2026-08', 0], ['2026-09', 1]].forEach(([ym, k]) => {
      const d = n => ym + '-' + String(n).padStart(2, '0'), L = lastDay(ym);
      add(d(1), 'Vencimento', 'TRF RECEBIDA ENTIDADE EMPREGADORA', 'Vencimento', 2350);
      add(d(3), 'Renda', 'DD RENDA HABITACAO', 'Renda ou prestação', -480);
      add(d(8), 'EDP Comercial', 'DD EDP COMERCIAL', 'Eletricidade', k ? -74.91 : -68.2);
      add(d(10), 'Ginásio Fit', 'DD GINASIO FIT LOUSADA', 'Ginásio e desporto', -100);
      add(d(12), 'Spotify', 'DD SPOTIFY AB', 'Streaming e música', -11.99);
      add(d(15), 'Crédito automóvel', 'DD PRESTACAO CREDITO AUTO', 'Crédito automóvel', -214.3);
      add(d(20), 'Águas do Norte', 'DD AGUAS DO NORTE', 'Água', k ? -18.4 : -21.15);
      add(d(28), 'Vodafone', 'DD VODAFONE PORTUGAL', 'Telecomunicações', -39.99, { bill: true });
      add(d(30), 'XTB', 'TRF PARA XTB', 'Entre contas minhas', -400);
      VAR.forEach(([cat, ms, lo, hi, nA, nS]) => { for (let i = 0; i < (k ? nS : nA); i++) { const m = ms[Math.floor(r() * ms.length)]; add(d(1 + Math.floor(r() * L)), m[0], m[1], cat, -(lo + r() * (hi - lo))); } });
    });
    add('2026-09-26', 'Dividendo AAPL', 'Dividendo · AAPL.US', 'Juros e dividendos', 3.42, { account: 'XTB' });
    add('2026-09-29', 'Galp', 'COMPRA GALP AMARANTE', 'Combustível', -62.4);
    add('2026-09-29', 'Via Verde', 'DD VIA VERDE PORTUGAL', 'Portagens e Via Verde', -18.35);
    add('2026-09-27', 'Farmácia Central', 'COMPRA FARMACIA CENTRAL LOUSADA', 'Farmácia', -14.8);
    add('2026-09-25', 'Continente', 'COMPRA CONTINENTE MODELO', null, -96.18, { split: [{ cat: 'Supermercado', amt: -71.18 }, { cat: 'Artigos para a casa', amt: -25 }] });
    add('2026-10-01', 'Vencimento', 'TRF RECEBIDA ENTIDADE EMPREGADORA', 'Vencimento', 2350);
    add('2026-10-02', 'Pingo Doce', 'COMPRA 4521 PINGO DOCE LOUSADA', 'Supermercado', -48.72);
    [['2026-09-27', 'Restaurante O Quintal', 'COMPRA REST O QUINTAL LOUSADA', -27.5, { pending: true }],
      ['2026-09-24', 'Uber Eats', 'COMPRA UBER *EATS', -18.9], ['2026-09-22', 'MB WAY Joana Silva', 'MB WAY PARA JOANA SILVA', -25],
      ['2026-09-21', 'Padaria Lousa', 'COMPRA PADARIA LOUSA', -4.6], ['2026-09-19', 'Bolt', 'COMPRA BOLT.EU O2109', -9.8],
      ['2026-09-18', 'Wook', 'COMPRA WOOK.PT', -22.9], ['2026-09-16', 'Bar Central', 'COMPRA BAR CENTRAL', -14],
      ['2026-09-14', 'Florista Rosa', 'COMPRA FLORISTA ROSA', -30], ['2026-09-12', 'Leroy Merlin', 'COMPRA LEROY MERLIN PAREDES', -41.25],
      ['2026-10-02', 'Uber', 'COMPRA UBER *TRIP', -11.4], ['2026-10-02', 'Café Avenida', 'COMPRA CAFE AVENIDA', -2.3],
      ['2026-10-01', 'MB WAY Rui Costa', 'MB WAY PARA RUI COSTA', -15]].forEach(x => add(x[0], x[1], x[2], null, x[3], x[4]));
    return out;
  }
  const seedBills = () => [
    { id: 'b1', name: 'Vodafone', cat: 'Telecomunicações', color: 'var(--cat-bills)', date: '2026-10-06', freq: 'Mensal', value: 39.99 },
    { id: 'b2', name: 'EDP Comercial', cat: 'Eletricidade', color: 'var(--cat-bills)', date: '2026-10-08', freq: 'Mensal', value: 74.91 },
    { id: 'b3', name: 'Ginásio Fit', cat: 'Ginásio e desporto', color: 'var(--cat-personal)', date: '2026-10-10', freq: 'Mensal', value: 100 },
    { id: 'b4', name: 'Crédito automóvel', cat: 'Crédito automóvel', color: 'var(--cat-debt)', date: '2026-10-15', freq: 'Mensal', value: 214.3 },
    { id: 'b5', name: 'Seguro automóvel', cat: 'Seguro automóvel', color: 'var(--cat-transport)', date: '2026-11-03', freq: 'Trimestral', value: 142 },
    { id: 'b6', name: 'Spotify', cat: 'Streaming e música', color: 'var(--cat-bills)', date: '2026-11-12', freq: 'Mensal', value: 11.99 }
  ];
  const seedRules = () => [['PINGO DOCE', 'Supermercado'], ['CONTINENTE', 'Supermercado'], ['LIDL', 'Supermercado'], ['GALP', 'Combustível'], ['REPSOL', 'Combustível'], ['VIA VERDE', 'Portagens e Via Verde'], ['VODAFONE', 'Telecomunicações'], ['EDP COMERCIAL', 'Eletricidade'], ['SPOTIFY', 'Streaming e música'], ['UBER EATS', 'Entregas ao domicílio'], ['FARMACIA', 'Farmácia'], ['TRF PARA XTB', 'Entre contas minhas']]
    .map((x, i) => ({ id: 'r' + (i + 1), match: x[0], field: 'desc', account: '', cat: x[1], active: true }));
  const POS = [
    { t: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', kind: 'ETF', acc: true, qty: 22.5, value: 2840.2, moves: [['2026-03-04', 'Compra', 8, 896.8], ['2026-05-06', 'Compra', 7, 810.6], ['2026-07-03', 'Compra', 4.5, 530.78], ['2026-09-02', 'Compra', 3, 363.62]] },
    { t: 'AAPL.US', name: 'Apple Inc.', kind: 'Ação', acc: false, qty: 6, value: 1120.3, realized: 96.8, moves: [['2026-02-10', 'Compra', 5, 812.5], ['2026-04-14', 'Compra', 4, 657.8], ['2026-05-20', 'Venda', 3, 586.9]] },
    { t: 'EUNL.DE', name: 'iShares Core MSCI World UCITS ETF', kind: 'ETF', acc: true, qty: 8, value: 941.6, moves: [['2026-06-05', 'Compra', 5, 562.4], ['2026-08-04', 'Compra', 3, 345.35]] }
  ];
  POS.forEach(p => { let q = 0, c = 0; p.moves.forEach(m => { if (m[1] === 'Compra') { q += m[2]; c += m[3]; } else { c -= c / q * m[2]; q -= m[2]; } }); p.cost = Math.round(c * 100) / 100; });
  const DIV = [['2026-09-30', 'Caixa', 'Juros', 4.19, 1.17], ['2026-09-26', 'AAPL.US', 'Dividendo', 4.02, 0.6], ['2026-08-31', 'Caixa', 'Juros', 4.03, 1.13], ['2026-07-31', 'Caixa', 'Juros', 3.89, 1.09], ['2026-06-27', 'AAPL.US', 'Dividendo', 4.02, 0.6], ['2026-03-28', 'AAPL.US', 'Dividendo', 3.95, 0.59]];

  /* Estado */
  const SNAP = ['#acc-list', '#groups', '#people', '#imp-list'];
  const seedSnaps = {}; SNAP.forEach(s => { seedSnaps[s] = $(s).innerHTML; });
  const fresh = () => ({ v: 1, tx: seedTx(), bills: seedBills(), rules: seedRules(), wiped: false, snaps: {}, payday: '', review: { cur: 0, pending: 12 }, ui: { size: 25 }, seq: 100 });
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) { st = null; }
  if (!st || st.v !== 1) st = fresh();
  Object.keys(st.snaps || {}).forEach(s => { const el = $(s); if (el && typeof st.snaps[s] === 'string') el.innerHTML = st.snaps[s]; });
  if (st.payday) $('#d').value = st.payday;
  updateGroupCounts();
  const nid = p => p + (++st.seq);
  let saveT;
  function save(now) { clearTimeout(saveT); const w = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* armazenamento indisponível */ } }; if (now) w(); else saveT = setTimeout(w, 150); }
  let snapT;
  const mo = new MutationObserver(() => {
    clearTimeout(snapT);
    snapT = setTimeout(() => {
      let changed = false, groups = false;
      SNAP.forEach(s => { const v = $(s).innerHTML; if (st.snaps[s] !== v) { if (s === '#groups' && st.snaps[s] != null) groups = true; st.snaps[s] = v; changed = true; } });
      if (changed) save();
      if (groups) renderGroupsDeps();
    }, 200);
  });
  SNAP.forEach(s => { if (st.snaps[s] == null) st.snaps[s] = $(s).innerHTML; mo.observe($(s), { childList: true, subtree: true, characterData: true }); });
  $('#d').addEventListener('input', function () { const v = +this.value; if (v >= 1 && v <= 31) { st.payday = this.value; save(); } });
  let groupsT;
  function renderGroupsDeps() { clearTimeout(groupsT); groupsT = setTimeout(() => { updateGroupCounts(); renderTx(); renderRules(); renderInsights(); }, 100); }

  /* Estados vazios depois de apagar tudo */
  ['home', 'review', 'insights', 'networth', 'investments', 'forecast', 'debt', 'weekly', 'budget', 'goals'].forEach(k => {
    const v = $('.view[data-view="' + k + '"]'); if (!v) return;
    v.setAttribute('data-kv-wipe', '');
    const el = document.createElement('div');
    el.className = 'card kv-empty';
    el.setAttribute('style', 'flex-direction: column; align-items: flex-start; gap: 8px; max-width: 640px');
    el.innerHTML = '<h2 class="hl">Sem dados</h2><p class="cap" style="margin: 0">Apagaste todos os dados. Importa um extrato para voltar a preencher esta página, ou repõe os dados de exemplo.</p><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px"><a class="btn" href="#import">Importar extrato</a><button class="btn btn-outline" type="button" data-kv-demo>Repor dados de exemplo</button></div>';
    $('.head', v).after(el);
  });
  function applyWiped() { document.body.classList.toggle('kv-wiped', !!st.wiped); const dot = $('#weekly-dot'); if (dot) dot.hidden = !!st.wiped; }

  /* ===== Transações ===== */
  let txPage = 0, txSort = { key: 'date', dir: -1 };
  const txSize = () => st.ui && st.ui.size || 25;
  const isUnc = t => !t.cat && !t.split;
  function txFiltered() {
    const q = $('#q').value.trim().toLowerCase(), a = $('#a').value, c = $('#c').value, m = $('#m').value, sm = subMap();
    const MON = { out: '2026-10', set: '2026-09', ago: '2026-08' };
    return st.tx.filter(t => {
      const keys = t.split ? t.split.map(p => (sm[p.cat] || NONE).key) : [t.cat ? (sm[t.cat] || NONE).key : 'none'];
      if (q && (t.merchant + ' ' + t.desc + ' ' + (t.note || '') + ' ' + (t.cat || '')).toLowerCase().indexOf(q) < 0) return false;
      if (a && t.account !== a) return false;
      if (c && keys.indexOf(c) < 0) return false;
      if (m && t.date.indexOf(MON[m]) !== 0) return false;
      return true;
    });
  }
  function txSorted(list) {
    const k = txSort.key, d = txSort.dir;
    const val = t => k === 'date' ? t.date : k === 'amount' ? t.amount : k === 'cat' ? (t.split ? 'Divisão' : t.cat || '') : String(t[k] || '').toLowerCase();
    return list.slice().sort((x, y) => { const a = val(x), b = val(y); if (a < b) return -d; if (a > b) return d; return (+y.id.slice(1) - +x.id.slice(1)) * (k === 'date' ? -d * -1 : 1); });
  }
  function txRow(t, sm) {
    const g = t.cat ? sm[t.cat] : null;
    let chip;
    if (t.split) chip = '<button class="chip" type="button" style="border: 0; font-family: inherit; cursor: pointer" aria-expanded="false" aria-label="Ver divisão em ' + t.split.length + ' categorias" data-split-toggle>' + CHEV.replace(' data-chev', '') + t.split.map((p, i) => '<span class="dot" style="background: ' + (sm[p.cat] || NONE).color + (i ? '; margin-left: -4px' : '') + '"></span>').join('') + 'Divisão · ' + t.split.length + '</button>';
    else if (!t.cat) chip = '<a class="chip chip-dashed" href="#review">Sem categoria</a>';
    else chip = '<span class="chip"><span class="dot" style="background: ' + (g ? g.color : 'var(--ink3)') + '"></span>' + esc(t.cat) + '</span>';
    const out = g && g.type === 'out';
    const act = t.bill ? '<span class="badge badge-info" title="Já é uma conta a pagar" style="padding: 0 4px">' + CHECK.replace('aria-hidden="true"', 'role="img" aria-label="Conta a pagar associada"') + '</span>'
      : t.amount < 0 && !out ? '<button class="icon-btn" type="button" aria-label="Marcar ' + esc(t.merchant) + ' como conta a pagar" title="Marcar como conta a pagar…" data-bill-from-tx>' + CAL + '</button>' : '';
    let html = '<div class="row tx" role="row" data-id="' + t.id + '">' +
      '<span class="cap tnum">' + fmtD(t.date) + '</span>' +
      '<span style="min-width: 0"><span class="inline" style="font-weight: 500; gap: 8px; max-width: 100%"><span class="ellipsis">' + esc(t.merchant) + '</span>' + (out ? XFER : '') + (t.note ? NOTE : '') + '</span><span class="micro ellipsis">' + esc(t.desc) + (t.pending ? ' · pendente' : '') + (t.note ? ' · ' + esc(t.note) : '') + '</span></span>' +
      '<span style="min-width: 0">' + chip + '</span>' +
      '<span class="cap inline" style="gap: 8px"><span class="dot" style="width: 8px; height: 8px; background: ' + (ACC_COLOR[t.account] || 'var(--ink3)') + '"></span>' + esc(t.account) + '</span>' +
      '<span class="' + (t.amount > 0 && !out ? 'tnum pos' : 'tnum') + '" style="text-align: right; font-weight: 500">' + eur(t.amount) + '</span>' +
      '<span style="display: flex; gap: 4px; justify-content: flex-end">' + act + '<button class="icon-btn" type="button" data-kv-tx-edit="' + t.id + '" aria-label="Editar ' + esc(t.merchant) + '" title="Editar">' + PEN + '</button></span></div>';
    if (t.split) html += '<div class="split-detail" data-split-detail hidden>' + t.split.map(p => { const pg = sm[p.cat] || NONE; return '<div class="between cap"><span class="inline"><span class="dot" style="width: 8px; height: 8px; background: ' + pg.color + '"></span>' + esc(p.cat) + ' <span class="chip-grp">' + esc(pg.name) + '</span></span><span class="tnum strong">' + eur(p.amt) + '</span></div>'; }).join('') + '</div>';
    return html;
  }
  function sums(list) {
    const sm = subMap(); let spent = 0, recv = 0;
    list.forEach(t => (t.split || [{ cat: t.cat, amt: t.amount }]).forEach(p => {
      const g = p.cat ? sm[p.cat] || NONE : NONE;
      if (p.amt < 0 && (g.type === 'fixed' || g.type === 'variable')) spent -= p.amt;
      if (p.amt > 0 && g.type === 'income') recv += p.amt;
    }));
    return { spent, recv };
  }
  function renderTx() {
    const sm = subMap(), all = txFiltered(), list = txSorted(all), size = txSize(), pages = Math.max(1, Math.ceil(list.length / size));
    txPage = Math.max(0, Math.min(txPage, pages - 1));
    const slice = list.slice(txPage * size, txPage * size + size);
    $('#tx-body').innerHTML = slice.map(t => txRow(t, sm)).join('');
    const empty = $('[data-tx-empty]'); empty.hidden = list.length > 0;
    empty.textContent = st.tx.length ? 'Nenhuma transação corresponde aos filtros.' : 'Ainda não há transações. Importa um extrato para começar.';
    const filtered = !!($('#q').value.trim() || $('#a').value || $('#c').value || $('#m').value);
    $('[data-tx-shown]').hidden = !filtered; $('[data-tx-shown] [data-n]').textContent = list.length;
    const s = sums(list), unc = st.tx.filter(isUnc).length;
    $('#tx-total').textContent = st.tx.length; $('#tx-spent').textContent = eur(s.spent); $('#tx-recv').textContent = eur(s.recv); $('#tx-unc').textContent = unc;
    const rb = $('#tx-review-btn'); rb.hidden = !unc; rb.textContent = 'Rever ' + unc + ' por categorizar';
    $$('[data-kv-sort]').forEach(b => {
      const on = b.getAttribute('data-kv-sort') === txSort.key;
      b.parentElement.setAttribute('aria-sort', on ? (txSort.dir > 0 ? 'ascending' : 'descending') : 'none');
      $('[data-arrow]', b).textContent = on ? (txSort.dir > 0 ? '↑' : '↓') : '';
      b.style.color = on ? 'var(--ink)' : '';
    });
    const from = list.length ? txPage * size + 1 : 0, to = Math.min(list.length, txPage * size + size);
    $('#tx-pager').innerHTML = '<span class="cap">A mostrar <span class="tnum strong">' + from + '–' + to + '</span> de <span class="tnum">' + list.length + '</span></span>' +
      '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><label class="cap" for="tx-size">Por página</label><select id="tx-size" class="input" style="width: 80px">' + [25, 50, 100].map(n => '<option' + (n === size ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<button class="btn btn-outline btn-sm" type="button" data-kv-page="-1"' + (txPage === 0 ? ' disabled' : '') + '>Anterior</button><span class="cap tnum">Página ' + (txPage + 1) + ' de ' + pages + '</span><button class="btn btn-outline btn-sm" type="button" data-kv-page="1"' + (txPage >= pages - 1 ? ' disabled' : '') + '>Seguinte</button></div>';
  }
  $('#q').addEventListener('input', () => { txPage = 0; renderTx(); });
  ['#a', '#c', '#m'].forEach(s => $(s).addEventListener('change', () => { txPage = 0; renderTx(); }));

  let editing = null;
  function editTx(id, opener) {
    const t = st.tx.find(x => x.id === id); if (!t) return;
    editing = { t, wasUnc: isUnc(t), unsplit: false };
    const f = $('#tx-dialog form'); f.reset();
    $('[data-tx-desc]').textContent = t.desc; $('[data-tx-acc]').textContent = t.account; $('[data-tx-amt]').textContent = eur(t.amount); $('[data-tx-m]').textContent = t.merchant;
    f.elements.merchant.value = t.merchant; f.elements.date.value = t.date; f.elements.note.value = t.note || '';
    f.elements.cat.innerHTML = catOptions(true); f.elements.cat.value = t.cat || '';
    splitUI(!!t.split, t.split ? t.split.length : 0);
    openDlg('tx-dialog', opener);
  }
  function splitUI(on, n) { $('[data-tx-catfield]').hidden = on; $('[data-tx-splitnote]').hidden = !on; $('[data-tx-allrow]').hidden = on; if (on) $('[data-tx-splitnote] [data-n]').textContent = n; }
  function saveTx(f) {
    const t = editing.t, m = f.elements.merchant.value.trim();
    if (setErr(f.elements.merchant, 'tx-merchant-err', !m)) return;
    const oldM = t.merchant;
    t.merchant = m; t.date = f.elements.date.value || t.date; t.note = f.elements.note.value.trim();
    if (editing.unsplit) t.split = null;
    if (!t.split) { const c = f.elements.cat.value || null; if (c !== t.cat || editing.unsplit) { t.cat = c; t.manual = true; } }
    let delta = (editing.wasUnc && !isUnc(t)) ? -1 : (!editing.wasUnc && isUnc(t)) ? 1 : 0, others = 0;
    if (f.elements.applyall.checked && t.cat) {
      st.tx.forEach(x => { if (x !== t && !x.split && (x.merchant === oldM || x.merchant === m)) { if (isUnc(x)) delta--; x.cat = t.cat; x.merchant = m; x.manual = true; others++; } });
      if (!st.rules.some(r => r.match === m.toUpperCase() && r.field === 'merchant')) st.rules.unshift({ id: nid('r'), match: m.toUpperCase(), field: 'merchant', account: '', cat: t.cat, active: true });
    }
    pend(delta);
    $('#tx-dialog').close(); save(); renderAll();
    toast('Transação atualizada.' + (f.elements.applyall.checked && t.cat ? (others ? ' Mais ' + others + ' de ' + m + ' atualizadas.' : '') + ' Regra criada.' : ''));
  }

  /* ===== Contas a pagar ===== */
  const FREQ = { 'Mensal': 1, 'Bimestral': 1 / 2, 'Trimestral': 1 / 3, 'Semestral': 1 / 6, 'Anual': 1 / 12 };
  function relDue(iso) { const n = days(TODAY, iso); return n < 0 ? 'atrasada ' + (-n) + ' d' : n === 0 ? 'hoje' : n === 1 ? 'amanhã' : 'em ' + n + ' dias'; }
  function renderBills() {
    const list = st.bills.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const soon = list.filter(b => days(TODAY, b.date) <= 7), later_ = list.filter(b => days(TODAY, b.date) > 7);
    const row = (b, s) => {
      const n = days(TODAY, b.date);
      const due = s ? (n <= 1 ? '<span class="badge ' + (n < 0 ? 'badge-neg' : 'badge-warn') + '">' + relDue(b.date) + '</span>' : '<span class="cap">' + relDue(b.date) + '</span>') : '';
      return '<div class="row bl" role="row" data-bill="' + b.id + '">' +
        '<span class="inline" style="gap: 10px; min-width: 0"><span class="dot" style="background: ' + b.color + '"></span><span style="min-width: 0"><span class="ellipsis" style="font-weight: 500">' + esc(b.name) + '</span><span class="micro">' + esc(b.cat) + '</span></span></span>' +
        '<span><span class="tnum" style="display: block">' + fmtD(b.date) + '</span>' + due + '</span><span class="cap">' + esc(b.freq) + '</span><span class="tnum" style="text-align: right">' + eur(b.value) + '</span>' +
        '<span style="display: flex; gap: 4px; justify-content: flex-end; align-items: center">' + (b.paid ? '<span class="badge badge-pos">' + CHECK + 'Paga</span>' : '') +
        '<button class="btn ' + (s ? 'btn-outline' : 'btn-ghost') + ' btn-sm" type="button" data-kv-paid="' + b.id + '">' + (b.paid ? 'Desfazer' : 'Marcar como paga') + '</button>' +
        '<button class="icon-btn" type="button" data-kv-bill-edit="' + b.id + '" aria-label="Editar ' + esc(b.name) + '" title="Editar">' + PEN + '</button>' +
        '<button class="icon-btn" type="button" data-kv-bill-del="' + b.id + '" aria-label="Eliminar ' + esc(b.name) + '" title="Eliminar" style="color: var(--neg)">' + TRASH + '</button></span></div>';
    };
    const sec = l => '<div class="row-sec label-caps cap" role="row"><span role="cell">' + l + '</span></div>';
    $('#bills-body').innerHTML = !list.length ? '<div class="row-sec cap" style="height: 56px; justify-content: center; background: var(--card)">Ainda não há contas a pagar. Adiciona a primeira.</div>'
      : (soon.length ? sec('Próximos 7 dias') + soon.map(b => row(b, true)).join('') : '') + (later_.length ? sec('Mais tarde') + later_.map(b => row(b, false)).join('') : '');
    const due7 = soon.filter(b => !b.paid).reduce((s, b) => s + b.value, 0);
    $('#bills-7d').textContent = eur(due7);
    $('#bills-month').textContent = eur(list.reduce((s, b) => s + b.value * (FREQ[b.freq] || 1), 0));
    $('#bills-n').textContent = list.length + (list.length === 1 ? ' conta ativa' : ' contas ativas');
    const hs = soon.filter(b => !b.paid);
    $('#home-bills-n').textContent = hs.length; $('#home-bills-v').textContent = eur(due7);
    $('#home-bills').innerHTML = hs.length ? hs.map(b => '<tr><td><div class="strong">' + esc(b.name) + '</div><div class="cap">' + esc(b.cat) + '</div></td><td class="cap tnum">' + fmtS(b.date) + ' · ' + relDue(b.date) + '</td><td class="r tnum">' + eur(b.value) + '</td></tr>').join('')
      : '<tr><td class="cap" colspan="3">Nada por pagar nos próximos 7 dias.</td></tr>';
  }
  function billMode(edit) { $$('[data-bmode]').forEach(s => { s.hidden = s.getAttribute('data-bmode') !== (edit ? 'edit' : 'add'); }); }
  function editBill(id, opener) {
    const b = st.bills.find(x => x.id === id); if (!b) return;
    const f = $('#bill-dialog form'); f.reset(); f._editId = id; billMode(true);
    f.elements.nome.value = b.name; f.elements.valor.value = eur(b.value); f.elements.data.value = b.date; f.elements.freq.value = b.freq;
    const o = $$('option', f.elements.cat).find(x => x.textContent === b.cat); if (o) f.elements.cat.value = o.value;
    openDlg('bill-dialog', opener);
  }
  function saveBill(f, name, value) {
    const opt = f.elements.cat.selectedOptions[0];
    const data = { name, cat: opt.textContent, color: opt.getAttribute('data-color'), date: f.elements.data.value || TODAY, freq: f.elements.freq.value, value };
    if (f._editId) { Object.assign(st.bills.find(b => b.id === f._editId), data); toast('Conta a pagar atualizada.'); }
    else { st.bills.push(Object.assign({ id: nid('b') }, data)); st.tx.forEach(t => { if (t.merchant === name && t.amount < 0) t.bill = true; }); toast('Conta a pagar adicionada: ' + name + '.'); }
    f._editId = null; save(); renderBills(); renderTx();
  }

  /* Confirmação genérica */
  let confirmFn = null;
  function confirmDlg(title, text, ok, fn, opener) { $('#kv-confirm-title').textContent = title; $('[data-kv-confirm-text]').textContent = text; $('[data-kv-confirm-ok]').textContent = ok; confirmFn = fn; openDlg('kv-confirm', opener); $('#kv-confirm [data-close]').focus(); }

  /* ===== Regras ===== */
  function ruleMatches(r, t, ignoreActive) {
    if (!ignoreActive && !r.active) return false;
    if (r.account && t.account !== r.account) return false;
    return (r.field === 'merchant' ? t.merchant : t.desc).toUpperCase().indexOf(r.match.toUpperCase()) > -1;
  }
  function applyRules() {
    let n = 0, unc = 0;
    st.tx.forEach(t => { if (t.manual || t.split) return; const r = st.rules.find(x => ruleMatches(x, t)); if (r && t.cat !== r.cat) { if (!t.cat) unc++; t.cat = r.cat; n++; } });
    pend(-unc); save(); renderAll();
    return n;
  }
  function renderRules() {
    const sm = subMap();
    $('#rules').innerHTML = st.rules.length ? st.rules.map(r => {
      const g = sm[r.cat] || NONE, hits = st.tx.filter(t => ruleMatches(r, t, true)).length;
      return '<div class="row rule" data-rule="' + r.id + '"' + (r.active ? '' : ' style="opacity: 0.6"') + '>' +
        '<span style="min-width: 0"><span class="ellipsis" style="font-weight: 500">' + (r.field === 'merchant' ? 'Comerciante' : 'Descrição') + ' contém “' + esc(r.match) + '”</span><span class="micro">' + esc(r.account || 'Todas as contas') + '</span></span>' +
        '<span style="min-width: 0"><span class="chip"><span class="dot" style="background: ' + g.color + '"></span>' + esc(r.cat) + '</span></span>' +
        '<span class="cap tnum" style="text-align: right">' + hits + (hits === 1 ? ' transação' : ' transações') + '</span>' +
        '<label class="check"><input type="checkbox" data-kv-rule-toggle="' + r.id + '"' + (r.active ? ' checked' : '') + '>Ativa</label>' +
        '<span style="display: flex; gap: 4px; justify-content: flex-end"><button class="icon-btn" type="button" data-kv-rule-edit="' + r.id + '" aria-label="Editar regra ' + esc(r.match) + '">' + PEN + '</button><button class="icon-btn" type="button" data-kv-rule-del="' + r.id + '" aria-label="Eliminar regra ' + esc(r.match) + '" style="color: var(--neg)">' + TRASH + '</button></span></div>';
    }).join('') : '<div class="row-sec cap" style="height: 56px; justify-content: center; background: var(--card)">Sem regras. Cria uma para categorizar automaticamente.</div>';
    $('#rules-n').textContent = st.rules.length;
  }
  let editRuleId = null;
  function ruleOpen(id, opener) {
    const r = id ? st.rules.find(x => x.id === id) : null; editRuleId = r ? r.id : null;
    const f = $('#rule-dialog form'); f.reset(); f.elements.cat.innerHTML = catOptions(false);
    $$('[data-rmode]').forEach(s => { s.hidden = s.getAttribute('data-rmode') !== (r ? 'edit' : 'add'); });
    if (r) { f.elements.match.value = r.match; f.elements.field.value = r.field; f.elements.account.value = r.account; f.elements.cat.value = r.cat; }
    ruleHits(); openDlg('rule-dialog', opener);
  }
  function ruleHits() {
    const f = $('#rule-dialog form'), m = f.elements.match.value.trim();
    $('[data-rule-hits]').textContent = m ? 'Corresponde a ' + st.tx.filter(t => ruleMatches({ match: m, field: f.elements.field.value, account: f.elements.account.value }, t, true)).length + ' transações atuais.' : 'Escreve o texto que aparece na descrição do banco ou no nome do comerciante.';
  }
  $('#rule-dialog form').addEventListener('input', ruleHits);
  function saveRule(f) {
    const m = f.elements.match.value.trim(); if (setErr(f.elements.match, 'rule-match-err', !m)) return;
    const data = { match: m.toUpperCase(), field: f.elements.field.value, account: f.elements.account.value, cat: f.elements.cat.value };
    if (editRuleId) Object.assign(st.rules.find(r => r.id === editRuleId), data); else st.rules.unshift(Object.assign({ id: nid('r'), active: true }, data));
    $('#rule-dialog').close();
    const n = f.elements.apply.checked ? applyRules() : (save(), renderAll(), 0);
    toast((editRuleId ? 'Regra atualizada.' : 'Regra criada.') + (f.elements.apply.checked ? ' ' + n + (n === 1 ? ' transação atualizada.' : ' transações atualizadas.') : ''));
  }

  /* ===== Análises ===== */
  function period() {
    const v = $('#in-period').value; $('#in-custom').hidden = v !== 'custom';
    if (/^\d{4}-\d{2}$/.test(v)) {
      const from = v + '-01', full = v + '-' + String(lastDay(v)).padStart(2, '0'), to = full > DATA_END ? DATA_END : full, pm = prevYm(v);
      const pend_ = pm + '-' + String(lastDay(pm)).padStart(2, '0'), pto0 = addDays(pm + '-01', days(from, to)), partial = to !== full;
      return { from, to, label: ymLabel(v) + (partial ? ' (até ' + fmtS(to) + ')' : ''), pfrom: pm + '-01', pto: pto0 > pend_ ? pend_ : pto0, plabel: partial ? 'o mesmo período de ' + ymLabel(pm) : ymLabel(pm) };
    }
    let from = DATA_START, to = DATA_END;
    if (v === 'custom') { from = $('#in-from').value || DATA_START; to = $('#in-to').value || DATA_END; if (from > to) { const x = from; from = to; to = x; } }
    const span = days(from, to), pto = addDays(from, -1);
    return { from, to, label: fmtD(from) + ' a ' + fmtD(to), pfrom: addDays(pto, -span), pto, plabel: 'os ' + (span + 1) + ' dias anteriores' };
  }
  function agg(from, to) {
    const sm = subMap(), r = { spend: 0, income: 0, fixed: 0, variable: 0, savings: 0, g: {}, s: {}, n: 0 };
    st.tx.forEach(t => {
      if (t.date < from || t.date > to) return; r.n++;
      (t.split || [{ cat: t.cat, amt: t.amount }]).forEach(p => {
        const g = p.cat ? sm[p.cat] || NONE : NONE, type = !p.cat && p.amt > 0 ? 'income' : g.type;
        if (type === 'income' && p.amt > 0) r.income += p.amt;
        if ((type === 'fixed' || type === 'variable') && p.amt < 0) {
          r.spend -= p.amt; r[type] -= p.amt; r.g[g.key] = (r.g[g.key] || 0) - p.amt;
          const sk = g.key + '|' + (p.cat || 'Sem categoria'); r.s[sk] = (r.s[sk] || 0) - p.amt;
        }
        if (type === 'savings' && p.amt < 0) r.savings -= p.amt;
      });
    });
    return r;
  }
  function deltaHtml(cur, prev, lowerBetter) {
    const v = (cur - prev) / Math.abs(prev);
    if (!isFinite(v)) return '<span class="cap">sem base de comparação</span>';
    if (Math.abs(v) < 0.005) return '<span class="cap">= 0%</span>';
    const good = lowerBetter ? v < 0 : v > 0;
    return '<span class="' + (good ? 'pos' : 'neg') + '" style="font-weight: 500">' + (v > 0 ? '↑ ' : '↓ ') + pct(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0) + (good ? ' favorável' : ' desfavorável') + '</span>';
  }
  function varHtml(v) {
    if (v == null || !isFinite(v)) return '<span class="cap">—</span>';
    if (Math.abs(v) < 0.005) return '<span class="cap">= 0%</span>';
    const big = Math.abs(v) >= 0.1;
    return '<span class="' + (v > 0 ? 'neg' : 'pos') + '">' + (v > 0 ? '↑ ' : '↓ ') + pct(Math.abs(v), 0) + (big ? (v > 0 ? ' desfavorável' : ' favorável') : '') + '</span>';
  }
  function renderInsights() {
    const p = period(), a = agg(p.from, p.to), b = agg(p.pfrom, p.pto), hasPrev = b.n > 0;
    $('#in-range').textContent = p.label + ' · comparado com ' + p.plabel;
    const left = a.income - a.spend, bleft = b.income - b.spend;
    $('#in-spend').textContent = eur(a.spend); $('#in-inc').textContent = eur(a.income); $('#in-left').textContent = eur(left);
    $('#in-left').className = 'display' + (left < 0 ? ' neg' : '');
    const sfx = ' face a ' + p.plabel;
    $('#in-spend-d').innerHTML = hasPrev ? deltaHtml(a.spend, b.spend, true) + sfx : 'Sem dados do período anterior';
    $('#in-inc-d').innerHTML = hasPrev ? deltaHtml(a.income, b.income, false) + sfx : 'Sem dados do período anterior';
    $('#in-left-d').innerHTML = (hasPrev ? deltaHtml(left, bleft, false) + sfx + ' · ' : '') + 'taxa de poupança ' + (a.income ? pct(left / a.income) : '—');
    const inc = a.income || 1, fx = a.fixed / inc, vr = a.variable / inc, lf = Math.max(0, left) / inc;
    $('#in-bar').setAttribute('aria-label', 'Fixas ' + pct(fx) + ', variáveis ' + pct(vr) + ', poupança líquida ' + pct(lf));
    $('#in-bar').innerHTML = a.income ? '<div style="width: ' + Math.min(100, fx * 100) + '%; background: var(--cat-home)"></div><div style="width: ' + Math.min(100, vr * 100) + '%; background: var(--cat-food)"></div><div style="width: ' + lf * 100 + '%; background: var(--cat-savings)"></div>' : '';
    $('#in-legend').innerHTML = [['var(--cat-home)', 'Fixas', a.fixed], ['var(--cat-food)', 'Variáveis', a.variable], ['var(--cat-savings)', left < 0 ? 'Défice' : 'Poupança líquida', left]]
      .map(x => '<span class="inline"><span class="dot" style="background: ' + x[0] + '"></span>' + x[1] + ' <span class="tnum strong">' + eur(Math.abs(x[2])) + '</span> · ' + (a.income ? pct(Math.abs(x[2]) / inc) : '—') + '</span>').join('');
    const groups = cats().concat([NONE]), byKey = {}; groups.forEach(g => { byKey[g.key] = g; });
    const rank = Object.keys(a.g).sort((x, y) => a.g[y] - a.g[x]);
    const top = rank.slice(0, 4), rest = rank.slice(4), restV = rest.reduce((s, k) => s + a.g[k], 0);
    const segs = top.map(k => [byKey[k].color, byKey[k].name, a.g[k]]); if (restV) segs.push(['var(--cat-shopping)', 'Outras (' + rest.length + ')', restV]);
    let acc = 0; const stops = segs.map(s => { const f = acc, t = acc + s[2] / (a.spend || 1) * 100; acc = t; return s[0] + ' ' + f + '% ' + t + '%'; });
    $('#in-donut').style.background = a.spend ? 'conic-gradient(' + stops.join(', ') + ')' : 'var(--subtle)';
    $('#in-donut-v').textContent = '€ ' + Math.round(a.spend).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    $('#in-donut-leg').innerHTML = segs.length ? segs.map(s => '<span class="between"><span class="inline"><span class="dot" style="width: 8px; height: 8px; background: ' + s[0] + '"></span>' + esc(s[1]) + '</span><span class="tnum strong">' + Math.round(s[2] / a.spend * 100) + '%</span></span>').join('') : '<span>Sem gastos neste período.</span>';
    // Média mensal nos N meses anteriores com dados
    const N = +$('#avg').value, months = []; let ym = p.from.slice(0, 7);
    for (let i = 0; i < N; i++) { ym = prevYm(ym); const L = ym + '-' + String(lastDay(ym)).padStart(2, '0'); if (st.tx.some(t => t.date >= ym + '-01' && t.date <= L)) months.push(agg(ym + '-01', L)); }
    $('#in-avg-th').textContent = 'Média de ' + N + ' meses';
    $('#in-avg-note').textContent = months.length ? (months.length < N ? 'Média com ' + months.length + (months.length === 1 ? ' mês' : ' meses') + ' de dados disponíveis' : '') : 'Sem meses anteriores para calcular a média';
    const factor = (days(p.from, p.to) + 1) / 30.44;
    const avgOf = fn => months.length ? months.reduce((s, m) => s + fn(m), 0) / months.length : null;
    let html = '';
    rank.forEach((k, idx) => {
      const g = byKey[k], v = a.g[k], av = avgOf(m => m.g[k] || 0);
      const subs = Object.keys(a.s).filter(x => x.indexOf(k + '|') === 0).sort((x, y) => a.s[y] - a.s[x]);
      const toggle = subs.length > 1;
      html += '<tr><td>' + (toggle ? '<button class="chip" type="button" data-sub-toggle="' + k + '" aria-expanded="' + (idx === 0) + '" style="border: 0; font-family: inherit; cursor: pointer">' + CHEV.replace('data-chev', 'data-chev style="' + (idx === 0 ? 'transform: rotate(90deg)' : '') + '"') : '<span class="chip">') + '<span class="dot" style="background: ' + g.color + '"></span>' + esc(g.name) + (toggle ? '</button>' : '</span>') + '</td>' +
        '<td class="r tnum">' + eur(v) + '</td><td class="r tnum">' + Math.round(v / a.spend * 100) + '%</td><td class="r tnum">' + (av == null ? '—' : eur(av)) + '</td><td class="r tnum">' + varHtml(av ? v / (av * factor) - 1 : null) + '</td></tr>';
      if (toggle) subs.forEach(sk => {
        const sv = a.s[sk], sav = avgOf(m => m.s[sk] || 0);
        html += '<tr data-sub="' + k + '"' + (idx === 0 ? '' : ' hidden') + '><td style="padding-left: 24px" class="cap">' + esc(sk.split('|')[1]) + '</td><td class="r tnum cap">' + eur(sv) + '</td><td class="r tnum cap">' + Math.round(sv / a.spend * 100) + '%</td><td class="r tnum cap">' + (sav == null ? '—' : eur(sav)) + '</td><td class="r tnum">' + varHtml(sav ? sv / (sav * factor) - 1 : null).replace(/ (des)?favorável/, '') + '</td></tr>';
      });
    });
    $('#in-cat').innerHTML = html || '<tr><td class="cap" colspan="5">Sem gastos neste período.</td></tr>';
  }
  ['#in-period', '#avg', '#in-from', '#in-to'].forEach(s => $(s).addEventListener('change', renderInsights));

  /* ===== Investimentos ===== */
  const PORT = POS.reduce((s, p) => s + p.value, 0);
  function renderInv() {
    $('#inv-pos').innerHTML = POS.map((p, i) => { const g = p.value - p.cost; return '<tr data-kv-posrow="' + i + '" style="cursor: pointer"><td><div style="font-weight: 500">' + p.t + '</div><div class="cap">' + esc(p.name) + '</div></td><td><span class="badge">' + p.kind + '</span></td><td class="r tnum">' + num(p.qty) + '</td><td class="r tnum">' + eur(p.cost / p.qty) + '</td><td class="r tnum">' + eur(p.value) + '</td><td class="r tnum">' + pct(p.value / PORT) + '</td><td class="r tnum ' + (g >= 0 ? 'pos' : 'neg') + '">' + (g >= 0 ? '↑ ' : '↓ ') + eur(Math.abs(g)) + ' · ' + pct(Math.abs(g) / p.cost) + '</td><td class="r"><button class="btn btn-ghost btn-sm" type="button" data-kv-pos="' + i + '">Ver detalhe</button></td></tr>'; }).join('');
    const tg = DIV.reduce((s, d) => s + d[3], 0), tt = DIV.reduce((s, d) => s + d[4], 0);
    $('#inv-div').innerHTML = DIV.map(d => '<tr><td class="cap tnum">' + fmtD(d[0]) + '</td><td>' + (d[1] === 'Caixa' ? 'Saldo em caixa' : d[1]) + '</td><td><span class="badge">' + d[2] + '</span></td><td class="r tnum">' + eur(d[3]) + '</td><td class="r tnum">' + eur(-d[4]) + '</td><td class="r tnum strong">' + eur(d[3] - d[4]) + '</td></tr>').join('') +
      '<tr><td colspan="3" class="strong">Total</td><td class="r tnum strong">' + eur(tg) + '</td><td class="r tnum strong">' + eur(-tt) + '</td><td class="r tnum strong">' + eur(tg - tt) + '</td></tr>';
    $('#inv-div-sum').textContent = 'Retenção na fonte ' + eur(tt) + ' · EUA 15% nos dividendos, 28% nos juros';
  }
  function openPos(i, opener) {
    const p = POS[i], g = p.value - p.cost, divs = DIV.filter(d => d[1] === p.t), dnet = divs.reduce((s, d) => s + d[3] - d[4], 0);
    const met = (l, v, c) => '<div><div class="kpi-label">' + l + '</div><div class="tnum ' + (c || '') + '" style="font-size: 16px; line-height: 24px; font-weight: 600">' + v + '</div></div>';
    $('[data-pos-body]').innerHTML = '<div class="between" style="align-items: flex-start"><div><h2 class="hl inline" id="pos-title" style="gap: 8px">' + p.t + ' <span class="badge">' + p.kind + '</span></h2><p class="cap sub">' + esc(p.name) + ' · XTB</p></div><button class="icon-btn" type="button" data-close aria-label="Fechar">' + I('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>') + '</button></div>' +
      '<div class="metric-grid" style="margin-top: 20px">' + met('Quantidade', num(p.qty)) + met('Preço médio', eur(p.cost / p.qty)) + met('Preço atual', eur(p.value / p.qty)) + met('Peso', pct(p.value / PORT)) +
      met('Custo', eur(p.cost)) + met('Valor', eur(p.value)) + met('Mais-valia latente', (g >= 0 ? '↑ ' : '↓ ') + eur(Math.abs(g)) + ' · ' + pct(Math.abs(g) / p.cost), g >= 0 ? 'pos' : 'neg') + met(p.realized ? 'Mais-valia realizada' : 'Rendimento recebido', p.realized ? eur(p.realized) : eur(dnet), p.realized ? 'pos' : '') + '</div>' +
      '<h3 class="hl" style="margin-top: 24px; font-size: 14px">Movimentos</h3><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th class="r">Quantidade</th><th class="r">Preço</th><th class="r">Total</th></tr></thead><tbody>' +
      p.moves.slice().reverse().map(m => '<tr><td class="cap tnum">' + fmtD(m[0]) + '</td><td><span class="badge' + (m[1] === 'Venda' ? ' badge-info' : '') + '">' + m[1] + '</span></td><td class="r tnum">' + num(m[2]) + '</td><td class="r tnum">' + eur(m[3] / m[2]) + '</td><td class="r tnum">' + eur(m[1] === 'Venda' ? m[3] : -m[3]) + '</td></tr>').join('') + '</tbody></table>' +
      '<h3 class="hl" style="margin-top: 24px; font-size: 14px">Dividendos</h3>' + (p.acc ? '<p class="cap" style="margin: 4px 0 0">ETF de acumulação: os dividendos são reinvestidos no fundo e não aparecem como rendimento.</p>'
        : '<table class="table"><thead><tr><th>Data</th><th class="r">Bruto</th><th class="r">Retenção na fonte</th><th class="r">Líquido</th></tr></thead><tbody>' + divs.map(d => '<tr><td class="cap tnum">' + fmtD(d[0]) + '</td><td class="r tnum">' + eur(d[3]) + '</td><td class="r tnum">' + eur(-d[4]) + '</td><td class="r tnum strong">' + eur(d[3] - d[4]) + '</td></tr>').join('') + '</tbody></table>');
    openDlg('pos-dialog', opener);
  }

  /* ===== Pesquisa global (Ctrl+K) ===== */
  let cmdSel = 0, cmdList = [];
  const navLabel = a => Array.from(a.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  function cmdBuild(q) {
    q = q.trim().toLowerCase(); const has = s => String(s || '').toLowerCase().indexOf(q) > -1, L = [];
    const push = (sec, label, sub, right, run) => L.push({ sec, label, sub, right, run });
    [['Importar extrato', () => go('import')], ['Começar revisão', () => go('review')],
      ['Adicionar conta a pagar', () => { go('bills'); later(() => $('[data-open-bill]').click()); }],
      ['Adicionar regra automática', () => { go('settings'); later(() => ruleOpen(null, $('[data-kv-rule-add]'))); }],
      ['Voltar a aplicar regras', () => { const n = applyRules(); toast('Regras aplicadas: ' + n + (n === 1 ? ' transação atualizada.' : ' transações atualizadas.') + ' As categorias manuais foram mantidas.'); }]]
      .forEach(x => { if (!q || has(x[0])) push('Ações', x[0], '', '', x[1]); });
    $$('[data-nav]').forEach(a => { const l = navLabel(a); if (!q || has(l)) push('Páginas', l, '', '', () => go(a.getAttribute('data-nav'))); });
    if (q) {
      st.tx.slice().sort((x, y) => x.date < y.date ? 1 : -1).filter(t => has(t.merchant) || has(t.desc) || has(t.note) || has(t.cat)).slice(0, 6).forEach(t => push('Transações', t.merchant, fmtD(t.date) + ' · ' + (t.split ? 'Divisão' : t.cat || 'Sem categoria') + ' · ' + t.account, eur(t.amount), () => { go('transactions'); $('#q').value = t.merchant; txPage = 0; renderTx(); later(() => editTx(t.id)); }));
      st.bills.filter(b => has(b.name) || has(b.cat)).slice(0, 4).forEach(b => push('Contas a pagar', b.name, fmtD(b.date) + ' · ' + b.freq, eur(b.value), () => { go('bills'); later(() => editBill(b.id)); }));
      let nc = 0; cats().forEach(g => g.subs.forEach(s => { if (nc < 5 && (has(s) || has(g.name))) { nc++; push('Categorias', s, g.name, '', () => { go('transactions'); $('#c').value = g.key; txPage = 0; renderTx(); }); } }));
      POS.forEach((p, i) => { if (has(p.t) || has(p.name)) push('Investimentos', p.t, p.name, eur(p.value), () => { go('investments'); later(() => openPos(i)); }); });
      st.rules.filter(r => has(r.match) || has(r.cat)).slice(0, 4).forEach(r => push('Regras', '“' + r.match + '” → ' + r.cat, r.active ? 'Ativa' : 'Inativa', '', () => { go('settings'); later(() => ruleOpen(r.id)); }));
    }
    return L;
  }
  function cmdRender() {
    cmdList = cmdBuild($('#cmdk-q').value); cmdSel = Math.max(0, Math.min(cmdSel, cmdList.length - 1));
    let html = '', sec = '';
    cmdList.forEach((it, i) => {
      if (it.sec !== sec) { sec = it.sec; html += '<div class="label-caps cap cmdk-sec" role="presentation">' + esc(sec) + '</div>'; }
      html += '<button class="cmdk-item" type="button" role="option" id="cmdk-' + i + '" data-cmdk="' + i + '" aria-selected="' + (i === cmdSel) + '" tabindex="-1"><span style="flex: 1; min-width: 0"><span class="ellipsis" style="font-weight: 500">' + esc(it.label) + '</span>' + (it.sub ? '<span class="micro ellipsis">' + esc(it.sub) + '</span>' : '') + '</span>' + (it.right ? '<span class="tnum cap">' + esc(it.right) + '</span>' : '') + '</button>';
    });
    const list = $('#cmdk-list'); list.innerHTML = html || '<p class="cap" style="padding: 16px 8px; margin: 0">Sem resultados para esta pesquisa.</p>';
    $('#cmdk-q').setAttribute('aria-activedescendant', cmdList.length ? 'cmdk-' + cmdSel : '');
    const el = $('#cmdk-' + cmdSel);
    if (el) { if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 8; else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 8; }
  }
  function cmdOpen(opener) { if ($('dialog[open]')) return; $('#cmdk-q').value = ''; cmdSel = 0; cmdRender(); openDlg('cmdk', opener); $('#cmdk-q').focus(); }
  function cmdRun(i) { const it = cmdList[i]; if (!it) return; $('#cmdk').close(); it.run(); }
  $('#cmdk-q').addEventListener('input', () => { cmdSel = 0; cmdRender(); });
  $('#cmdk-q').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = (cmdSel + 1) % Math.max(1, cmdList.length); cmdRender(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = (cmdSel - 1 + cmdList.length) % Math.max(1, cmdList.length); cmdRender(); }
    if (e.key === 'Enter') { e.preventDefault(); cmdRun(cmdSel); }
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('#cmdk').open) $('#cmdk').close(); else cmdOpen(); }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('#tx-body .row.tx')) editTx(e.target.getAttribute('data-id'), e.target);
  });

  /* ===== Eventos ===== */
  document.addEventListener('click', e => {
    const b = e.target.closest('button, a, input, select, label');
    if (!b) {
      const row = e.target.closest('#tx-body .row.tx'); if (row) editTx(row.getAttribute('data-id'), $('[data-kv-tx-edit]', row));
      const pr = e.target.closest('[data-kv-posrow]'); if (pr) openPos(+pr.getAttribute('data-kv-posrow'), $('[data-kv-pos]', pr));
      return;
    }
    const A = n => b.getAttribute(n), H = n => b.hasAttribute(n);
    if (H('data-kv-sort')) { const k = A('data-kv-sort'); txSort = txSort.key === k ? { key: k, dir: -txSort.dir } : { key: k, dir: k === 'date' || k === 'amount' ? -1 : 1 }; txPage = 0; renderTx(); }
    if (H('data-kv-page')) { txPage += +A('data-kv-page'); renderTx(); const r = $('[data-view="transactions"] .rows'); if (r) window.scrollTo(0, 0); }
    if (H('data-kv-tx-edit')) editTx(A('data-kv-tx-edit'), b);
    if (H('data-kv-unsplit') && editing) { editing.unsplit = true; splitUI(false); $('#tx-cat').value = ''; $('#tx-cat').focus(); }
    if (H('data-kv-paid')) { const x = st.bills.find(y => y.id === A('data-kv-paid')); x.paid = !x.paid; save(); renderBills(); toast(x.paid ? 'Marcada como paga.' : 'Pagamento desfeito.'); }
    if (H('data-kv-bill-edit')) editBill(A('data-kv-bill-edit'), b);
    if (H('data-kv-bill-del')) { const x = st.bills.find(y => y.id === A('data-kv-bill-del')); confirmDlg('Eliminar a conta a pagar ' + x.name + '?', 'Deixa de aparecer nas contas a pagar, na previsão e no Início. As transações já importadas não são alteradas.', 'Eliminar conta a pagar', () => { st.bills = st.bills.filter(y => y !== x); st.tx.forEach(t => { if (t.merchant === x.name) t.bill = false; }); save(); renderBills(); renderTx(); toast('Conta a pagar eliminada: ' + x.name + '.'); }, b); }
    if (H('data-kv-confirm-ok')) { $('#kv-confirm').close(); const fn = confirmFn; confirmFn = null; if (fn) fn(); }
    if (H('data-kv-rule-add')) ruleOpen(null, b);
    if (H('data-kv-rule-edit')) ruleOpen(A('data-kv-rule-edit'), b);
    if (H('data-kv-rule-del')) { const r = st.rules.find(y => y.id === A('data-kv-rule-del')); confirmDlg('Eliminar a regra “' + r.match + '”?', 'As transações já categorizadas por esta regra mantêm a categoria.', 'Eliminar regra', () => { st.rules = st.rules.filter(y => y !== r); save(); renderRules(); toast('Regra eliminada.'); }, b); }
    if (H('data-kv-apply-rules')) { const n = applyRules(); toast('Regras aplicadas: ' + n + (n === 1 ? ' transação atualizada.' : ' transações atualizadas.') + ' As categorias manuais foram mantidas.'); }
    if (H('data-kv-pos')) openPos(+A('data-kv-pos'), b);
    if (H('data-kv-cmdk')) cmdOpen(b);
    if (H('data-cmdk')) cmdRun(+A('data-cmdk'));
    if (H('data-kv-demo')) { localStorage.removeItem(KEY); location.reload(); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'tx-size') { st.ui = st.ui || {}; st.ui.size = +t.value; txPage = 0; save(); renderTx(); }
    if (t.hasAttribute && t.hasAttribute('data-kv-rule-toggle')) { const r = st.rules.find(y => y.id === t.getAttribute('data-kv-rule-toggle')); r.active = t.checked; save(); renderRules(); toast(r.active ? 'Regra ativada.' : 'Regra desativada.'); }
  });
  document.addEventListener('submit', e => {
    const f = e.target, k = f.getAttribute('data-kvform'); if (!k) return;
    e.preventDefault();
    if (k === 'tx') saveTx(f);
    if (k === 'rule') saveRule(f);
  });
  window.addEventListener('hashchange', () => { if (location.hash === '#insights') renderInsights(); });

  function renderAll() { renderTx(); renderBills(); renderRules(); renderInsights(); renderInv(); }

  /* API usada pelo script principal */
  window.KV = {
    loadReview: () => st.review || { cur: 0, pending: 12 },
    saveReview: (cur, pending) => { st.review = { cur, pending }; save(); },
    billMode: billMode,
    saveBill: saveBill,
    categorize: (m, label, always, parts) => {
      const list = st.tx.filter(t => t.merchant === m && isUnc(t)), targets = always ? list : list.slice(0, 1);
      targets.forEach(t => { if (parts) t.split = parts.map(p => ({ cat: p.cat, amt: p.amt })); else t.cat = label; t.manual = true; t.rv = true; });
      if (always && !parts && !st.rules.some(r => r.match === m.toUpperCase())) st.rules.unshift({ id: nid('r'), match: m.toUpperCase(), field: 'merchant', account: '', cat: label, active: true });
      save(); renderAll();
    },
    uncategorize: m => {
      const t = st.tx.slice().reverse().find(x => x.merchant === m && x.rv); if (!t) return;
      t.cat = null; t.split = null; t.manual = false; delete t.rv; save(); renderAll();
    },
    wipe: () => {
      st.tx = []; st.bills = []; st.rules = []; st.wiped = true; st.review = { cur: 999, pending: 0 };
      $('#acc-list').innerHTML = ''; $('#people').innerHTML = '';
      $$('#imp-list .row.imp:not(.row-head)').forEach(r => r.remove());
      $('#groups').innerHTML = seedSnaps['#groups'];
      save(true); applyWiped(); renderAll(); updateGroupCounts();
    },
    onImport: () => {
      if (!st.wiped) return;
      const f = fresh(); st.tx = f.tx; st.bills = f.bills; st.rules = f.rules; st.wiped = false;
      $('#acc-list').innerHTML = seedSnaps['#acc-list']; $('#people').innerHTML = seedSnaps['#people'];
      if (window.KVmain) window.KVmain.resetReview();
      save(true); applyWiped(); renderAll();
    },
    /* [desktop] Estado completo, tal como é guardado (para cópias de segurança). */
    snapshot: () => { save(true); return JSON.stringify(st); },
    /* [desktop] Exportação para o Duetto: contas, categorias, transações e investimentos. */
    duetto: () => ({
      formato: 'kivo-duetto', versao: 1, exportadoEm: new Date().toISOString(),
      contas: $$('#acc-list > .row').map(r => { const t = $('.hl', r), c = $('.cap', r), v = $$('.tnum', r); return { nome: t ? t.textContent.trim() : '', descricao: c ? c.textContent.trim() : '', transacoes: v[0] ? v[0].textContent.trim() : '', saldo: v[1] ? v[1].textContent.trim() : '' }; }),
      categorias: cats().map(g => ({ grupo: g.name, tipo: g.type, subcategorias: g.subs })),
      transacoes: st.tx.map(t => Object.assign({}, t)),
      investimentos: { posicoes: POS.map(p => ({ ticker: p.t, nome: p.name, tipo: p.kind, quantidade: p.qty, valor: p.value, custo: p.cost, movimentos: p.moves.map(m => ({ data: m[0], tipo: m[1], quantidade: m[2], valor: m[3] })) })), rendimentos: DIV.map(d => ({ data: d[0], ativo: d[1], tipo: d[2], bruto: d[3], imposto: d[4] })) }
    })
  };

  applyWiped();
  renderAll();
})();
