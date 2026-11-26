/**
 * Gestão de listas IPTV: lista de fontes e página de detalhe de cada fonte
 * (estado, atualizar, editar, ativar/desativar, corrigir categorias, eliminar).
 */
import { html, render, on } from '../../core/dom.js';
import { formatRelative, formatCount, formatBytes } from '../../core/format.js';
import { listSources, getSource, updateSource, deleteSource, SOURCE_TYPES } from '../../data/sources.js';
import { syncEvents, isImporting, reclassifySource } from '../../iptv/source-sync.js';
import { screenHeader, mountHeader } from '../components/header.js';
import { emptyState } from '../components/cards.js';
import { switchControl } from '../components/controls.js';
import { icon } from '../components/icons.js';
import { openSheet, confirmDialog } from '../components/overlay.js';
import { toast } from '../components/toast.js';
import { bindCommonActions } from '../shared.js';
import { openSourceForm } from '../source-form.js';
import { openImportSheet } from '../import-sheet.js';

const TYPE_ICON = { 'm3u-url': 'link', 'm3u-file': 'file', xtream: 'server' };
const KIND_LABEL = { live: 'TV', movie: 'Filmes', episode: 'Séries' };

function statusBadge(source) {
  if (source.status === 'importing' || isImporting(source.id)) return html`<span class="badge badge--accent">A importar</span>`;
  if (source.status === 'error') return html`<span class="badge badge--danger">Erro</span>`;
  if (!source.enabled) return html`<span class="badge badge--neutral">Desativada</span>`;
  if (source.status === 'ok') return html`<span class="badge badge--success">OK</span>`;
  return html`<span class="badge badge--neutral">Por importar</span>`;
}

function countsLine(c) {
  return [
    c?.live ? formatCount(c.live, 'canal', 'canais') : null,
    c?.movie ? formatCount(c.movie, 'filme', 'filmes') : null,
    c?.series ? formatCount(c.series, 'série', 'séries') : null,
  ].filter(Boolean).join(' · ') || 'Sem conteúdos';
}

function sourceCard(s) {
  return html`
    <a class="source-card" href="#/settings/sources/${encodeURIComponent(s.id)}">
      <span class="cell__icon">${icon(TYPE_ICON[s.type] ?? 'layers', { size: 'sm' })}</span>
      <span class="source-card__body">
        <span class="source-card__title"><span class="truncate">${s.name}</span>${statusBadge(s)}</span>
        <span class="source-card__meta truncate">${countsLine(s.counts)}</span>
        <span class="source-card__meta truncate">${SOURCE_TYPES[s.type]}${s.host ? html` · ${s.host}` : ''} · atualizada ${formatRelative(s.lastUpdated)}</span>
      </span>
      <span class="cell__chevron">${icon('chevronRight', { size: 'sm' })}</span>
    </a>`;
}

/* ------------------------------------------------------------------ */
/* Lista de fontes                                                     */
/* ------------------------------------------------------------------ */
async function renderList(ctx) {
  const { outlet } = ctx;
  const addBtn = html`<button class="icon-btn icon-btn--accent" type="button" data-action="add-source" aria-label="Adicionar lista">${icon('plus')}</button>`;

  const paint = async () => {
    const sources = await listSources();
    if (!ctx.isActive()) return;
    render(outlet, html`
      ${screenHeader({ title: 'Listas IPTV', back: { fallback: '/settings', label: 'Voltar às definições' }, actions: addBtn })}
      ${sources.length ? html`
        <div class="stack stack--sm">
          ${sources.map(sourceCard)}
          <button class="btn btn--secondary btn--block" type="button" data-action="add-source">${icon('plus', { size: 'sm' })}<span>Adicionar outra lista</span></button>
        </div>` : emptyState({
        iconName: 'layers',
        title: 'Nenhuma lista configurada',
        text: 'Adicione uma lista M3U por endereço ou ficheiro, ou uma conta Xtream Codes do seu fornecedor.',
        actions: html`<button class="btn btn--gradient btn--lg btn--block" type="button" data-action="add-source">${icon('plus', { size: 'sm' })}<span>Adicionar lista</span></button>`,
      })}
      <div class="notice notice--spaced">
        ${icon('info', { size: 'sm' })}
        <div class="notice__body">Use apenas listas e serviços que está autorizado a utilizar. A app não inclui canais nem conteúdos.</div>
      </div>`);
    offHeader?.();
    offHeader = mountHeader(outlet);
  };

  let offHeader = null;
  await paint();
  const offs = [
    bindCommonActions(outlet, ctx),
    on(outlet, 'click', '[data-action="add-source"]', () => openSourceForm()),
    syncEvents.on('changed', () => { if (ctx.isActive()) paint(); }),
  ];
  if (ctx.query.add === '1') {
    history.replaceState(null, '', '#/settings/sources');
    openSourceForm({ initialType: ctx.query.type === 'file' ? 'file' : undefined });
  }
  return () => { offHeader?.(); offs.forEach((off) => off()); };
}

