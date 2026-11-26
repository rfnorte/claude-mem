/**
 * Rede: pedidos com timeout e tradução de erros para mensagens compreensíveis.
 * Funciona no thread principal e em Web Workers.
 *
 * Limitação importante: quando um pedido falha por CORS, mixed content ou falta
 * de rede, o browser devolve o MESMO erro genérico (TypeError) por razões de
 * segurança. A app só consegue inferir a causa provável.
 */

export class NetError extends Error {
  /**
   * @param {'timeout'|'mixed'|'network'|'http'|'format'|'empty'|'auth'|'expired'|'aborted'|'too-large'} code
   */
  constructor(code, message, { status, hint } = {}) {
    super(message);
    this.name = 'NetError';
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

function pageIsHttps() {
  return typeof location !== 'undefined' && location.protocol === 'https:';
}

/** Explica uma falha de fetch com base no contexto (sem expor o URL completo). */
export function describeFetchError(err, url) {
  if (err instanceof NetError) return err;
  if (err?.name === 'AbortError') return new NetError('aborted', 'Operação cancelada.');
  let target = null;
  try { target = new URL(url); } catch { /* ignora */ }

  if (target?.protocol === 'http:' && pageIsHttps()) {
    return new NetError('mixed',
      'O servidor usa HTTP (sem cifra) e o browser bloqueia este pedido a partir de uma app HTTPS.',
      { hint: 'Peça ao fornecedor um endereço HTTPS ou importe a lista como ficheiro.' });
  }
  return new NetError('network',
    'Não foi possível ligar ao servidor.',
    { hint: 'Causas prováveis: o servidor não permite acesso a partir de browsers (CORS), o endereço está errado, ou não há ligação à internet. Alternativa: importar a lista como ficheiro.' });
}

/**
 * fetch com timeout até à resposta (cabeçalhos). O corpo tem timeout próprio de inatividade (readStream).
 */
export async function fetchWithTimeout(url, { timeoutMs = 30_000, signal, headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new NetError('timeout', 'O servidor demorou demasiado a responder.')), timeoutMs);
  const onAbort = () => ctrl.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) {
      const map = {
        401: 'Acesso negado pelo servidor (401). Verifique as credenciais.',
        403: 'Acesso recusado pelo servidor (403). A conta pode estar inativa ou o IP bloqueado.',
        404: 'O endereço não existe no servidor (404).',
        429: 'Demasiados pedidos. Aguarde alguns minutos e tente de novo.',
      };
      throw new NetError('http', map[res.status] ?? `O servidor respondeu com erro ${res.status}.`, { status: res.status });
    }
    return res;
  } catch (err) {
    if (ctrl.signal.aborted && ctrl.signal.reason instanceof NetError) throw ctrl.signal.reason;
    throw describeFetchError(err, url);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Lê um ReadableStream de bytes como texto, por blocos, com timeout de inatividade.
 * @param {ReadableStream<Uint8Array>} stream
 * @param {(text: string, bytes: number) => void} onText
 */
export async function readTextStream(stream, onText, { idleMs = 30_000, maxBytes = 300 * 1_048_576, signal } = {}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  try {
    for (;;) {
      if (signal?.aborted) throw new NetError('aborted', 'Operação cancelada.');
      let timer;
      const idle = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new NetError('timeout', 'A transferência parou (sem dados há 30 s).')), idleMs);
      });
      const { done, value } = await Promise.race([reader.read(), idle]).finally(() => clearTimeout(timer));
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new NetError('too-large', `A lista excede ${Math.round(maxBytes / 1_048_576)} MB.`);
      await onText(decoder.decode(value, { stream: true }), total);
    }
    const tail = decoder.decode();
    if (tail) await onText(tail, total);
    return total;
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** Remove credenciais de um URL para mostrar ao utilizador ou registar em logs. */
export function redactUrl(url) {
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/user|pass|token|key|auth|pwd/i.test(k)) u.searchParams.set(k, '•••');
    }
    u.pathname = u.pathname.replace(/\/(live|movie|series)\/[^/]+\/[^/]+\//, '/$1/•••/•••/');
    return u.toString();
  } catch {
    return '(endereço inválido)';
  }
}
