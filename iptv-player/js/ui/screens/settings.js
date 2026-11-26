/** Definições — fontes, visualização, demonstração, instalação e privacidade. */
import { html, render, on } from '../../core/dom.js';
import { APP_VERSION, APP_STAGE } from '../../config.js';
import { prefs } from '../../data/prefs.js';
import { favorites } from '../../data/favorites.js';
import { listSources } from '../../data/sources.js';
import { deleteDatabase } from '../../data/db.js';
import { resetKeyCache } from '../../data/crypto.js';
import { formatCount } from '../../core/format.js';
import { screenHeader, mountHeader } from '../components/header.js';
import { segmented, setSegmented, switchControl } from '../components/controls.js';
import { icon } from '../components/icons.js';
import { openSheet, confirmDialog } from '../components/overlay.js';
import { toast } from '../components/toast.js';

function cell({ iconName, iconVariant = '', title, subtitle, trailing, href, action, tag = 'div', danger = false }) {
  const inner = html`
    <span class="cell__icon ${iconVariant ? `cell__icon--${iconVariant}` : ''}">${icon(iconName, { size: 'sm' })}</span>
    <span class="cell__body">
      <span class="cell__title">${title}</span>
      ${subtitle ? html`<span class="cell__subtitle">${subtitle}</span>` : ''}
    </span>
    ${trailing ?? ''}`;
  const cls = `cell ${danger ? 'cell--danger' : ''}`;
  if (href) return html`<a class="${cls}" href="${href}">${inner}<span class="cell__chevron">${icon('chevronRight', { size: 'sm' })}</span></a>`;
  if (action) return html`<button class="${cls}" type="button" data-action="${action}">${inner}${danger ? '' : html`<span class="cell__chevron">${icon('chevronRight', { size: 'sm' })}</span>`}</button>`;
  return tag === 'label' ? html`<label class="${cls}">${inner}</label>` : html`<div class="${cls}">${inner}</div>`;
}

