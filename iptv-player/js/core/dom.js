/**
 * Renderização segura de HTML.
 *
 * Regra do projeto: todo o conteúdo vindo de listas, EPG ou APIs é texto não
 * confiável. O tagged template `html` ESCAPA todos os valores interpolados por
 * omissão. Só markup produzido pela própria app (ícones, componentes) pode ser
 * marcado como seguro através de `html` aninhado ou `raw()` com texto estático.
 *
 * Regras complementares:
 *  - Atributos são sempre escritos entre aspas: class="${x}".
 *  - URLs externos passam sempre por `safeUrl()` antes de entrar num atributo.
 *  - Nunca usar atributos `style` em templates (bloqueados pela CSP): usar
 *    `data-vars` + `hydrate()`.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"'`]/g, (c) => ESCAPES[c]);
}

export class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marca markup ESTÁTICO e de confiança (nunca dados externos). */
export const raw = (markup) => new SafeHtml(String(markup));

function toMarkup(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(toMarkup).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += toMarkup(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Substitui o conteúdo de um elemento e aplica variáveis CSS declaradas. */
export function render(el, template) {
  el.innerHTML = template instanceof SafeHtml ? template.value : escapeHtml(template ?? '');
  hydrate(el);
}

/**
 * Converte `data-vars="art-h:210;progress:40"` em custom properties CSS.
 * Apenas nomes [a-z-] e valores numéricos são aceites (defesa em profundidade).
 */
export function hydrate(root) {
  const nodes = root.querySelectorAll('[data-vars]');
  for (const node of nodes) {
    for (const pair of node.dataset.vars.split(';')) {
      const [name, value] = pair.split(':');
      if (/^[a-z][a-z-]*$/.test(name) && /^-?\d+(\.\d+)?$/.test(value)) {
        node.style.setProperty(`--${name}`, value);
      }
    }
    node.removeAttribute('data-vars');
  }
}

/** Constrói o valor de `data-vars` a partir de um objeto de números. */
export function vars(obj) {
  return Object.entries(obj)
    .filter(([, v]) => Number.isFinite(v))
    .map(([k, v]) => `${k}:${Math.round(v * 100) / 100}`)
    .join(';');
}

/** Devolve o URL normalizado se o protocolo for permitido, senão null. */
export function safeUrl(input, allowed = ['http:', 'https:']) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 4096) return null;
  try {
    const url = new URL(input.trim());
    return allowed.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Delegação de eventos: on(root, 'click', '[data-action]', handler). */
export function on(root, type, selector, handler, options) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(type, listener, options);
  return () => root.removeEventListener(type, listener, options);
}

/** Hash numérico estável (FNV-1a) — usado para cores geradas e chaves. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Iniciais para logótipos sem imagem ("Atlântico Notícias HD" → "AN"). */
export function initials(name) {
  const words = String(name)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(hd|fhd|uhd|4k|sd|tv|pt)$/i.test(w));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
