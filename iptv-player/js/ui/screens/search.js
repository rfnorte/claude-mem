/** Pesquisa global — canais, filmes e séries, com resultados instantâneos. */
import { html, render } from '../../core/dom.js';
import { catalog } from '../../data/catalog.js';
import { favorites } from '../../data/favorites.js';
import { screenHeader, mountHeader } from '../components/header.js';
import { searchField, bindSearch } from '../components/controls.js';
import { channelRow, posterCard, emptyState, section, rail } from '../components/cards.js';
import { bindCommonActions } from '../shared.js';

function results({ channels, movies, series }, query) {
  if (!query || query.length < 2) {
    return emptyState({ compact: true, iconName: 'search', title: 'Pesquisar em tudo', text: 'Escreva pelo menos 2 letras para procurar canais, filmes e séries.' });
  }
  if (!channels.length && !movies.length && !series.length) {
    return emptyState({ compact: true, iconName: 'search', title: 'Sem resultados', text: `Nada corresponde a "${query}".` });
  }
  return html`
    <div class="stack">
      ${channels.length ? section(`Canais (${channels.length})`, html`<div class="stack stack--sm search-channels">${channels.slice(0, 8).map((c) => channelRow(c, { isFav: favorites.has('live', c.id) }))}</div>`) : ''}
      ${movies.length ? section(`Filmes (${movies.length})`, rail(movies.map((m) => posterCard(m, { href: `#/movies/${encodeURIComponent(m.id)}` })))) : ''}
      ${series.length ? section(`Séries (${series.length})`, rail(series.map((s) => posterCard(s, { href: `#/series/${encodeURIComponent(s.id)}` })))) : ''}
    </div>`;
}

async function renderScreen(ctx) {
  const { outlet } = ctx;
  const initial = (ctx.query.q ?? '').slice(0, 100);
  render(outlet, html`
    ${screenHeader({ title: 'Pesquisa', back: { fallback: '/home' } })}
    <div class="stack stack--sm">
      ${searchField({ id: 'global-search', placeholder: 'Canais, filmes e séries', value: initial })}
      <div data-results aria-live="polite"></div>
    </div>`);

  const resultsEl = outlet.querySelector('[data-results]');
  let seq = 0;
  const run = async (q) => {
    const my = ++seq;
    const data = await catalog.search(q);
    if (my !== seq || !ctx.isActive()) return;
    render(resultsEl, results(data, q));
    history.replaceState(null, '', q ? `#/search?q=${encodeURIComponent(q)}` : '#/search');
  };

  const offs = [bindCommonActions(outlet, ctx), mountHeader(outlet), bindSearch(outlet, run)];
  await run(initial);
  if (!initial) outlet.querySelector('#global-search').focus({ preventScroll: true });
  return () => offs.forEach((off) => off());
}

export const searchScreen = { render: renderScreen };
