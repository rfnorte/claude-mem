/**
 * Store reativo mínimo: estado imutável + subscrições.
 * Suficiente para o tamanho desta app, sem dependências.
 */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      if (next === state) return;
      const prev = state;
      state = next;
      for (const fn of listeners) fn(state, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Emissor de eventos simples para comunicação entre módulos. */
export function createEmitter() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type)?.delete(fn);
    },
    emit(type, detail) {
      for (const fn of map.get(type) ?? []) fn(detail);
    },
  };
}
