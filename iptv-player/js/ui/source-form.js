/**
 * Formulário de lista IPTV (criar e editar), com validação em linha e teste de ligação.
 */
import { html, render, on } from '../core/dom.js';
import { validateSourceUrl } from '../core/validate.js';
import { formatBytes } from '../core/format.js';
import { segmented, setSegmented } from './components/controls.js';
import { icon } from './components/icons.js';
import { openSheet } from './components/overlay.js';
import { toast } from './components/toast.js';
import { createSource, updateSource, getCredentials } from '../data/sources.js';
import { testConnection } from '../iptv/source-sync.js';
import { openImportSheet } from './import-sheet.js';

const MAX_FILE_MB = 300;
const REFRESH_OPTIONS = [
  { value: 0, label: 'Desligada (só manual)' },
  { value: 12, label: 'A cada 12 horas' },
  { value: 24, label: 'Diária' },
  { value: 168, label: 'Semanal' },
];

function field({ id, label, type = 'text', placeholder = '', inputmode, autocomplete = 'off', hint, action, value = '' }) {
  return html`
    <div class="field">
      <label class="field__label" for="${id}">${label}</label>
      <div class="field__control">
        <input class="input ${action ? 'input--with-action' : ''}" id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" value="${value}"
          ${inputmode ? html`inputmode="${inputmode}"` : ''} autocomplete="${autocomplete}" autocapitalize="off" autocorrect="off" spellcheck="false"
          aria-describedby="${id}-msg">
        ${action ?? ''}
      </div>
      <p class="field__msg" id="${id}-msg" data-msg-for="${id}"></p>
      ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
    </div>`;
}

function refreshSelect(id, value = 24) {
  return html`
    <div class="field">
      <label class="field__label" for="${id}">Atualização automática</label>
      <div class="select-wrap">
        <select class="input" id="${id}" name="${id}">
          ${REFRESH_OPTIONS.map((o) => html`<option value="${o.value}" ${o.value === value ? html`selected` : ''}>${o.label}</option>`)}
        </select>
        ${icon('chevronDown', { size: 'sm' })}
      </div>
      <p class="field__hint">Verificada sempre que abre a app. O iOS não permite atualizações em segundo plano.</p>
    </div>`;
}

const passwordToggle = html`<button class="icon-btn field__action" type="button" data-toggle-pass aria-label="Mostrar password" aria-pressed="false">${icon('eye', { size: 'sm' })}</button>`;

/**
 * @param {{source?: object}} opts  sem `source` → criação; com `source` → edição
 */
function formMarkup({ source, initialType = 'url' }) {
  const editing = Boolean(source);
  const type = editing ? { 'm3u-url': 'url', 'm3u-file': 'file', xtream: 'xtream' }[source.type] : initialType;
  const keepHint = editing ? 'Deixe em branco para manter o valor guardado.' : null;

  return html`
    <form class="form" novalidate data-source-form data-type="${type}">
      ${editing ? '' : segmented('type', [
        { value: 'url', label: 'URL', icon: 'link' },
        { value: 'file', label: 'Ficheiro', icon: 'file' },
        { value: 'xtream', label: 'Xtream', icon: 'server' },
      ], type, { label: 'Tipo de lista', block: true })}

      ${field({ id: 'src-name', label: 'Nome da lista', placeholder: 'Ex.: Casa', value: source?.name ?? '' })}

      <div class="form" data-panel="url" ${type === 'url' ? '' : html`hidden`}>
        ${field({ id: 'src-url', label: 'Endereço M3U / M3U8', type: 'url', inputmode: 'url', placeholder: editing ? '•••••• (guardado)' : 'https://servidor.com/lista.m3u', hint: keepHint })}
        ${refreshSelect('src-url-refresh', source?.refreshHours ?? 24)}
      </div>

      <div class="form" data-panel="file" ${type === 'file' ? '' : html`hidden`}>
        ${editing ? html`<p class="field__hint">Ficheiro atual: ${source.fileName ?? '—'}. Para o substituir use "Importar ficheiro novamente" na página da lista.</p>` : html`
          <label class="file-drop">
            <input type="file" id="src-file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,audio/mpegurl,application/x-mpegurl,application/vnd.apple.mpegurl">
            ${icon('file', { size: 'lg' })}
            <span data-file-label>Escolher ficheiro M3U</span>
            <span class="field__hint">Na app Ficheiros, iCloud Drive ou transferências.</span>
          </label>
          <p class="field__msg" data-msg-for="src-file"></p>
          <p class="field__hint">Funciona sempre, mesmo com fornecedores que bloqueiam o acesso a partir do browser.</p>`}
      </div>

      <div class="form" data-panel="xtream" ${type === 'xtream' ? '' : html`hidden`}>
        ${field({ id: 'src-server', label: 'Servidor', type: 'url', inputmode: 'url', placeholder: 'http://servidor.com:8080', value: source?.server ?? '' })}
        ${field({ id: 'src-user', label: 'Utilizador', autocomplete: 'username', placeholder: editing ? '•••••• (guardado)' : '', hint: keepHint })}
        ${field({ id: 'src-pass', label: 'Password', type: 'password', autocomplete: editing ? 'new-password' : 'current-password', placeholder: editing ? '•••••• (guardada)' : '', action: passwordToggle, hint: keepHint })}
        ${refreshSelect('src-xt-refresh', source?.refreshHours ?? 24)}
        <div class="notice">
          ${icon('shield', { size: 'sm' })}
          <div class="notice__body">Utilizador e password ficam cifrados neste dispositivo. Uma app web não tem acesso ao Keychain do iOS — use uma password exclusiva para este serviço.</div>
        </div>
      </div>

      <div data-test-result class="slot"></div>
      <div class="form-actions">
        <button class="btn btn--secondary btn--lg" type="button" data-test ${type === 'file' ? html`hidden` : ''}>${icon('link', { size: 'sm' })}<span>Testar ligação</span></button>
        <button class="btn btn--primary btn--lg" type="submit">${editing ? 'Guardar alterações' : 'Guardar e importar'}</button>
      </div>
    </form>`;
}

