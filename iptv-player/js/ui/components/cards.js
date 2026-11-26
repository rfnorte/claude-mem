/**
 * Cartões e blocos de conteúdo. Todos recebem dados normalizados (ver
 * docs/ARCHITECTURE.md §4.2) e tratam todos os campos como não confiáveis.
 */
import { html, vars, safeUrl, hashString, initials } from '../../core/dom.js';
import { formatTime, programmeProgress } from '../../core/format.js';
import { icon } from './icons.js';

export const hueOf = (item) => hashString(`${item.id}|${item.name}`) % 360;

/** Imagem externa com fallback automático (o listener global remove imagens que falham). */
function externalImage(url, alt = '') {
  const src = safeUrl(url);
  if (!src) return '';
  return html`<img src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback>`;
}

export function channelLogo(channel, { size = '' } = {}) {
  return html`
    <span class="logo ${size ? `logo--${size}` : ''}" data-vars="${vars({ 'art-h': hueOf(channel) })}" aria-hidden="true">
      ${initials(channel.name)}${externalImage(channel.logo)}
    </span>`;
}

export function artBlock(item, { className, label = true }) {
  return html`
    <div class="art ${className}" data-vars="${vars({ 'art-h': hueOf(item) })}">
      ${label ? html`<span class="art__label">${item.name}</span>` : ''}
      ${externalImage(item.poster)}
    </div>`;
}

export function nowLine(channel, now = Date.now()) {
  const p = channel.epg?.now;
  if (!p) return { text: 'Sem informação de programação', progress: null };
  return { text: `${formatTime(p.start)} · ${p.title}`, progress: programmeProgress(p.start, p.stop, now) };
}

function favButton(kind, item, isFav) {
  return html`
    <button class="icon-btn fav-btn" type="button" data-action="toggle-fav" data-kind="${kind}" data-id="${item.id}"
      aria-pressed="${isFav ? 'true' : 'false'}" aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}: ${item.name}">
      ${icon(isFav ? 'heartFill' : 'heart')}
    </button>`;
}

/** Linha de canal (vista lista). */
export function channelRow(channel, { isFav = false, now } = {}) {
  const line = nowLine(channel, now);
  return html`
    <div class="channel-row">
      <button class="channel-row__main" type="button" data-action="open-channel" data-id="${channel.id}">
        ${channelLogo(channel)}
        <span class="channel-row__body">
          <span class="channel-row__name truncate">${channel.name}</span>
          <span class="channel-row__now truncate">${line.text}</span>
          ${line.progress !== null ? html`<span class="progress" data-vars="${vars({ progress: line.progress })}"></span>` : ''}
        </span>
      </button>
      ${favButton('live', channel, isFav)}
    </div>`;
}

/** Cartão de canal (vista grelha). */
export function channelTile(channel, { isFav = false, now } = {}) {
  const line = nowLine(channel, now);
  return html`
    <button class="channel-tile" type="button" data-action="open-channel" data-id="${channel.id}">
      ${isFav ? html`<span class="channel-tile__fav">${icon('heartFill', { size: 'sm', label: 'Favorito' })}</span>` : ''}
      ${channelLogo(channel, { size: 'lg' })}
      <span class="channel-tile__name truncate">${channel.name}</span>
      <span class="channel-tile__now truncate">${channel.epg?.now?.title ?? line.text}</span>
    </button>`;
}

/** Tile de logótipo para rails no Início. */
export function logoTile(channel) {
  return html`
    <button class="logo-tile" type="button" data-action="open-channel" data-id="${channel.id}">
      ${channelLogo(channel)}
      <span class="logo-tile__name truncate">${channel.name}</span>
    </button>`;
}

export function posterCard(item, { href, isFav = false, meta } = {}) {
  return html`
    <a class="poster" href="${href}">
      <div class="media">
        ${artBlock(item, { className: 'poster__art' })}
        ${isFav ? html`<span class="poster__fav">${icon('heartFill', { size: 'sm', label: 'Favorito' })}</span>` : ''}
        ${item.progress ? html`<span class="progress progress--overlay" data-vars="${vars({ progress: item.progress.percent })}"></span>` : ''}
      </div>
      <div class="poster__title truncate">${item.name}</div>
      <div class="poster__meta truncate">${meta ?? [item.year, item.genres?.[0]].filter(Boolean).join(' · ')}</div>
    </a>`;
}

export function wideCard(item, { href, title, meta, percent }) {
  return html`
    <a class="wide-card" href="${href}">
      <div class="media">
        ${artBlock(item, { className: 'wide-card__art', label: false })}
        <span class="wide-card__play">${icon('play', { size: 'sm' })}</span>
        ${Number.isFinite(percent) ? html`<span class="progress progress--overlay" data-vars="${vars({ progress: percent })}"></span>` : ''}
      </div>
      <div class="wide-card__title truncate">${title ?? item.name}</div>
      ${meta ? html`<div class="wide-card__meta truncate">${meta}</div>` : ''}
    </a>`;
}

export function sectionHeader(title, { href, linkLabel = 'Ver tudo' } = {}) {
  return html`
    <div class="section-header">
      <h2 class="section-header__title">${title}</h2>
      ${href ? html`<a class="section-header__link" href="${href}">${linkLabel}</a>` : ''}
    </div>`;
}

export function section(title, body, opts) {
  return html`<section>${sectionHeader(title, opts)}${body}</section>`;
}

export function rail(items, { variant = '' } = {}) {
  return html`<div class="rail bleed ${variant ? `rail--${variant}` : ''}" role="list">${items.map((i) => html`<div role="listitem">${i}</div>`)}</div>`;
}

export function emptyState({ iconName = 'info', title, text, actions, compact = false }) {
  return html`
    <div class="empty ${compact ? 'empty--compact' : ''}">
      <div class="empty__icon">${icon(iconName, { size: 'lg' })}</div>
      <h2 class="empty__title">${title}</h2>
      ${text ? html`<p class="empty__text">${text}</p>` : ''}
      ${actions ? html`<div class="empty__actions">${actions}</div>` : ''}
    </div>`;
}

/* ---- Skeletons ---- */
export const skeletonRows = (n = 6) =>
  html`<div class="stack stack--sm" aria-hidden="true">${Array.from({ length: n }, () => html`<div class="skeleton skeleton--row"></div>`)}</div>`;

export const skeletonRail = (variant = 'poster', n = 5) =>
  html`<div aria-hidden="true"><div class="skeleton skeleton--title"></div>
    <div class="rail bleed ${variant === 'wide' ? 'rail--wide' : ''} skeleton-rail">
      ${Array.from({ length: n }, () => html`<div class="skeleton skeleton--${variant}"></div>`)}
    </div></div>`;
