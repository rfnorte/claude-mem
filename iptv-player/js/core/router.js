/**
 * Router por hash (#/rota/:param?query).
 *
 * Porque hash e não History API: o GitHub Pages não faz reescrita de URLs, por
 * isso recarregar /movies/12 daria 404. Com #/movies/12 o servidor serve sempre
 * index.html.
 *
 * Cada ecrã é um módulo com `render(ctx)` que pode devolver (ou resolver para)
 * uma função de limpeza. `ctx.isActive()` permite a código assíncrono saber se o
 * utilizador já navegou para outro ecrã antes de escrever no DOM.
 */

export function parseHash(hash) {
  const value = (hash || '').replace(/^#/, '') || '/';
  const [rawPath, rawQuery = ''] = value.split('?');
  const path = '/' + rawPath.split('/').filter(Boolean).map(safeDecode).join('/');
  return { path: path === '/' ? '/' : path.replace(/\/$/, ''), query: Object.fromEntries(new URLSearchParams(rawQuery)) };
}

function safeDecode(segment) {
  try { return decodeURIComponent(segment); } catch { return segment; }
}

export function compile(pattern) {
  const keys = [];
  const source = pattern
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) { keys.push(part.slice(1)); return '([^/]+)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${source}$`), keys };
}

export function matchRoute(routes, path) {
  for (const route of routes) {
    const m = route.compiled.regex.exec(path);
    if (m) {
      const params = {};
      route.compiled.keys.forEach((k, i) => { params[k] = m[i + 1]; });
      return { route, params };
    }
  }
  return null;
}

export function createRouter({ routes, outlet, fallback = '/home', onNavigate }) {
  const table = routes.map((r) => ({ ...r, compiled: compile(r.path) }));
  const scrollMemory = new Map();
  const stack = [];
  let cleanup = null;
  let token = 0;
  let currentKey = null;

  async function resolve() {
    const { path, query } = parseHash(location.hash);
    const match = matchRoute(table, path);
    if (!match) { location.replace(`#${fallback}`); return; }

    const key = location.hash || `#${fallback}`;
    if (stack.length > 1 && stack[stack.length - 2] === key) stack.pop();
    else if (stack[stack.length - 1] !== key) stack.push(key);

    if (currentKey) scrollMemory.set(currentKey, window.scrollY);
    currentKey = key;

    const myToken = ++token;
    try { await cleanup?.(); } catch (err) { console.error(err); }
    cleanup = null;

    onNavigate?.({ path, query, route: match.route });
    outlet.classList.remove('view--enter');
    void outlet.offsetWidth; // reinicia a animação de entrada
    outlet.classList.add('view--enter');

    const ctx = {
      outlet,
      params: match.params,
      query,
      path,
      router: api,
      isActive: () => myToken === token,
    };

    try {
      const result = await match.route.screen.render(ctx);
      if (myToken !== token) { await result?.(); return; }
      cleanup = typeof result === 'function' ? result : null;
    } catch (err) {
      console.error(err);
      if (myToken === token) match.route.onError?.(ctx, err);
    }

    if (myToken === token) {
      const y = scrollMemory.get(key) ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }

  const api = {
    start() {
      window.addEventListener('hashchange', resolve);
      if (!location.hash) location.replace(`#${fallback}`);
      resolve();
    },
    go(path) { location.hash = path; },
    replace(path) { location.replace(`#${path}`); },
    /** Volta atrás se a página anterior for desta app; senão vai para `fallbackPath`. */
    back(fallbackPath = fallback) {
      if (stack.length > 1) history.back();
      else location.replace(`#${fallbackPath}`);
    },
    refresh: () => resolve(),
    get current() { return parseHash(location.hash); },
  };

  return api;
}
