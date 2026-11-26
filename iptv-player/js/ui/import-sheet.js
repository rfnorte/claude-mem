/**
 * Painel de progresso da importação: fases, progresso, resumo final e erros
 * com sugestões. Pode ser fechado — a importação continua e o resultado é
 * anunciado por notificação.
 */
import { html, render, on, vars } from '../core/dom.js';
import { formatCount, formatBytes } from '../core/format.js';
import { getSource } from '../data/sources.js';
import { importSource } from '../iptv/source-sync.js';
import { icon } from './components/icons.js';
import { openSheet } from './components/overlay.js';

const PHASES = {
  connect: 'A ligar ao servidor…',
  download: 'A transferir dados…',
  parse: 'A analisar a lista…',
  save: 'A guardar no dispositivo…',
};

function progressView(p = { phase: 'connect' }) {
  const pct = p.total ? Math.min(100, (p.bytes / p.total) * 100) : null;
  return html`
    <div class="import-progress" aria-live="polite">
      <div class="import-progress__phase">${PHASES[p.phase] ?? 'A processar…'}</div>
      ${pct !== null
        ? html`<span class="progress progress--lg" data-vars="${vars({ progress: pct })}"></span>`
        : html`<span class="progress progress--lg progress--indeterminate"></span>`}
      <div class="import-progress__meta">
        ${p.entries ? formatCount(p.entries, 'entrada', 'entradas') : ''}
        ${p.bytes ? html` · ${formatBytes(p.bytes)}${p.total ? html` de ${formatBytes(p.total)}` : ''}` : ''}
      </div>
      <p class="field__hint">Pode fechar este painel: a importação continua e será avisado quando terminar.</p>
    </div>`;
}

function stat(value, label) {
  return html`<div class="stat"><div class="stat__value">${new Intl.NumberFormat('pt-PT').format(value ?? 0)}</div><div class="stat__label">${label}</div></div>`;
}

function summaryView(source, s) {
  const notes = [];
  if (s.duplicates) notes.push(`${formatCount(s.duplicates, 'entrada duplicada ignorada', 'entradas duplicadas ignoradas')}.`);
  if (s.invalid) notes.push(`${formatCount(s.invalid, 'entrada inválida ignorada', 'entradas inválidas ignoradas')}.`);
  if (s.unsupported) notes.push(`${formatCount(s.unsupported, 'entrada com protocolo não suportado', 'entradas com protocolo não suportado')} (ex.: rtmp, udp).`);
  if (s.removed) notes.push(`${formatCount(s.removed, 'item antigo removido', 'itens antigos removidos')}.`);
  for (const w of s.warnings ?? []) notes.push(w);

  return html`
    <div class="import-result">
      <div class="import-result__icon import-result__icon--ok">${icon('check', { size: 'lg' })}</div>
      <h3 class="import-result__title">Lista importada</h3>
      <div class="stats">${stat(s.live, 'Canais')}${stat(s.movie, 'Filmes')}${stat(s.series, 'Séries')}</div>
      ${notes.length ? html`<ul class="import-result__notes">${notes.map((n) => html`<li>${n}</li>`)}</ul>` : ''}
      ${source.insecure ? html`
        <div class="notice notice--warning">${icon('alert', { size: 'sm' })}<div class="notice__body">Este servidor usa HTTP (sem cifra). A reprodução no iPhone poderá ser bloqueada — será validada na Fase 4.</div></div>` : ''}
      <div class="form-actions">
        <a class="btn btn--primary btn--lg" href="${s.live ? '#/tv' : s.movie ? '#/movies' : '#/series'}" data-close>Ver conteúdos</a>
        <button class="btn btn--secondary btn--lg" type="button" data-close>Fechar</button>
      </div>
    </div>`;
}

function errorView(source, err) {
  return html`
    <div class="import-result">
      <div class="import-result__icon import-result__icon--error">${icon('alert', { size: 'lg' })}</div>
      <h3 class="import-result__title">Não foi possível importar</h3>
      <p class="import-result__text">${err.message}</p>
      ${err.hint ? html`<p class="field__hint import-result__text">${err.hint}</p>` : ''}
      <div class="form-actions">
        ${source.type !== 'm3u-file' ? html`<button class="btn btn--primary btn--lg" type="button" data-retry>Tentar novamente</button>` : ''}
        <a class="btn btn--secondary btn--lg" href="#/settings/sources/${encodeURIComponent(source.id)}" data-close>Ver lista</a>
      </div>
    </div>`;
}

/** Inicia (ou acompanha) a importação de uma fonte num painel. */
export async function openImportSheet(sourceId, { file } = {}) {
  const source = await getSource(sourceId);
  if (!source) return;

  openSheet({
    title: `Importar «${source.name}»`,
    content: html`<div data-import-body>${progressView()}</div>`,
    onMount(body) {
      const target = body.querySelector('[data-import-body]');
      let alive = true;

      const run = () => {
        render(target, progressView());
        importSource(sourceId, {
          file,
          onProgress: (p) => { if (alive) render(target, progressView(p)); },
        }).then((summary) => {
          if (alive) render(target, summaryView(source, summary));
        }).catch((err) => {
          if (alive) render(target, errorView(source, err));
        });
      };
      const off = on(body, 'click', '[data-retry]', run);
      run();
      return () => { alive = false; off(); };
    },
  });
}
