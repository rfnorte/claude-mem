/**
 * Validação de URLs de fontes IPTV (listas M3U e servidores Xtream).
 * Devolve sempre um objeto { ok, url?, error?, warning? } com mensagens em PT-PT
 * prontas a mostrar ao utilizador.
 */

const MAX_URL_LENGTH = 2048;

export function validateSourceUrl(input, { kind = 'playlist' } = {}) {
  const value = String(input ?? '').trim();
  if (!value) return { ok: false, error: 'Introduza um endereço.' };
  if (value.length > MAX_URL_LENGTH) return { ok: false, error: 'O endereço é demasiado longo.' };
  if (/\s/.test(value)) return { ok: false, error: 'O endereço não pode conter espaços.' };

  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`);
  } catch {
    return { ok: false, error: 'Endereço inválido. Exemplo: https://servidor.com/lista.m3u' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Apenas são aceites endereços http:// ou https://.' };
  }
  if (!url.hostname || !/^[a-z\d.-]+$|^\[[\da-f:]+\]$/i.test(url.hostname)) {
    return { ok: false, error: 'Nome de servidor inválido.' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Não inclua utilizador/password no endereço. Use os campos próprios.' };
  }

  if (kind === 'xtream') {
    // O servidor Xtream é só a base (esquema + host + porta). Remove caminhos comuns colados por engano.
    url.pathname = url.pathname.replace(/\/(player_api\.php|get\.php|xmltv\.php).*$/i, '/');
    url.search = '';
    url.hash = '';
  }

  // Xtream: origem + eventual subcaminho (alguns fornecedores não servem a API na raiz).
  const normalized = kind === 'xtream' ? `${url.origin}${url.pathname}`.replace(/\/+$/, '') : url.href;
  const warning = url.protocol === 'http:'
    ? 'Servidor sem HTTPS: a ligação não é cifrada e o iPhone pode bloquear o carregamento a partir da app.'
    : undefined;

  return { ok: true, url: normalized, warning };
}

export function validateRequired(value, label) {
  return String(value ?? '').trim() ? null : `${label} é obrigatório.`;
}
