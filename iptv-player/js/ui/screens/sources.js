/**
 * Gestão de listas IPTV.
 * Fase 2: interface completa do formulário com validação real dos campos.
 * A gravação/importação é ligada na Fase 3 (motor de importação + IndexedDB);
 * até lá o botão Guardar está desativado com a razão indicada.
 */
import { html, render, on } from '../../core/dom.js';
import { validateSourceUrl, validateRequired } from '../../core/validate.js';
import { screenHeader, mountHeader } from '../components/header.js';
import { segmented, setSegmented } from '../components/controls.js';
import { emptyState } from '../components/cards.js';
import { icon } from '../components/icons.js';
import { openSheet } from '../components/overlay.js';
import { bindCommonActions } from '../shared.js';

const MAX_FILE_MB = 200;

function field({ id, label, type = 'text', placeholder = '', inputmode, autocomplete = 'off', hint, action }) {
  return html`
    <div class="field">
      <label class="field__label" for="${id}">${label}</label>
      <div class="field__control">
        <input class="input ${action ? 'input--with-action' : ''}" id="${id}" name="${id}" type="${type}" placeholder="${placeholder}"
          ${inputmode ? html`inputmode="${inputmode}"` : ''} autocomplete="${autocomplete}" autocapitalize="off" autocorrect="off" spellcheck="false"
          aria-describedby="${id}-msg">
        ${action ?? ''}
      </div>
      <p class="field__msg" id="${id}-msg" data-msg-for="${id}"></p>
      ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
    </div>`;
}

function refreshSelect(id) {
  return html`
    <div class="field">
      <label class="field__label" for="${id}">Atualização automática</label>
      <div class="select-wrap">
        <select class="input" id="${id}" name="${id}">
          <option value="0">Desligada (só manual)</option>
          <option value="12">A cada 12 horas</option>
          <option value="24" selected>Diária</option>
          <option value="168">Semanal</option>
        </select>
        ${icon('chevronDown', { size: 'sm' })}
      </div>
      <p class="field__hint">Verificada ao abrir a app. O iOS não permite atualizações em segundo plano.</p>
    </div>`;
}

function addSourceForm() {
  return html`
    <form class="form" novalidate data-source-form>
      ${segmented('type', [
        { value: 'url', label: 'URL', icon: 'link' },
        { value: 'file', label: 'Ficheiro', icon: 'file' },
        { value: 'xtream', label: 'Xtream', icon: 'server' },
      ], 'url', { label: 'Tipo de lista', block: true })}

      ${field({ id: 'src-name', label: 'Nome da lista', placeholder: 'Ex.: Casa' })}

      <div class="form" data-panel="url">
        ${field({ id: 'src-url', label: 'Endereço M3U / M3U8', type: 'url', inputmode: 'url', placeholder: 'https://servidor.com/lista.m3u' })}
        ${refreshSelect('src-url-refresh')}
      </div>

      <div class="form" data-panel="file" hidden>
        <label class="file-drop">
          <input type="file" id="src-file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,audio/mpegurl,application/x-mpegurl,application/vnd.apple.mpegurl">
          ${icon('file', { size: 'lg' })}
          <span data-file-label>Escolher ficheiro M3U</span>
          <span class="field__hint">Na app Ficheiros, iCloud Drive ou transferências.</span>
        </label>
        <p class="field__msg" data-msg-for="src-file"></p>
        <p class="field__hint">Funciona sempre, mesmo com fornecedores que bloqueiam o acesso a partir do browser. Para atualizar, importe de novo o ficheiro.</p>
      </div>

      <div class="form" data-panel="xtream" hidden>
        ${field({ id: 'src-server', label: 'Servidor', type: 'url', inputmode: 'url', placeholder: 'http://servidor.com:8080' })}
        ${field({ id: 'src-user', label: 'Utilizador', autocomplete: 'username' })}
        ${field({ id: 'src-pass', label: 'Password', type: 'password', autocomplete: 'current-password',
          action: html`<button class="icon-btn field__action" type="button" data-toggle-pass aria-label="Mostrar password" aria-pressed="false">${icon('eye', { size: 'sm' })}</button>` })}
        ${refreshSelect('src-xt-refresh')}
        <div class="notice">
          ${icon('shield', { size: 'sm' })}
          <div class="notice__body">A password será guardada cifrada neste dispositivo e nunca é incluída em backups sem autorização. Uma app web não tem acesso ao Keychain do iOS.</div>
        </div>
      </div>

      <div class="notice notice--warning">
        ${icon('info', { size: 'sm' })}
        <div class="notice__body"><div class="notice__title">Importação na Fase 3</div>A validação dos campos já funciona. A gravação e a importação de canais são ativadas com o motor de importação.</div>
      </div>
      <button class="btn btn--primary btn--lg btn--block" type="submit" disabled>Guardar lista</button>
    </form>`;
}

