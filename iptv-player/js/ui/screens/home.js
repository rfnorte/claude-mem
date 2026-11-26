/** Início — dashboard com conteúdos das listas configuradas. */
import { html, render, on } from '../../core/dom.js';
import { greeting, formatLongDate, formatTime } from '../../core/format.js';
import { catalog, seasonLabel } from '../../data/catalog.js';
import { favorites } from '../../data/favorites.js';
import { prefs } from '../../data/prefs.js';
import { screenHeader, mountHeader } from '../components/header.js';
import { icon } from '../components/icons.js';
import {
  emptyState, section, rail, posterCard, wideCard, logoTile, skeletonRail,
} from '../components/cards.js';
import { bindCommonActions } from '../shared.js';
import { toast } from '../components/toast.js';

const searchAction = html`<a class="icon-btn" href="#/search" aria-label="Pesquisar">${icon('search')}</a>`;

function header(now = new Date()) {
  return screenHeader({
    title: greeting(now),
    eyebrow: `${formatLongDate(now)} · ${formatTime(now)}`,
    actions: searchAction,
  });
}

export function demoBanner() {
  return html`
    <div class="demo-banner" role="note">
      ${icon('sparkles', { size: 'sm' })}
      <span class="demo-banner__text"><b>Modo demonstração.</b> Conteúdos fictícios, sem reprodução.</span>
      <button class="btn btn--ghost btn--sm" type="button" data-action="disable-demo">Desativar</button>
    </div>`;
}

function onboarding() {
  return emptyState({
    iconName: 'sparkles',
    title: 'Bem-vindo ao seu leitor IPTV',
    text: 'Adicione a sua primeira lista M3U ou conta Xtream Codes para começar. As listas e credenciais ficam guardadas apenas neste dispositivo.',
    actions: html`
      <a class="btn btn--gradient btn--lg btn--block" href="#/settings/sources?add=1">${icon('plus', { size: 'sm' })}<span>Adicionar lista</span></a>
      <button class="btn btn--secondary btn--block" type="button" data-action="enable-demo">Explorar com dados de demonstração</button>`,
  });
}

function favSection(favs) {
  if (!favs.length) return '';
  return section('Canais favoritos', rail(favs.map(logoTile), { variant: 'logos' }), { href: '#/tv?cat=fav' });
}

export async function renderScreen(ctx) {
  const { outlet } = ctx;
  render(outlet, html`${header()}<div class="stack">${skeletonRail('wide', 2)}${skeletonRail('poster')}</div>`);

  const status = await catalog.status();
  if (!ctx.isActive()) return;

  const offs = [bindCommonActions(outlet, ctx)];
  offs.push(on(outlet, 'click', '[data-action="enable-demo"]', () => {
    prefs.set('demo', true);
    toast('Modo demonstração ativado', { type: 'success' });
    ctx.router.refresh();
  }));
  offs.push(on(outlet, 'click', '[data-action="disable-demo"]', () => {
    prefs.set('demo', false);
    toast('Modo demonstração desativado');
    ctx.router.refresh();
  }));

  if (!status.hasContent && status.sourceCount > 0) {
    render(outlet, html`${header()}${emptyState({
      iconName: 'layers',
      title: 'As suas listas ainda não têm conteúdos',
      text: 'A importação pode ter falhado ou estar em curso. Consulte o estado em Listas IPTV.',
      actions: html`<a class="btn btn--primary btn--block" href="#/settings/sources">Ver listas</a>`,
    })}`);
  } else if (!status.hasContent) {
    render(outlet, html`${header()}${onboarding()}`);
  } else {
    const [cw, favs, popular, recentMovies, featured, recentLive, cats] = await Promise.all([
      catalog.continueWatching(),
      catalog.favoriteChannels(),
      catalog.popularChannels(),
      catalog.recentMovies(),
      catalog.featuredSeries(),
      catalog.recentChannels(),
      catalog.channelCategories(),
    ]);
    if (!ctx.isActive()) return;

    const sections = [];
    if (status.demo) sections.push(demoBanner());
    if (cw.length) {
      sections.push(section('Continuar a ver', rail(cw.map((e) => wideCard(e.item, e)), { variant: 'wide' })));
    }
    sections.push(html`<div data-slot="favs" class="slot">${favSection(favs)}</div>`);
    if (popular.length) {
      sections.push(section('Canais populares', rail(popular.map(logoTile), { variant: 'logos' }), { href: '#/tv' }));
    }
    if (recentMovies.length) {
      sections.push(section('Filmes adicionados recentemente', rail(recentMovies.map((m) =>
        posterCard(m, { href: `#/movies/${encodeURIComponent(m.id)}`, isFav: favorites.has('movie', m.id) }))), { href: '#/movies' }));
    }
    if (featured.length) {
      sections.push(section('Séries em destaque', rail(featured.map((s) =>
        posterCard(s, { href: `#/series/${encodeURIComponent(s.id)}`, isFav: favorites.has('series', s.id), meta: seasonLabel(s) }))), { href: '#/series' }));
    }
    if (recentLive.length) {
      sections.push(section('Últimos canais vistos', rail(recentLive.map(logoTile), { variant: 'logos' })));
    }
    if (cats.length) {
      sections.push(section('Categorias', html`
        <div class="category-grid">
          ${cats.map((c) => html`
            <a class="category-tile" href="#/tv?cat=${encodeURIComponent(c.id)}">
              <span class="category-tile__name truncate">${c.name}</span>
              <span class="category-tile__count">${c.count}</span>
            </a>`)}
        </div>`));
    }
    render(outlet, html`${header()}<div class="stack">${sections}</div>`);
  }

  offs.push(mountHeader(outlet));

  // Relógio/saudação atualizados sem re-renderizar o ecrã
  const clock = setInterval(() => {
    const now = new Date();
    const eyebrow = outlet.querySelector('.large-title__eyebrow');
    const title = outlet.querySelector('.large-title');
    if (eyebrow && title) {
      eyebrow.textContent = `${formatLongDate(now)} · ${formatTime(now)}`;
      title.lastChild.textContent = greeting(now);
    }
  }, 30_000);

  const offFav = favorites.on(async () => {
    const slot = outlet.querySelector('[data-slot="favs"]');
    if (!slot) return;
    const list = await catalog.favoriteChannels();
    if (ctx.isActive()) render(slot, favSection(list));
  });

  return () => { clearInterval(clock); offFav(); offs.forEach((off) => off()); };
}

export const homeScreen = { render: renderScreen };