function setMsg(form, id, text, type = 'error') {
  const el = form.querySelector(`[data-msg-for="${id}"]`);
  const input = form.querySelector(`#${id}`);
  if (el) { el.className = `field__msg field__msg--${type}`; el.textContent = text ?? ''; }
  if (input) input.setAttribute('aria-invalid', text && type === 'error' ? 'true' : 'false');
}

/** Lê e valida o formulário. Devolve {ok, data} ou {ok:false} (mensagens já mostradas). */
function readForm(form, { editing }) {
  const type = form.dataset.type;
  const val = (id) => form.querySelector(`#${id}`)?.value.trim() ?? '';
  let ok = true;
  const fail = (id, msg) => { setMsg(form, id, msg); ok = false; };
  const data = { type: { url: 'm3u-url', file: 'm3u-file', xtream: 'xtream' }[type] };

  if (type === 'url') {
    const raw = val('src-url');
    if (raw || !editing) {
      const r = validateSourceUrl(raw);
      if (!r.ok) fail('src-url', r.error); else data.url = r.url;
    }
    data.refreshHours = Number(val('src-url-refresh'));
  } else if (type === 'xtream') {
    const raw = val('src-server');
    const r = validateSourceUrl(raw, { kind: 'xtream' });
    if (!r.ok) fail('src-server', r.error); else data.server = r.url;
    data.username = val('src-user');
    data.password = form.querySelector('#src-pass').value; // passwords podem ter espaços
    if (!editing && !data.username) fail('src-user', 'O utilizador é obrigatório.');
    if (!editing && !data.password) fail('src-pass', 'A password é obrigatória.');
    data.refreshHours = Number(val('src-xt-refresh'));
  } else if (!editing) {
    const file = form.querySelector('#src-file')?.files?.[0];
    if (!file) { setMsg(form, 'src-file', 'Escolha um ficheiro M3U.'); ok = false; }
    else if (file.size === 0) { setMsg(form, 'src-file', 'O ficheiro está vazio.'); ok = false; }
    else if (file.size > MAX_FILE_MB * 1_048_576) { setMsg(form, 'src-file', `Ficheiro demasiado grande (máximo ${MAX_FILE_MB} MB).`); ok = false; }
    data.file = file;
    data.fileName = file?.name;
    data.fileSize = file?.size;
  }

  const name = val('src-name') || form.querySelector('#src-name').placeholder;
  if (!name || name === 'Ex.: Casa') fail('src-name', 'Dê um nome à lista.');
  data.name = name;
  return { ok, data };
}

function showTestResult(form, result) {
  const slot = form.querySelector('[data-test-result]');
  if (!result) { render(slot, ''); return; }
  render(slot, html`
    <div class="notice ${result.ok ? 'notice--success' : 'notice--error'}" role="status">
      ${icon(result.ok ? 'check' : 'alert', { size: 'sm' })}
      <div class="notice__body">
        <div class="notice__title">${result.title}</div>
        ${result.detail}
        ${result.hint ? html`<div class="notice__hint">${result.hint}</div>` : ''}
      </div>
    </div>`);
}