function setMsg(form, id, text, type = 'error') {
  const el = form.querySelector(`[data-msg-for="${id}"]`);
  const input = form.querySelector(`#${id}`);
  if (el) {
    el.className = `field__msg field__msg--${type}`;
    el.textContent = text ?? '';
  }
  if (input) input.setAttribute('aria-invalid', text && type === 'error' ? 'true' : 'false');
}

function mountForm(body) {
  const form = body.querySelector('[data-source-form]');
  let type = 'url';

  const showPanel = (next) => {
    type = next;
    setSegmented(form, 'type', type);
    for (const p of form.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== type;
  };

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
    on(form, 'click', '[data-seg="type"]', (e, b) => showPanel(b.dataset.value)),
    on(form, 'blur', '#src-url', () => validateUrlField('src-url', 'playlist'), true),
    on(form, 'blur', '#src-server', () => validateUrlField('src-server', 'xtream'), true),
    on(form, 'blur', '#src-user', (e, input) => setMsg(form, 'src-user', input.value ? null : validateRequired('', 'O utilizador')), true),
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
      const mb = file.size / 1_048_576;
      if (file.size === 0) setMsg(form, 'src-file', 'O ficheiro está vazio.');
      else if (mb > MAX_FILE_MB) setMsg(form, 'src-file', `Ficheiro demasiado grande (${mb.toFixed(0)} MB; máximo ${MAX_FILE_MB} MB).`);
      else if (!/\.(m3u8?|txt)$/i.test(file.name)) setMsg(form, 'src-file', 'Extensão invulgar: confirme que é uma lista M3U.', 'warning');
      else setMsg(form, 'src-file', `${mb < 1 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${mb.toFixed(1)} MB`} · pronto para importar na Fase 3.`, 'ok');
      const name = form.querySelector('#src-name');
      if (!name.value) name.placeholder = file.name.replace(/\.(m3u8?|txt)$/i, '');
    }),
    on(form, 'submit', 'form', (e) => e.preventDefault()),
  ];
  return () => offs.forEach((off) => off());
}

function openAddSheet() {
  openSheet({ title: 'Adicionar lista', content: addSourceForm(), onMount: mountForm });
}

async function renderScreen(ctx) {
  const { outlet } = ctx;
  render(outlet, html`
    ${screenHeader({
      title: 'Listas IPTV',
      back: { fallback: '/settings', label: 'Voltar às definições' },
      actions: html`<button class="icon-btn icon-btn--accent" type="button" data-action="add-source" aria-label="Adicionar lista">${icon('plus')}</button>`,
    })}
    ${emptyState({
      iconName: 'layers',
      title: 'Nenhuma lista configurada',
      text: 'Adicione uma lista M3U por endereço ou ficheiro, ou uma conta Xtream Codes do seu fornecedor.',
      actions: html`<button class="btn btn--gradient btn--lg btn--block" type="button" data-action="add-source">${icon('plus', { size: 'sm' })}<span>Adicionar lista</span></button>`,
    })}
    <div class="notice">
      ${icon('info', { size: 'sm' })}
      <div class="notice__body">Use apenas listas e serviços que está autorizado a utilizar. A app não inclui canais nem conteúdos.</div>
    </div>`);

  const offs = [
    bindCommonActions(outlet, ctx),
    mountHeader(outlet),
    on(outlet, 'click', '[data-action="add-source"]', openAddSheet),
  ];
  if (ctx.query.add === '1') {
    history.replaceState(null, '', '#/settings/sources');
    openAddSheet();
  }
  return () => offs.forEach((off) => off());
}

export const sourcesScreen = { render: renderScreen };
