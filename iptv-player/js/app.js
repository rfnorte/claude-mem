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
import { sourcesScreen, sourceDetailScreen } from './ui/screens/sources.js';
import { refreshDueSources, syncEvents } from './iptv/source-sync.js';
import { getSource } from './data/sources.js';
import { prefs } from './data/prefs.js';
import { toast } from './ui/components/toast.js';
import { formatCount } from './core/format.js';

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
  { path: '/settings/sources/:id', tab: 'settings', screen: sourceDetailScreen },
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

  // Imagens externas (logótipos/capas): só aparecem depois de carregadas; se falharem são
  // removidas e fica visível o fallback gerado (iniciais / arte).
  document.addEventListener('load', (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.hasAttribute('data-fallback')) t.classList.add('is-loaded');
  }, true);
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

  // Resultado de importações (também as que continuam com o painel fechado).
  syncEvents.on('done', async ({ sourceId, summary }) => {
    const s = await getSource(sourceId);
    const total = [summary.live && formatCount(summary.live, 'canal', 'canais'), summary.movie && formatCount(summary.movie, 'filme', 'filmes'), summary.series && formatCount(summary.series, 'série', 'séries')].filter(Boolean).join(', ');
    if (!document.querySelector('[data-import-body]')) toast(`«${s?.name ?? 'Lista'}» atualizada: ${total || 'sem conteúdos'}`, { type: 'success' });
    // Com listas reais, o modo demonstração deixa de fazer sentido.
    if (prefs.get('demo')) { prefs.set('demo', false); toast('Modo demonstração desativado: a mostrar as suas listas.'); }
    // Ecrãs de conteúdos visíveis passam a mostrar os dados novos (sem interromper painéis abertos).
    const onContent = /^\/(home|tv|movies|series)$/.test(router.current.path);
    if (onContent && !document.querySelector('.overlay-root')) router.refresh();
  });
  syncEvents.on('error', async ({ sourceId, error }) => {
    if (document.querySelector('[data-import-body]')) return;
    const s = await getSource(sourceId);
    toast(`Falha ao atualizar «${s?.name ?? 'lista'}»: ${error.message}`, { type: 'error', duration: 6000, action: { label: 'Ver', onClick: () => router.go(`/settings/sources/${encodeURIComponent(sourceId)}`) } });
  });

  // Atualização automática: o iOS não permite tarefas em segundo plano, por isso verifica-se ao abrir.
  const checkDue = () => refreshDueSources({ onStart: (s) => toast(`A atualizar «${s.name}»…`, { duration: 2500 }) }).catch(() => {});
  setTimeout(checkDue, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDue(); });
}

start();
