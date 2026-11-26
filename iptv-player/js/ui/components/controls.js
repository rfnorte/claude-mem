/** Controlos de interface: segmentado, chips, pesquisa, interruptor. */
import { html } from '../../core/dom.js';
import { icon } from './icons.js';

/**
 * @param {string} name   identificador (data-seg)
 * @param {{value: string, label: string, icon?: string, iconOnly?: boolean}[]} options
 */
export function segmented(name, options, value, { label, block = false } = {}) {
  return html`
    <div class="segmented ${block ? 'segmented--block' : ''}" role="group" aria-label="${label ?? name}">
      ${options.map((o) => html`
        <button class="segmented__btn" type="button" data-seg="${name}" data-value="${o.value}"
          aria-pressed="${o.value === value ? 'true' : 'false'}" ${o.iconOnly ? html`aria-label="${o.label}"` : ''}>
          ${o.icon ? icon(o.icon, { size: 'sm' }) : ''}${o.iconOnly ? '' : html`<span>${o.label}</span>`}
        </button>`)}
    </div>`;
}

/** Atualiza o estado visual de um segmentado sem re-renderizar. */
export function setSegmented(root, name, value) {
  for (const b of root.querySelectorAll(`[data-seg="${CSS.escape(name)}"]`)) {
    b.setAttribute('aria-pressed', b.dataset.value === value ? 'true' : 'false');
  }
}

/** @param {{value: string, label: string, count?: number}[]} options */
export function chips(name, options, value, { label } = {}) {
  return html`
    <div class="chips bleed" role="group" aria-label="${label ?? name}">
      ${options.map((o) => html`
        <button class="chip" type="button" data-chip="${name}" data-value="${o.value}" aria-pressed="${o.value === value ? 'true' : 'false'}">
          <span>${o.label}</span>${Number.isFinite(o.count) ? html`<span class="chip__count">${o.count}</span>` : ''}
        </button>`)}
    </div>`;
}

export function setChips(root, name, value) {
  for (const b of root.querySelectorAll(`[data-chip="${CSS.escape(name)}"]`)) {
    const active = b.dataset.value === value;
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (active) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

export function searchField({ id, placeholder = 'Pesquisar', value = '', label = 'Pesquisar' }) {
  return html`
    <div class="search-field" role="search">
      <span class="search-field__icon">${icon('search')}</span>
      <label class="sr-only" for="${id}">${label}</label>
      <input class="search-field__input" id="${id}" type="search" inputmode="search" enterkeyhint="search"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        placeholder="${placeholder}" value="${value}">
      <button class="icon-btn search-field__clear" type="button" data-search-clear aria-label="Limpar pesquisa" ${value ? '' : html`hidden`}>
        ${icon('closeCircle', { size: 'sm' })}
      </button>
    </div>`;
}

/**
 * Liga um campo de pesquisa: debounce, botão limpar, tecla Enter fecha o teclado.
 * @returns {() => void} limpeza
 */
export function bindSearch(root, onChange, { delay = 120 } = {}) {
  const input = root.querySelector('.search-field__input');
  const clear = root.querySelector('[data-search-clear]');
  let timer = null;
  const emit = () => onChange(input.value.trim());
  const onInput = () => {
    clear.hidden = input.value.length === 0;
    clearTimeout(timer);
    timer = setTimeout(emit, delay);
  };
  const onClear = () => { input.value = ''; clear.hidden = true; emit(); input.focus(); };
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } };
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKey);
  clear.addEventListener('click', onClear);
  return () => {
    clearTimeout(timer);
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKey);
    clear.removeEventListener('click', onClear);
  };
}

export function switchControl({ id, checked, label }) {
  return html`<input class="switch" type="checkbox" role="switch" id="${id}" ${checked ? html`checked` : ''} aria-label="${label}">`;
}
