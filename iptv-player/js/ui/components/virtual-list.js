/**
 * Lista/grelha virtualizada sobre o scroll da janela.
 *
 * Mantém no DOM apenas as linhas visíveis (+ margem), o que permite mostrar
 * dezenas de milhares de canais ou filmes sem esgotar a memória do iPhone.
 *
 * Requisito: todas as linhas têm a mesma altura (dada por `metrics`).
 */
import { html, render } from '../../core/dom.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   metrics: (width: number) => {columns: number, rowHeight: number, gap: number},
 *   renderItem: (item: any, index: number) => import('../../core/dom.js').SafeHtml,
 *   overscan?: number,
 *   label?: string,
 * }} opts
 */
export function createVirtualList(container, { metrics, renderItem, overscan = 4, label }) {
  container.classList.add('vlist');
  container.setAttribute('role', 'list');
  if (label) container.setAttribute('aria-label', label);

  const win = document.createElement('div');
  win.className = 'vlist__window';
  container.replaceChildren(win);

  let items = [];
  let m = { columns: 1, rowHeight: 72, gap: 8 };
  let range = [-1, -1];
  let frame = 0;
  let lastWidth = -1;

  function measure() {
    const width = container.clientWidth;
    lastWidth = width;
    m = metrics(width);
    win.style.gridTemplateColumns = `repeat(${m.columns}, minmax(0, 1fr))`;
    win.style.gridAutoRows = `${m.rowHeight}px`;
    win.style.gap = `${m.gap}px`;
    const rows = Math.ceil(items.length / m.columns);
    container.style.height = rows > 0 ? `${rows * m.rowHeight + (rows - 1) * m.gap}px` : '0px';
    range = [-1, -1];
    update();
  }

  function update() {
    frame = 0;
    const top = container.getBoundingClientRect().top;
    const stride = m.rowHeight + m.gap;
    const rows = Math.ceil(items.length / m.columns);
    const first = Math.max(0, Math.floor(-top / stride) - overscan);
    const last = Math.min(rows, Math.ceil((window.innerHeight - top) / stride) + overscan);
    if (first === range[0] && last === range[1]) return;
    range = [first, last];

    win.style.transform = `translateY(${first * stride}px)`;
    const start = first * m.columns;
    const end = Math.min(items.length, last * m.columns);
    const parts = [];
    for (let i = start; i < end; i++) {
      parts.push(html`<div class="vlist__item" role="listitem" data-index="${i}">${renderItem(items[i], i)}</div>`);
    }
    render(win, html`${parts}`);
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const ro = new ResizeObserver(() => {
    if (container.clientWidth !== lastWidth) measure();
  });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  ro.observe(container);

  return {
    setItems(next) { items = next; measure(); },
    /** Re-renderiza as linhas visíveis (ex.: após alterar um favorito). */
    refresh() { range = [-1, -1]; update(); },
    itemAt: (index) => items[index],
    get length() { return items.length; },
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    },
  };
}