function mountForm(body, sheet, { source, onSaved }) {
  const form = body.querySelector('[data-source-form]');
  const editing = Boolean(source);

  const validateUrlField = (id, kind) => {
    const input = form.querySelector(`#${id}`);
    if (!input.value.trim()) { setMsg(form, id, ''); return; }
    const r = validateSourceUrl(input.value, { kind });
    if (!r.ok) setMsg(form, id, r.error);
    else if (r.warning) setMsg(form, id, r.warning, 'warning');
    else setMsg(form, id, kind === 'xtream' ? `Servidor: ${r.url}` : 'Endereço válido.', 'ok');
    const name = form.querySelector('#src-name');
    if (r.ok && !name.value) name.placeholder = new URL(r.url).hostname;
  };

  const offs = [
    on(form, 'click', '[data-seg="type"]', (e, b) => {
      form.dataset.type = b.dataset.value;
      setSegmented(form, 'type', b.dataset.value);
      for (const p of form.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== b.dataset.value;
      form.querySelector('[data-test]').hidden = b.dataset.value === 'file';
      showTestResult(form, null);
    }),
    on(form, 'blur', '#src-url', () => validateUrlField('src-url', 'playlist'), true),
    on(form, 'blur', '#src-server', () => validateUrlField('src-server', 'xtream'), true),
    on(form, 'input', 'input', (e, input) => { if (input.getAttribute('aria-invalid') === 'true') setMsg(form, input.id, ''); }),
    on(form, 'click', '[data-toggle-pass]', (e, btn) => {
      const input = form.querySelector('#src-pass');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'Ocultar password' : 'Mostrar password');
      btn.querySelector('svg').outerHTML = icon(show ? 'eyeOff' : 'eye', { size: 'sm' }).value;
    }),
    on(form, 'change', '#src-file', (e, input) => {
      const file = input.files?.[0];
      const label = form.querySelector('[data-file-label]');
      if (!file) { label.textContent = 'Escolher ficheiro M3U'; setMsg(form, 'src-file', ''); return; }
      label.textContent = file.name;
      label.className = 'file-drop__name';
      if (file.size === 0) setMsg(form, 'src-file', 'O ficheiro está vazio.');
      else if (file.size > MAX_FILE_MB * 1_048_576) setMsg(form, 'src-file', `Ficheiro demasiado grande (máximo ${MAX_FILE_MB} MB).`);
      else if (!/\.(m3u8?|txt)$/i.test(file.name)) setMsg(form, 'src-file', 'Extensão invulgar: confirme que é uma lista M3U.', 'warning');
      else setMsg(form, 'src-file', `${formatBytes(file.size)} · pronto a importar.`, 'ok');
      const name = form.querySelector('#src-name');
      if (!name.value) name.placeholder = file.name.replace(/\.(m3u8?|txt)$/i, '');
    }),
    on(form, 'click', '[data-test]', async (e, btn) => {
      const { ok, data } = readForm(form, { editing });
      const needsStored = editing && ((data.type === 'm3u-url' && !data.url) || (data.type === 'xtream' && (!data.username || !data.password)));
      if (!ok && !needsStored) return;
      btn.disabled = true;
      btn.querySelector('span').textContent = 'A testar…';
      showTestResult(form, null);
      try {
        const input = needsStored ? { ...(await getCredentials(source)), ...Object.fromEntries(Object.entries(data).filter(([, v]) => v)) } : data;
        const r = await testConnection({ ...input, type: data.type });
        showTestResult(form, { ok: true, title: r.title, detail: r.detail });
      } catch (err) {
        showTestResult(form, { ok: false, title: 'Falhou', detail: err.message, hint: err.hint });
      } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Testar ligação';
      }
    }),
    on(form, 'submit', 'form', async (e) => {
      e.preventDefault();
      const { ok, data } = readForm(form, { editing });
      if (!ok) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        if (editing) {
          const secrets = data.type === 'm3u-url' ? (data.url ? { url: data.url } : null)
            : data.type === 'xtream' ? { server: data.server, username: data.username, password: data.password } : null;
          await updateSource(source.id, { name: data.name, refreshHours: data.refreshHours ?? source.refreshHours }, secrets);
          sheet.close();
          toast('Lista atualizada', { type: 'success' });
          const credentialsChanged = Boolean(data.url || data.username || data.password || (data.server && data.server !== source.server));
          onSaved?.(source.id, { credentialsChanged });
        } else {
          const created = await createSource(data);
          sheet.close();
          onSaved?.(created.id);
          openImportSheet(created.id, { file: data.file });
        }
      } catch (err) {
        submit.disabled = false;
        showTestResult(form, { ok: false, title: 'Não foi possível guardar', detail: err.message });
      }
    }),
  ];
  return () => offs.forEach((off) => off());
}

/** Abre o formulário de criação (sem `source`) ou edição. */
export function openSourceForm({ source, initialType, onSaved } = {}) {
  openSheet({
    title: source ? 'Editar lista' : 'Adicionar lista',
    content: formMarkup({ source, initialType }),
    onMount: (body, sheet) => mountForm(body, sheet, { source, onSaved }),
  });
}
