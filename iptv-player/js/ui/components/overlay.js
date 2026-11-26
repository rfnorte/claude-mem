/**
 * Sobreposições: painel inferior (sheet) e diálogo de confirmação.
 * Substituem alert()/confirm() nativos. Acessíveis (role=dialog, foco gerido,
 * Escape fecha) e com gesto de arrastar para baixo no sheet.
 */
import { html, render } from '../../core/dom.js';
import { icon } from './icons.js';

const open = new Set();
let lockCount = 0;
let savedScrollY = 0;
let idSeq = 0;

function lockScroll() {
  if (lockCount++ > 0) return;
  savedScrollY = window.scrollY;
  document.body.style.top = `-${savedScrollY}px`;
  document.body.classList.add('is-scroll-locked');
}

function unlockScroll() {
  if (--lockCount > 0) return;
  lockCount = 0;
  document.body.classList.remove('is-scroll-locked');
  document.body.style.top = '';
  window.scrollTo(0, savedScrollY);
}

function host() {
  return document.getElementById('overlays') ?? document.body;
}

function trapFocus(event, container) {
  if (event.key !== 'Tab') return;
  const focusables = [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.offsetParent !== null);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function createOverlay({ className, panelSelector, markup, onClose }) {
  const root = document.createElement('div');
  root.className = className;
  render(root, markup);
  host().append(root);
  lockScroll();

  const panel = root.querySelector(panelSelector);
  const previousFocus = document.activeElement;
  let closed = false;

  const api = {
    root,
    panel,
    close(result) {
      if (closed) return;
      closed = true;
      open.delete(api);
      root.classList.remove('is-open');
      document.removeEventListener('keydown', onKey, true);
      const finish = () => {
        root.remove();
        unlockScroll();
        if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
        onClose?.(result);
      };
      const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-slow')) || 0;
      setTimeout(finish, ms + 20);
    },
  };

  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); api.close(); }
    else trapFocus(event, panel);
  }

  document.addEventListener('keydown', onKey, true);
  root.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('[data-close]')) api.close();
  });

  open.add(api);
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    panel.focus({ preventScroll: true });
  });
  return api;
}

/** Fecha todas as sobreposições (ex.: ao mudar de ecrã). */
export function closeAllOverlays() {
  for (const o of [...open]) o.close();
}

/**
 * Abre um painel inferior.
 * @param {{title: string, content: import('../../core/dom.js').SafeHtml, onMount?: Function, onClose?: Function}} opts
 */
export function openSheet({ title, content, onMount, onClose }) {
  const titleId = `sheet-title-${++idSeq}`;
  let cleanup = null;
  const overlay = createOverlay({
    className: 'overlay-root',
    panelSelector: '.sheet',
    onClose: (r) => { cleanup?.(); onClose?.(r); },
    markup: html`
      <div class="scrim" data-close></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
        <header class="sheet__header">
          <div class="sheet__handle" aria-hidden="true"></div>
          <div class="sheet__titlebar">
            <h2 class="sheet__title truncate" id="${titleId}">${title}</h2>
            <button class="icon-btn" type="button" data-close aria-label="Fechar">${icon('close')}</button>
          </div>
        </header>
        <div class="sheet__body">${content}</div>
      </section>`,
  });

  enableDragToClose(overlay);
  const body = overlay.panel.querySelector('.sheet__body');
  cleanup = onMount?.(body, overlay) ?? null;
  return { close: (r) => overlay.close(r), body };
}

function enableDragToClose(overlay) {
  const header = overlay.panel.querySelector('.sheet__header');
  let startY = 0;
  let startT = 0;
  let dy = 0;
  let dragging = false;

  header.addEventListener('pointerdown', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) return;
    dragging = true;
    startY = e.clientY;
    startT = performance.now();
    dy = 0;
    header.setPointerCapture(e.pointerId);
    overlay.panel.classList.add('is-dragging');
  });
  header.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    overlay.panel.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    overlay.panel.classList.remove('is-dragging');
    overlay.panel.style.transform = '';
    const velocity = dy / Math.max(1, performance.now() - startT);
    if (dy > 120 || velocity > 0.6) overlay.close();
  };
  header.addEventListener('pointerup', end);
  header.addEventListener('pointercancel', end);
}

/**
 * Diálogo de confirmação. Resolve true (confirmado) ou false.
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive = false, iconName }) {
  return new Promise((resolve) => {
    const titleId = `dialog-title-${++idSeq}`;
    const overlay = createOverlay({
      className: 'overlay-root overlay-root--center',
      panelSelector: '.dialog',
      onClose: (result) => resolve(result === true),
      markup: html`
        <div class="scrim" data-close></div>
        <section class="dialog ${destructive ? 'dialog--danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
          <div class="dialog__icon">${icon(iconName ?? (destructive ? 'trash' : 'info'))}</div>
          <h2 class="dialog__title" id="${titleId}">${title}</h2>
          ${message ? html`<p class="dialog__text">${message}</p>` : ''}
          <div class="dialog__actions">
            <button class="btn btn--block ${destructive ? 'btn--danger-solid' : 'btn--primary'}" type="button" data-confirm>${confirmLabel}</button>
            <button class="btn btn--block btn--secondary" type="button" data-close>${cancelLabel}</button>
          </div>
        </section>`,
    });
    overlay.panel.querySelector('[data-confirm]').addEventListener('click', () => overlay.close(true));
  });
}
