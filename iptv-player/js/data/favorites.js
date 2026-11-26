/**
 * Favoritos.
 * Fase 2: guardados em memória (perdem-se ao recarregar) — a interface pública
 * mantém-se e passa a usar IndexedDB na Fase 7, sem alterar os ecrãs.
 */
import { createEmitter } from '../core/store.js';

const keys = new Set();
const events = createEmitter();
const keyOf = (kind, id) => `${kind}:${id}`;

export const favorites = {
  has: (kind, id) => keys.has(keyOf(kind, id)),
  async toggle(kind, id) {
    const k = keyOf(kind, id);
    const added = !keys.has(k);
    if (added) keys.add(k); else keys.delete(k);
    events.emit('change', { kind, id, added });
    return added;
  },
  ids(kind) {
    const prefix = `${kind}:`;
    return [...keys].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  },
  clear() { keys.clear(); events.emit('change', { kind: '*' }); },
  on: (fn) => events.on('change', fn),
};
