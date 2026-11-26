/**
 * Biblioteca VOD genérica (Filmes e Séries): pesquisa, géneros, ordenação,
 * "continuar a ver" e grelha de capas virtualizada.
 */
import { html, render, on } from '../../core/dom.js';
import { formatCount } from '../../core/format.js';
import { catalog, seasonLabel } from '../../data/catalog.js';
import { favorites } from '../../data/favorites.js';
import { prefs } from '../../data/prefs.js';
import { screenHeader, mountHeader } from '../components/header.js';
import { segmented, setSegmented, chips, setChips, searchField, bindSearch } from '../components/controls.js';
import { posterCard, wideCard, emptyState, section, rail, skeletonRail } from '../components/cards.js';
import { createVirtualList } from '../components/virtual-list.js';
import { bindCommonActions } from '../shared.js';

const GAP = 12;
const POSTER_METRICS = (w) => {
  const columns = Math.max(3, Math.floor((w + GAP) / (110 + GAP)));
  const colWidth = (w - (columns - 1) * GAP) / columns;
  return { columns, rowHeight: Math.round(colWidth * 1.5 + 46), gap: GAP };
};

const SORTS = [
  { value: 'recent', label: 'Recentes' },
  { value: 'az', label: 'A–Z' },
  { value: 'year', label: 'Ano' },
];

/**
 * @param {{kind: 'movie'|'series', title: string, routeBase: string, sortPref: string,
 *          iconName: string, singular: string, plural: string,
 *          genres: () => Promise<any[]>, list: (o: object) => Promise<any[]>, meta?: (item: any) => string}} cfg
 */
export function createLibraryScreen(cfg) {
  const hrefOf = (item) => `#${cfg.routeBase}/${encodeURIComponent(item.id)}`;

  async function renderScreen(ctx) {
    const { outlet } = ctx;
    render(outlet, html`${screenHeader({ title: cfg.title })}<div class="stack">${skeletonRail('poster')}${skeletonRail('poster')}</div>`);

    const [status, genres, cw] = await Promise.all([catalog.status(), cfg.genres(), catalog.continueWatching()]);
    if (!ctx.isActive()) return;
    const offs = [bindCommonActions(outlet, ctx)];

    if (status.counts[cfg.kind] === 0) {
      render(outlet, html`${screenHeader({ title: cfg.title })}${emptyState({
        iconName: cfg.iconName,
        title: `Sem ${cfg.plural}`,
        text: `As suas listas ainda não têm ${cfg.plural}. Adicione uma lista IPTV nas Definições.`,
        actions: html`<a class="btn btn--primary btn--block" href="#/settings/sources?add=1">Adicionar lista</a>`,
      })}`);
      offs.push(mountHeader(outlet));
      return () => offs.forEach((off) => off());
    }

    const validGenres = new Set(['all', 'fav', ...genres.map((g) => g.id)]);
    const state = {
      genre: validGenres.has(ctx.query.genre) ? ctx.query.genre : 'all',
      query: '',
      sort: prefs.get(cfg.sortPref),
    };
    const continueItems = cw.filter((e) => e.item.kind === cfg.kind);

    render(outlet, html`
      ${screenHeader({ title: cfg.title })}
      <div class="stack stack--sm">
        ${searchField({ id: `${cfg.kind}-search`, placeholder: `Pesquisar ${cfg.plural}` })}
        ${chips('genre', [
          { value: 'all', label: 'Todos', count: status.counts[cfg.kind] },
          { value: 'fav', label: 'Favoritos' },
          ...genres.map((g) => ({ value: g.id, label: g.name, count: g.count })),
        ], state.genre, { label: 'Géneros' })}
        <div data-continue class="slot"></div>
        <div class="toolbar">
          <span class="toolbar__count" aria-live="polite" data-count></span>
          ${segmented('sort', SORTS, state.sort, { label: 'Ordenação' })}
        </div>
        <div data-empty></div>
        <div data-grid></div>
      </div>`);

    const countEl = outlet.querySelector('[data-count]');
    const emptyEl = outlet.querySelector('[data-empty]');
    const continueEl = outlet.querySelector('[data-continue]');

    const grid = createVirtualList(outlet.querySelector('[data-grid]'), {
      metrics: POSTER_METRICS,
      label: cfg.title,
      renderItem: (item) => posterCard(item, { href: hrefOf(item), isFav: favorites.has(cfg.kind, item.id), meta: cfg.meta?.(item) }),
    });

    let seq = 0;
    async function load() {
      const my = ++seq;
      const list = await cfg.list({ genre: state.genre, query: state.query, sort: state.sort });
      if (my !== seq || !ctx.isActive()) return;

      const showContinue = continueItems.length > 0 && state.genre === 'all' && !state.query;
      render(continueEl, showContinue
        ? section('Continuar a ver', rail(continueItems.map((e) => wideCard(e.item, e)), { variant: 'wide' }))
        : '');

      countEl.textContent = formatCount(list.length, cfg.singular, cfg.plural);
      grid.setItems(list);
      render(emptyEl, list.length ? '' : emptyState({
        compact: true,
        iconName: state.genre === 'fav' && !state.query ? 'heart' : 'search',
        title: state.query ? 'Sem resultados' : state.genre === 'fav' ? 'Sem favoritos' : 'Sem conteúdos',
        text: state.query ? `Nada corresponde a "${state.query}".`
          : state.genre === 'fav' ? 'Use o botão Favorito na página de detalhe para guardar aqui.' : '',
      }));
    }

    offs.push(bindSearch(outlet, (q) => { state.query = q; load(); }));
    offs.push(on(outlet, 'click', '[data-chip="genre"]', (e, b) => {
      state.genre = b.dataset.value;
      setChips(outlet, 'genre', state.genre);
      history.replaceState(null, '', state.genre === 'all' ? `#${cfg.routeBase}` : `#${cfg.routeBase}?genre=${encodeURIComponent(state.genre)}`);
      load();
    }));
    offs.push(on(outlet, 'click', '[data-seg="sort"]', (e, b) => {
      state.sort = b.dataset.value;
      prefs.set(cfg.sortPref, state.sort);
      setSegmented(outlet, 'sort', state.sort);
      load();
    }));
    const offFav = favorites.on(() => (state.genre === 'fav' ? load() : grid.refresh()));

    offs.push(mountHeader(outlet));
    await load();
    return () => { offFav(); grid.destroy(); offs.forEach((off) => off()); };
  }

  return { render: renderScreen };
}

export const moviesScreen = createLibraryScreen({
  kind: 'movie',
  title: 'Filmes',
  routeBase: '/movies',
  sortPref: 'moviesSort',
  iconName: 'film',
  singular: 'filme',
  plural: 'filmes',
  genres: () => catalog.movieGenres(),
  list: (o) => catalog.movies(o),
});

export const seriesScreen = createLibraryScreen({
  kind: 'series',
  title: 'Séries',
  routeBase: '/series',
  sortPref: 'seriesSort',
  iconName: 'series',
  singular: 'série',
  plural: 'séries',
  genres: () => catalog.seriesGenres(),
  list: (o) => catalog.seriesList(o),
  meta: seasonLabel,
});
