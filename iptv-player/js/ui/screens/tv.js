/** TV em direto — categorias, pesquisa, ordenação, vista lista/grelha virtualizada. */
import { html, render, on } from '../../core/dom.js';
import { formatCount } from '../../core/format.js';
import { catalog } from '../../data/catalog.js';
import { favorites } from '../../data/favorites.js';
import { prefs } from '../../data/prefs.js';
import { screenHeader, mountHeader } from '../components/header.js';
import { segmented, setSegmented, chips, setChips, searchField, bindSearch } from '../components/controls.js';
import { channelRow, channelTile, emptyState, skeletonRows } from '../components/cards.js';
import { createVirtualList } from '../components/virtual-list.js';
import { bindCommonActions } from '../shared.js';

const LIST_METRICS = (w) => ({ columns: w >= 720 ? 2 : 1, rowHeight: 72, gap: 8 });
const GRID_METRICS = (w) => ({ columns: Math.max(3, Math.floor((w + 8) / (104 + 8))), rowHeight: 152, gap: 8 });

export async function renderScreen(ctx) {
  const { outlet } = ctx;
  render(outlet, html`${screenHeader({ title: 'TV' })}${skeletonRows(8)}`);

  const [status, categories] = await Promise.all([catalog.status(), catalog.channelCategories()]);
  if (!ctx.isActive()) return;

  const offs = [bindCommonActions(outlet, ctx)];

  if (status.counts.live === 0) {
    render(outlet, html`${screenHeader({ title: 'TV' })}${emptyState({
      iconName: 'tv',
      title: 'Sem canais',
      text: 'Ainda não existem canais. Adicione uma lista IPTV nas Definições.',
      actions: html`<a class="btn btn--primary btn--block" href="#/settings/sources?add=1">Adicionar lista</a>`,
    })}`);
    offs.push(mountHeader(outlet));
    return () => offs.forEach((off) => off());
  }

  const validCats = new Set(['all', 'fav', ...categories.map((c) => c.id)]);
  const state = {
    category: validCats.has(ctx.query.cat) ? ctx.query.cat : 'all',
    query: '',
    sort: prefs.get('tvSort'),
    view: prefs.get('tvView'),
  };

  const chipOptions = [
    { value: 'all', label: 'Todos', count: status.counts.live },
    { value: 'fav', label: 'Favoritos' },
    ...categories.map((c) => ({ value: c.id, label: c.name, count: c.count })),
  ];

  render(outlet, html`
    ${screenHeader({ title: 'TV' })}
    <div class="stack stack--sm">
      ${searchField({ id: 'tv-search', placeholder: 'Pesquisar canais' })}
      ${chips('cat', chipOptions, state.category, { label: 'Categorias' })}
      <div class="toolbar">
        <span class="toolbar__count" aria-live="polite" data-count></span>
        <div class="toolbar__group">
          ${segmented('sort', [
            { value: 'list', label: 'Lista' },
            { value: 'az', label: 'A–Z' },
          ], state.sort, { label: 'Ordenação' })}
          ${segmented('view', [
            { value: 'list', label: 'Vista em lista', icon: 'list', iconOnly: true },
            { value: 'grid', label: 'Vista em grelha', icon: 'grid', iconOnly: true },
          ], state.view, { label: 'Vista' })}
        </div>
      </div>
      <div data-empty></div>
      <div data-list></div>
    </div>`);

  const listEl = outlet.querySelector('[data-list]');
  const emptyEl = outlet.querySelector('[data-empty]');
  const countEl = outlet.querySelector('[data-count]');

  const renderItem = (ch) => {
    const opts = { isFav: favorites.has('live', ch.id) };
    return state.view === 'grid' ? channelTile(ch, opts) : channelRow(ch, opts);
  };
  const vlist = createVirtualList(listEl, {
    metrics: state.view === 'grid' ? GRID_METRICS : LIST_METRICS,
    renderItem,
    label: 'Canais',
  });
  let currentVlist = vlist;

  function rebuildList() {
    currentVlist.destroy();
    currentVlist = createVirtualList(listEl, {
      metrics: state.view === 'grid' ? GRID_METRICS : LIST_METRICS,
      renderItem,
      label: 'Canais',
    });
  }

  let seq = 0;
  async function load() {
    const my = ++seq;
    const list = await catalog.channels({ category: state.category, query: state.query, sort: state.sort });
    if (my !== seq || !ctx.isActive()) return;
    countEl.textContent = formatCount(list.length, 'canal', 'canais');
    currentVlist.setItems(list);
    if (list.length === 0) {
      render(emptyEl, emptyState({
        compact: true,
        iconName: state.category === 'fav' && !state.query ? 'heart' : 'search',
        title: state.query ? 'Sem resultados' : state.category === 'fav' ? 'Sem favoritos' : 'Categoria vazia',
        text: state.query
          ? `Nenhum canal corresponde a "${state.query}".`
          : state.category === 'fav' ? 'Toque no coração de um canal para o adicionar aos favoritos.' : '',
      }));
    } else {
      render(emptyEl, '');
    }
  }

  offs.push(bindSearch(outlet, (q) => { state.query = q; load(); }));
  offs.push(on(outlet, 'click', '[data-chip="cat"]', (e, b) => {
    state.category = b.dataset.value;
    setChips(outlet, 'cat', state.category);
    // Atualiza o URL sem disparar nova navegação (mantém pesquisa e scroll)
    history.replaceState(null, '', state.category === 'all' ? '#/tv' : `#/tv?cat=${encodeURIComponent(state.category)}`);
    load();
  }));
  offs.push(on(outlet, 'click', '[data-seg="sort"]', (e, b) => {
    state.sort = b.dataset.value;
    prefs.set('tvSort', state.sort);
    setSegmented(outlet, 'sort', state.sort);
    load();
  }));
  offs.push(on(outlet, 'click', '[data-seg="view"]', (e, b) => {
    if (state.view === b.dataset.value) return;
    state.view = b.dataset.value;
    prefs.set('tvView', state.view);
    setSegmented(outlet, 'view', state.view);
    rebuildList();
    load();
  }));

  const offFav = favorites.on(() => {
    if (state.category === 'fav') load();
    else currentVlist.refresh();
  });

  offs.push(mountHeader(outlet));
  await load();

  return () => { offFav(); currentVlist.destroy(); offs.forEach((off) => off()); };
}

export const tvScreen = { render: renderScreen };
