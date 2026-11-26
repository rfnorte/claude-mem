/**
 * Ações partilhadas entre ecrãs: favoritos, voltar e ficha de canal.
 */
import { html, on, vars } from '../core/dom.js';
import { formatTime, formatRemaining, programmeProgress } from '../core/format.js';
import { catalog } from '../data/catalog.js';
import { favorites } from '../data/favorites.js';
import { channelLogo } from './components/cards.js';
import { icon } from './components/icons.js';
import { openSheet } from './components/overlay.js';
import { toast } from './components/toast.js';

/** Atualiza um botão de favorito no sítio, sem re-renderizar a lista. */
function paintFavButton(btn, added) {
  btn.setAttribute('aria-pressed', added ? 'true' : 'false');
  const name = btn.getAttribute('aria-label')?.split(': ').slice(1).join(': ') ?? '';
  btn.setAttribute('aria-label', `${added ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}: ${name}`);
  const label = btn.querySelector('[data-fav-label]');
  if (label) label.textContent = added ? 'Nos favoritos' : 'Favorito';
  const svg = btn.querySelector('svg');
  if (svg) svg.outerHTML = icon(added ? 'heartFill' : 'heart', { size: svg.classList.contains('icon--sm') ? 'sm' : '' }).value;
}

export async function toggleFavorite(kind, id, btn) {
  const added = await favorites.toggle(kind, id);
  if (btn) paintFavButton(btn, added);
  navigator.vibrate?.(8);
  toast(added ? 'Adicionado aos favoritos' : 'Removido dos favoritos', { type: added ? 'success' : 'info', duration: 1800 });
  return added;
}

/**
 * Liga as ações comuns a um ecrã (delegação de eventos).
 * @returns {() => void} limpeza
 */
export function bindCommonActions(outlet, ctx) {
  const offs = [
    on(outlet, 'click', '[data-action="toggle-fav"]', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(btn.dataset.kind, btn.dataset.id, btn);
    }),
    on(outlet, 'click', '[data-action="open-channel"]', (e, btn) => {
      e.preventDefault();
      openChannelSheet(btn.dataset.id);
    }),
    on(outlet, 'click', '[data-action="back"]', (e, btn) => {
      e.preventDefault();
      ctx.router.back(btn.dataset.fallback);
    }),
  ];
  return () => offs.forEach((off) => off());
}

function programmeBlock(label, p, { current = false } = {}) {
  if (!p) return '';
  const progress = current ? programmeProgress(p.start, p.stop) : null;
  const remaining = current ? Math.max(0, Math.round((p.stop - Date.now()) / 60_000)) : 0;
  return html`
    <div class="programme ${current ? 'programme--now' : ''}">
      <div class="programme__label">${label}</div>
      <div class="programme__title">${p.title}</div>
      <div class="programme__time">${formatTime(p.start)} – ${formatTime(p.stop)}${current ? html` · ${formatRemaining(remaining)}` : ''}</div>
      ${progress !== null ? html`<span class="progress" data-vars="${vars({ progress })}"></span>` : ''}
    </div>`;
}

export async function openChannelSheet(id) {
  const ch = await catalog.channel(id);
  if (!ch) { toast('Canal não encontrado.', { type: 'error' }); return; }
  const isFav = favorites.has('live', ch.id);

  openSheet({
    title: ch.name,
    content: html`
      <div class="channel-sheet">
        <div class="channel-sheet__head">
          ${channelLogo(ch, { size: 'lg' })}
          <div class="channel-sheet__info">
            <div class="channel-sheet__name">${ch.name}</div>
            <div class="text-secondary">${ch.categoryName ?? ''}${ch.number ? html` · Canal ${ch.number}` : ''}</div>
          </div>
        </div>
        ${ch.epg
          ? html`<div class="programme-list">${programmeBlock('Agora', ch.epg.now, { current: true })}${programmeBlock('A seguir', ch.epg.next)}</div>`
          : html`<p class="text-tertiary">Sem informação de programação para este canal.</p>`}
        <div class="channel-sheet__actions">
          <button class="btn btn--primary btn--lg btn--block" type="button" disabled aria-describedby="play-note">
            ${icon('play', { size: 'sm' })}<span>Reproduzir</span>
          </button>
          <button class="btn btn--secondary btn--lg btn--block" type="button" data-sheet-fav aria-pressed="${isFav ? 'true' : 'false'}" aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}: ${ch.name}">
            ${icon(isFav ? 'heartFill' : 'heart', { size: 'sm' })}<span data-fav-label>${isFav ? 'Nos favoritos' : 'Favorito'}</span>
          </button>
        </div>
        <p class="field__hint" id="play-note">O leitor de vídeo é implementado na Fase 4.${ch.id.startsWith('demo-') ? ' Os dados deste canal são fictícios (modo demonstração).' : ''}</p>
      </div>`,
    onMount(body) {
      const btn = body.querySelector('[data-sheet-fav]');
      const onClick = () => toggleFavorite('live', ch.id, btn);
      btn.addEventListener('click', onClick);
      return () => btn.removeEventListener('click', onClick);
    },
  });
}