/* ------------------------------------------------------------------ */
/* Correção de categorias (apenas listas M3U)                          */
/* ------------------------------------------------------------------ */
function openCategoriesSheet(source) {
  const groups = [...(source.groups ?? [])].sort((a, b) => b.count - a.count);
  openSheet({
    title: 'Corrigir categorias',
    content: html`
      <p class="field__hint">A classificação automática pode errar. Escolha o tipo correto de cada categoria da lista; a alteração aplica-se a todos os seus itens e mantém-se nas atualizações.</p>
      <ul class="category-list">
        ${groups.map((g, i) => html`
          <li class="category-row">
            <span class="category-row__body">
              <label class="category-row__name truncate" for="cat-${i}">${g.name}</label>
              <span class="category-row__meta">${formatCount(g.count, 'item', 'itens')} · detetado: ${KIND_LABEL[g.kind] ?? g.kind}</span>
            </span>
            <span class="select-wrap">
              <select class="input input--compact" id="cat-${i}" data-group-index="${i}">
                <option value="" ${!g.override ? html`selected` : ''}>Automático</option>
                <option value="live" ${g.override === 'live' ? html`selected` : ''}>TV</option>
                <option value="movie" ${g.override === 'movie' ? html`selected` : ''}>Filmes</option>
                <option value="episode" ${g.override === 'episode' ? html`selected` : ''}>Séries</option>
              </select>
              ${icon('chevronDown', { size: 'sm' })}
            </span>
          </li>`)}
      </ul>
      <div class="form-actions form-actions--sticky">
        <button class="btn btn--primary btn--lg btn--block" type="button" data-apply>Aplicar correções</button>
      </div>`,
    onMount(body, sheet) {
      return on(body, 'click', '[data-apply]', async (e, btn) => {
        const overrides = {};
        for (const sel of body.querySelectorAll('[data-group-index]')) {
          if (sel.value) overrides[groups[Number(sel.dataset.groupIndex)].name] = sel.value;
        }
        btn.disabled = true;
        btn.textContent = 'A aplicar…';
        try {
          const s = await reclassifySource(source.id, overrides);
          sheet.close();
          toast(`Categorias atualizadas: ${countsLine(s)}`, { type: 'success' });
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Aplicar correções';
          toast(err.message || 'Não foi possível aplicar as correções.', { type: 'error' });
        }
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Detalhe de uma fonte                                                */
/* ------------------------------------------------------------------ */
function detailMarkup(s) {
  const importing = s.status === 'importing' || isImporting(s.id);
  const err = s.status === 'error' ? s.lastError : null;
  const expires = s.account?.expiresAt ? new Date(s.account.expiresAt).toLocaleDateString('pt-PT') : null;

  return html`
    ${screenHeader({ title: s.name, back: { fallback: '/settings/sources', label: 'Voltar às listas' } })}
    <div class="stack">
      <section class="source-summary">
        <div class="source-summary__row">${statusBadge(s)}<span class="text-tertiary">${SOURCE_TYPES[s.type]}</span></div>
        <div class="stats">
          <div class="stat"><div class="stat__value">${new Intl.NumberFormat('pt-PT').format(s.counts?.live ?? 0)}</div><div class="stat__label">Canais</div></div>
          <div class="stat"><div class="stat__value">${new Intl.NumberFormat('pt-PT').format(s.counts?.movie ?? 0)}</div><div class="stat__label">Filmes</div></div>
          <div class="stat"><div class="stat__value">${new Intl.NumberFormat('pt-PT').format(s.counts?.series ?? 0)}</div><div class="stat__label">Séries</div></div>
        </div>
        <dl class="kv">
          ${s.host ? html`<dt>Servidor</dt><dd class="truncate">${s.host}</dd>` : ''}
          ${s.fileName ? html`<dt>Ficheiro</dt><dd class="truncate">${s.fileName}${s.fileSize ? html` · ${formatBytes(s.fileSize)}` : ''}</dd>` : ''}
          <dt>Última atualização</dt><dd>${s.lastUpdated ? `${formatRelative(s.lastUpdated)} (${new Date(s.lastUpdated).toLocaleString('pt-PT')})` : 'nunca'}</dd>
          ${s.type !== 'm3u-file' ? html`<dt>Atualização automática</dt><dd>${s.refreshHours ? `a cada ${s.refreshHours} h (ao abrir a app)` : 'desligada'}</dd>` : ''}
          ${expires ? html`<dt>Subscrição</dt><dd>expira a ${expires}${s.account.maxConnections ? ` · ${formatCount(s.account.maxConnections, 'ligação', 'ligações')}` : ''}</dd>` : ''}
        </dl>
      </section>

      ${err ? html`
        <div class="notice notice--error" role="alert">
          ${icon('alert', { size: 'sm' })}
          <div class="notice__body"><div class="notice__title">${err.message}</div>${err.hint ?? ''}</div>
        </div>` : ''}
      ${s.insecure ? html`
        <div class="notice notice--warning">${icon('alert', { size: 'sm' })}
          <div class="notice__body"><div class="notice__title">Servidor sem HTTPS</div>A ligação não é cifrada e o iPhone pode bloquear pedidos a partir da app. Se o fornecedor tiver endereço HTTPS, prefira-o.</div>
        </div>` : ''}
      ${(s.warnings ?? []).map((w) => html`<div class="notice notice--warning">${icon('info', { size: 'sm' })}<div class="notice__body">${w}</div></div>`)}

      <section class="group">
        <div class="group__list">
          ${s.type === 'm3u-file' ? html`
            <label class="cell" for="replace-file">
              <span class="cell__icon">${icon('file', { size: 'sm' })}</span>
              <span class="cell__body"><span class="cell__title">Importar ficheiro novamente</span><span class="cell__subtitle">Substitui o conteúdo pela nova versão do ficheiro</span></span>
              <input class="sr-only" type="file" id="replace-file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegurl,application/vnd.apple.mpegurl">
            </label>` : html`
            <button class="cell" type="button" data-action="refresh" ${importing ? html`disabled` : ''}>
              <span class="cell__icon">${icon('download', { size: 'sm' })}</span>
              <span class="cell__body"><span class="cell__title">${importing ? 'A importar…' : 'Atualizar agora'}</span></span>
            </button>`}
          <button class="cell" type="button" data-action="edit">
            <span class="cell__icon">${icon('settings', { size: 'sm' })}</span>
            <span class="cell__body"><span class="cell__title">Editar</span><span class="cell__subtitle">Nome, endereço, credenciais e atualização</span></span>
            <span class="cell__chevron">${icon('chevronRight', { size: 'sm' })}</span>
          </button>
          ${s.type !== 'xtream' && s.groups?.length ? html`
            <button class="cell" type="button" data-action="categories">
              <span class="cell__icon">${icon('layers', { size: 'sm' })}</span>
              <span class="cell__body"><span class="cell__title">Corrigir categorias</span><span class="cell__subtitle">${formatCount(s.groups.length, 'categoria', 'categorias')}${Object.keys(s.overrides ?? {}).length ? ` · ${Object.keys(s.overrides).length} corrigidas` : ''}</span></span>
              <span class="cell__chevron">${icon('chevronRight', { size: 'sm' })}</span>
            </button>` : ''}
          <label class="cell">
            <span class="cell__icon cell__icon--neutral">${icon('check', { size: 'sm' })}</span>
            <span class="cell__body"><span class="cell__title">Lista ativa</span><span class="cell__subtitle">Desative para ocultar os conteúdos sem os apagar</span></span>
            ${switchControl({ id: 'source-enabled', checked: s.enabled, label: 'Lista ativa' })}
          </label>
        </div>
      </section>

      <section class="group">
        <div class="group__list">
          <button class="cell cell--danger" type="button" data-action="delete">
            <span class="cell__icon cell__icon--danger">${icon('trash', { size: 'sm' })}</span>
            <span class="cell__body"><span class="cell__title">Eliminar lista</span></span>
          </button>
        </div>
      </section>
    </div>`;
}

async function renderDetail(ctx) {
  const { outlet } = ctx;
  const id = ctx.params.id;
  let offHeader = null;

  const paint = async () => {
    const s = await getSource(id);
    if (!ctx.isActive()) return null;
    if (!s) {
      render(outlet, html`${screenHeader({ title: 'Lista', back: { fallback: '/settings/sources' } })}${emptyState({ iconName: 'alert', title: 'Lista não encontrada', text: 'Pode ter sido eliminada.' })}`);
      return null;
    }
    render(outlet, detailMarkup(s));
    offHeader?.();
    offHeader = mountHeader(outlet);
    return s;
  };

  await paint();
  const offs = [
    bindCommonActions(outlet, ctx),
    syncEvents.on('changed', (e) => { if (ctx.isActive() && (!e?.sourceId || e.sourceId === id || e.id === id)) paint(); }),
    syncEvents.on('start', (e) => { if (ctx.isActive() && e.sourceId === id) paint(); }),
    on(outlet, 'click', '[data-action="refresh"]', () => openImportSheet(id)),
    on(outlet, 'change', '#replace-file', (e, input) => {
      const file = input.files?.[0];
      if (file) openImportSheet(id, { file });
    }),
    on(outlet, 'click', '[data-action="edit"]', async () => {
      const s = await getSource(id);
      openSourceForm({
        source: s,
        onSaved: (sid, { credentialsChanged } = {}) => {
          if (credentialsChanged && s.type !== 'm3u-file') openImportSheet(sid);
        },
      });
    }),
    on(outlet, 'click', '[data-action="categories"]', async () => openCategoriesSheet(await getSource(id))),
    on(outlet, 'change', '#source-enabled', async (e, input) => {
      await updateSource(id, { enabled: input.checked });
      toast(input.checked ? 'Lista ativada' : 'Lista desativada: conteúdos ocultos');
    }),
    on(outlet, 'click', '[data-action="delete"]', async () => {
      const s = await getSource(id);
      const ok = await confirmDialog({
        title: `Eliminar «${s.name}»?`,
        message: `Serão removidos deste dispositivo a lista e ${countsLine(s.counts).toLowerCase()}. Esta ação não pode ser anulada.`,
        confirmLabel: 'Eliminar lista',
        destructive: true,
      });
      if (!ok) return;
      await deleteSource(id);
      toast('Lista eliminada', { type: 'success' });
      ctx.router.replace('/settings/sources');
    }),
  ];
  return () => { offHeader?.(); offs.forEach((off) => off()); };
}

export const sourcesScreen = { render: renderList };
export const sourceDetailScreen = { render: renderDetail };
