/**
 * Cabeçalho de ecrã ao estilo iOS: "large title" que, ao fazer scroll, dá lugar
 * a um título compacto numa barra translúcida fixa.
 */
import { html } from '../../core/dom.js';
import { icon } from './icons.js';

/**
 * @param {{title: string, eyebrow?: string, back?: {fallback: string, label?: string},
 *          actions?: import('../../core/dom.js').SafeHtml, large?: boolean}} opts
 */
export function screenHeader({ title, eyebrow, back, actions, large = true }) {
  return html`
    <header class="screen-header ${large ? '' : 'screen-header--compact'}">
      <div class="screen-header__bar">
        <div class="screen-header__lead">
          ${back ? html`
            <button class="icon-btn icon-btn--accent" type="button" data-action="back" data-fallback="${back.fallback}" aria-label="${back.label ?? 'Voltar'}">
              ${icon('chevronLeft')}
            </button>` : ''}
        </div>
        <div class="screen-header__compact truncate" aria-hidden="${large ? 'true' : 'false'}">${title}</div>
        <div class="screen-header__actions">${actions ?? ''}</div>
      </div>
    </header>
    ${large ? html`<h1 class="large-title">${eyebrow ? html`<span class="large-title__eyebrow">${eyebrow}</span>` : ''}${title}</h1>` : ''}`;
}

/**
 * Ativa o comportamento de scroll do cabeçalho.
 * O "sentinel" é o large title ou, em páginas de detalhe, um elemento marcado
 * com [data-header-sentinel] (ex.: o hero).
 */
export function mountHeader(outlet) {
  const header = outlet.querySelector('.screen-header');
  const sentinel = outlet.querySelector('[data-header-sentinel]') ?? outlet.querySelector('.large-title');
  if (!header) return () => {};
  if (!sentinel) { header.classList.add('is-stuck'); return () => {}; }

  const headerHeight = header.getBoundingClientRect().height || 52;
  const io = new IntersectionObserver(
    ([entry]) => header.classList.toggle('is-stuck', !entry.isIntersecting),
    { rootMargin: `-${Math.round(headerHeight)}px 0px 0px 0px`, threshold: 0 },
  );
  io.observe(sentinel);
  return () => io.disconnect();
}
