/**
 * Notificações temporárias (toasts), com ação opcional.
 * Região aria-live para leitores de ecrã.
 */
import { html, render } from '../../core/dom.js';
import { icon } from './icons.js';

const ICONS = { info: 'info', success: 'check', error: 'alert', warning: 'alert' };
const MAX_VISIBLE = 3;

export function toast(message, { type = 'info', action, duration = 3500 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return { dismiss() {} };

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  render(el, html`
    <span class="toast__icon">${icon(ICONS[type] ?? 'info')}</span>
    <span class="toast__msg">${message}</span>
    ${action ? html`<button class="btn btn--ghost btn--sm" type="button" data-toast-action>${action.label}</button>` : ''}
  `);

  while (host.children.length >= MAX_VISIBLE) host.firstElementChild.remove();
  host.append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 400);
  };
  if (action) {
    el.querySelector('[data-toast-action]').addEventListener('click', () => { action.onClick?.(); dismiss(); });
  }
  if (duration > 0) timer = setTimeout(dismiss, action ? Math.max(duration, 6000) : duration);
  return { dismiss };
}
