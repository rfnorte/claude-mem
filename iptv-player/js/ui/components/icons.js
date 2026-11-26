/**
 * Conjunto de ícones próprio (traço 1.75, grelha 24×24, cantos arredondados).
 * Markup estático e de confiança → seguro para `raw()`.
 */
import { raw, escapeHtml } from '../../core/dom.js';

const P = {
  home: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4.25v-5.25h-5.5v5.25H5A1.5 1.5 0 0 1 3.5 19z"/>',
  tv: '<rect x="2.75" y="5.5" width="18.5" height="12.5" rx="2.5"/><path d="M8 21h8M8.5 2.75 12 5.5l3.5-2.75"/>',
  film: '<rect x="3.25" y="3.25" width="17.5" height="17.5" rx="2.5"/><path d="M7.5 3.25v17.5M16.5 3.25v17.5M3.25 8h4.25M3.25 12h17.5M3.25 16h4.25M16.5 8h4.25M16.5 16h4.25"/>',
  series: '<rect x="2.75" y="7.25" width="18.5" height="13" rx="2.5"/><path d="M5.5 4h13M8 1.25h8"/><path d="m10 11 4.5 2.75L10 16.5z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="10.75" cy="10.75" r="6.75"/><path d="m20.5 20.5-4.9-4.9"/>',
  heart: '<path d="M12 20.25s-7.75-4.6-7.75-10.4A4.35 4.35 0 0 1 8.6 5.5c1.45 0 2.65.7 3.4 1.85.75-1.15 1.95-1.85 3.4-1.85a4.35 4.35 0 0 1 4.35 4.35c0 5.8-7.75 10.4-7.75 10.4z"/>',
  heartFill: '<path fill="currentColor" d="M12 20.25s-7.75-4.6-7.75-10.4A4.35 4.35 0 0 1 8.6 5.5c1.45 0 2.65.7 3.4 1.85.75-1.15 1.95-1.85 3.4-1.85a4.35 4.35 0 0 1 4.35 4.35c0 5.8-7.75 10.4-7.75 10.4z"/>',
  play: '<path fill="currentColor" d="M7.5 4.9v14.2a1 1 0 0 0 1.52.85l11.36-7.1a1 1 0 0 0 0-1.7L9.02 4.05A1 1 0 0 0 7.5 4.9z" stroke="none"/>',
  list: '<path d="M8.5 6h12M8.5 12h12M8.5 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.75"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.75"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.75"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.75"/>',
  chevronRight: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  chevronLeft: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
  chevronDown: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  closeCircle: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" opacity=".35"/><path d="m9 9 6 6M15 9l-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.36 0l3-3a4.5 4.5 0 0 0-6.36-6.36l-1.25 1.25"/><path d="M14 10a4.5 4.5 0 0 0-6.36 0l-3 3a4.5 4.5 0 0 0 6.36 6.36l1.25-1.25"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  server: '<rect x="3.5" y="3.5" width="17" height="7" rx="2"/><rect x="3.5" y="13.5" width="17" height="7" rx="2"/><path d="M7.5 7h.01M7.5 17h.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.75h7a2 2 0 0 0 2-1.75l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
  alert: '<path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  sparkles: '<path d="M12 3.5 13.6 8.4 18.5 10l-4.9 1.6L12 16.5l-1.6-4.9L5.5 10l4.9-1.6z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.9 3.7M6.6 6.7C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  addSquare: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v4.5H8M12 8v4.5l3 1.5"/>',
};

export function icon(name, { size = '', label = '' } = {}) {
  const body = P[name] ?? P.info;
  const cls = size ? `icon icon--${size}` : 'icon';
  const a11y = label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"';
  return raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y} focusable="false">${body}</svg>`);
}
