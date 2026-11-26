/**
 * Preferências pequenas em localStorage (vista lista/grelha, ordenação, modo demo).
 * Dados volumosos ou sensíveis vão para IndexedDB (Fase 3+), nunca para aqui.
 * Todos os acessos são protegidos: localStorage pode lançar exceções (modo
 * privado, armazenamento bloqueado) e a app tem de continuar a funcionar.
 */
import { createEmitter } from '../core/store.js';

const PREFIX = 'iptv:';
const memory = new Map();
const events = createEmitter();

const DEFAULTS = {
  demo: false,
  tvView: 'list',
  tvSort: 'list',
  moviesSort: 'recent',
  seriesSort: 'recent',
};

function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* indisponível → memória */ }
  return memory.has(key) ? memory.get(key) : DEFAULTS[key];
}

export const prefs = {
  get: (key) => read(key),
  set(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* ignora */ }
    events.emit('change', { key, value });
    events.emit(`change:${key}`, value);
  },
  on: (type, fn) => events.on(type, fn),
  /** Remove apenas as chaves desta app. */
  clearAll() {
    memory.clear();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
      }
    } catch { /* ignora */ }
    events.emit('change', { key: '*' });
  },
};