function group(title, cells, footer) {
  return html`
    <section class="group">
      ${title ? html`<h2 class="group__title">${title}</h2>` : ''}
      <div class="group__list">${cells}</div>
      ${footer ? html`<p class="group__footer">${footer}</p>` : ''}
    </section>`;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function openInstallSheet() {
  const installed = isStandalone();
  openSheet({
    title: 'Instalar no iPhone',
    content: html`
      ${installed ? html`
        <div class="notice">${icon('check', { size: 'sm' })}<div class="notice__body"><div class="notice__title">A app já está instalada</div>Está a utilizar a versão do ecrã principal.</div></div>` : html`
        <ol class="steps">
          <li class="step"><span class="step__num">1</span><span>Abra esta página no <b>Safari</b>.</span></li>
          <li class="step"><span class="step__num">2</span><span>Toque em <b>Partilhar</b> ${icon('share', { size: 'sm' })} na barra do Safari.</span></li>
          <li class="step"><span class="step__num">3</span><span>Escolha <b>Adicionar ao ecrã principal</b> ${icon('addSquare', { size: 'sm' })}.</span></li>
          <li class="step"><span class="step__num">4</span><span>Toque em <b>Adicionar</b>. O ícone aparece no ecrã principal.</span></li>
        </ol>
        <div class="notice notice--warning">
          ${icon('alert', { size: 'sm' })}
          <div class="notice__body"><div class="notice__title">Instale antes de configurar</div>O Safari e a app instalada têm armazenamentos separados: listas adicionadas no Safari não aparecem na app instalada.</div>
        </div>`}
      <p class="field__hint sheet-note">Ícone definitivo, ecrã de arranque e funcionamento offline ficam completos na Fase 8 (publicação em HTTPS).</p>`,
  });
}

function openStorageInfoSheet() {
  openSheet({
    title: 'Armazenamento e segurança',
    content: html`
      <div class="prose">
        <p>Todos os dados (listas, favoritos, histórico, preferências) ficam <b>apenas neste dispositivo</b>. A app não envia dados para terceiros e não tem publicidade nem rastreadores.</p>
        <p>As passwords Xtream serão guardadas cifradas. No entanto, uma app web <b>não tem acesso ao Porta-chaves (Keychain) do iOS</b>: a cifra protege contra exposição acidental (backups, exportações), mas não equivale a um cofre seguro.</p>
        <p>Recomendação: use uma password exclusiva para o serviço IPTV.</p>
      </div>`,
  });
}

async function renderScreen(ctx) {
  const { outlet } = ctx;
  const sources = await listSources().catch(() => []);
  if (!ctx.isActive()) return;

  render(outlet, html`
    ${screenHeader({ title: 'Definições' })}
    <div class="stack">
      ${group('Fontes', cell({
        iconName: 'layers', title: 'Listas IPTV', href: '#/settings/sources',
        subtitle: sources.length ? formatCount(sources.length, 'lista configurada', 'listas configuradas') : 'Nenhuma lista configurada',
      }))}

      ${group('Visualização', cell({
        iconName: 'grid', title: 'Vista dos canais',
        trailing: segmented('tvView', [
          { value: 'list', label: 'Lista', icon: 'list', iconOnly: true },
          { value: 'grid', label: 'Grelha', icon: 'grid', iconOnly: true },
        ], prefs.get('tvView'), { label: 'Vista dos canais' }),
      }))}

      ${group('Demonstração', cell({
        tag: 'label', iconName: 'sparkles', title: 'Dados de demonstração',
        subtitle: 'Conteúdos fictícios para explorar a interface',
        trailing: switchControl({ id: 'demo-switch', checked: prefs.get('demo'), label: 'Dados de demonstração' }),
      }), 'Os dados de demonstração não incluem streams e não são reproduzíveis.')}

      ${group('Aplicação', html`
        ${cell({ iconName: 'download', title: 'Instalar no iPhone', subtitle: isStandalone() ? 'Instalada' : 'Adicionar ao ecrã principal', action: 'install' })}
        ${cell({ iconName: 'info', iconVariant: 'neutral', title: 'Versão', trailing: html`<span class="cell__value">${APP_VERSION}</span>`, subtitle: APP_STAGE })}`)}

      ${group('Privacidade e dados', html`
        ${cell({ iconName: 'shield', title: 'Armazenamento e segurança', action: 'storage-info' })}
        ${cell({ iconName: 'trash', iconVariant: 'danger', title: 'Eliminar todos os dados locais', action: 'wipe', danger: true })}`,
      'Remove listas, favoritos, histórico e preferências deste dispositivo.')}
    </div>`);

  const offs = [
    mountHeader(outlet),
    on(outlet, 'click', '[data-seg="tvView"]', (e, b) => {
      prefs.set('tvView', b.dataset.value);
      setSegmented(outlet, 'tvView', b.dataset.value);
      toast(b.dataset.value === 'grid' ? 'Canais em grelha' : 'Canais em lista', { duration: 1500 });
    }),
    on(outlet, 'change', '#demo-switch', (e, input) => {
      prefs.set('demo', input.checked);
      toast(input.checked ? 'Modo demonstração ativado' : 'Modo demonstração desativado', { type: input.checked ? 'success' : 'info' });
    }),
    on(outlet, 'click', '[data-action="install"]', openInstallSheet),
    on(outlet, 'click', '[data-action="storage-info"]', openStorageInfoSheet),
    on(outlet, 'click', '[data-action="wipe"]', async () => {
      const ok = await confirmDialog({
        title: 'Eliminar todos os dados?',
        message: 'Listas, favoritos, histórico e preferências serão removidos deste dispositivo. Esta ação não pode ser anulada.',
        confirmLabel: 'Eliminar tudo',
        destructive: true,
      });
      if (!ok) return;
      try {
        await deleteDatabase();
        resetKeyCache();
        if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      } catch (err) {
        toast(`Alguns dados não foram eliminados: ${err.message}`, { type: 'error' });
      }
      prefs.clearAll();
      favorites.clear();
      toast('Todos os dados locais foram eliminados', { type: 'success' });
      ctx.router.go('/home');
    }),
  ];
  return () => offs.forEach((off) => off());
}

export const settingsScreen = { render: renderScreen };
