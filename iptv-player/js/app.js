/**
 * Arranque da aplicação: barra de navegação, router e handlers globais.
 */
import { html, render } from './core/dom.js';
import { createRouter } from './core/router.js';
import { icon } from './ui/components/icons.js';
import { closeAllOverlays } from './ui/components/overlay.js';
import { emptyState } from './ui/components/cards.js';
import { homeScreen } from './ui/screens/home.js';
import { tvScreen } from './ui/screens/tv.js';
import { moviesScreen, seriesScreen } from './ui/screens/library.js';
import { movieDetailScreen, seriesDetailScreen } from './ui/screens/detail.js';
import { searchScreen } from './ui/screens/search.js';
import { settingsScreen } from './ui/screens/settings.js';
import { sourcesScreen } from './ui/screens/sources.js';

const TABS = [
  { id: 'home', path: '/home', label: 'Início', icon: 'home' },
  { id: 'tv', path: '/tv', label: 'TV', icon: 'tv' },
  { id: 'movies', path: '/movies', label: 'Filmes', icon: 'film' },
  { id: 'series', path: '/series', label: 'Séries', icon: 'series' },
  { id: 'settings', path: '/settings', label: 'Definições', icon: 'settings' },
];

const errorScreen = (ctx) => render(ctx.outlet, emptyState({
  iconName: 'alert',
  title: 'Ocorreu um erro',
  text: 'Não foi possível abrir este ecrã. Tente novamente.',
  actions: html`<a class="btn btn--secondary btn--block" href="#/home">Ir para o Início</a>`,
}));

const routes = [
  { path: '/home', tab: 'home', screen: homeScreen },
  { path: '/tv', tab: 'tv', screen: tvScreen },
  { path: '/movies', tab: 'movies', screen: moviesScreen },
  { path: '/movies/:id', tab: 'movies', screen: movieDetailScreen },
  { path: '/series', tab: 'series', screen: seriesScreen },
  { path: '/series/:id', tab: 'series', screen: seriesDetailScreen },
  { path: '/search', tab: 'home', screen: searchScreen },
  { path: '/settings', tab: 'settings', screen: settingsScreen },
  { path: '/settings/sources', tab: 'settings', screen: sourcesScreen },
].map((r) => ({ ...r, onError: errorScreen }));

function renderTabbar(el) {
  render(el, html`
    <ul class="tabbar__list">
      ${TABS.map((t) => html`
        <li><a class="tabbar__item" href="#${t.path}" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></a></li>`)}
    </ul>`);
}

function setActiveTab(el, tabId) {
  for (const a of el.querySelectorAll('[data-tab]')) {
    if (a.dataset.tab === tabId) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function start() {
  const outlet = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');
  renderTabbar(tabbar);

  // Imagens externas (logótipos/capas) que falham são removidas: fica visível o fallback gerado.
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.hasAttribute('data-fallback')) t.remove();
  }, true);

  const router = createRouter({
    routes,
    outlet,
    fallback: '/home',
    onNavigate({ route }) {
      closeAllOverlays();
      setActiveTab(tabbar, route.tab);
    },
  });

  // Tocar no separador ativo volta ao topo (comportamento iOS).
  tabbar.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('[data-tab]') : null;
    if (a && a.getAttribute('aria-current') === 'page' && location.hash === a.getAttribute('href')) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });

  router.start();
  document.documentElement.classList.add('is-ready');
}

start();
