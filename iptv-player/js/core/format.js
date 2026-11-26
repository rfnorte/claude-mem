/** Formatação de datas, horas e durações (pt-PT, fuso do dispositivo). */

const LOCALE = 'pt-PT';
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });

export const formatTime = (ts) => timeFmt.format(ts);
export const formatLongDate = (ts) => dateFmt.format(ts);

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 6 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 20) return 'Boa tarde';
  return 'Boa noite';
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatRemaining(minutes) {
  const d = formatDuration(minutes);
  return d ? `Faltam ${d}` : '';
}

export function formatCount(n, singular, plural) {
  return `${new Intl.NumberFormat(LOCALE).format(n)} ${n === 1 ? singular : plural}`;
}

/** Progresso (0–100) de um programa entre start e stop (ms). */
export function programmeProgress(start, stop, now = Date.now()) {
  if (!(stop > start)) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (stop - start)) * 100));
}

/** Texto normalizado para pesquisa: minúsculas, sem acentos, espaços colapsados. */
export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
