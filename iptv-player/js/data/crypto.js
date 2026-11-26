/**
 * Cifra de segredos locais (passwords Xtream, URLs com credenciais).
 *
 * AES-GCM 256 com chave gerada no dispositivo, guardada em IndexedDB como
 * CryptoKey NÃO EXPORTÁVEL: o JavaScript pode usá-la mas não ler os seus bytes.
 *
 * O que isto protege: exposição acidental (exportações, backups, inspeção casual
 * da base de dados). O que NÃO protege: código malicioso a correr nesta mesma
 * origem ou alguém com acesso ao telemóvel desbloqueado. Ver docs/SECURITY.md.
 */
import { get, put } from './db.js';

const KEY_ID = 'secrets-v1';
let keyPromise = null;

async function getKey() {
  if (!globalThis.crypto?.subtle) throw new Error('Cifra indisponível: a app tem de ser aberta por HTTPS.');
  keyPromise ??= (async () => {
    const existing = await get('keys', KEY_ID);
    if (existing?.key) return existing.key;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await put('keys', { id: KEY_ID, key, createdAt: Date.now() });
    return key;
  })().catch((err) => { keyPromise = null; throw err; });
  return keyPromise;
}

/** @returns {Promise<{v: 1, iv: Uint8Array, ct: ArrayBuffer}>} */
export async function encryptText(text) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(text)));
  return { v: 1, iv, ct };
}

export async function decryptText(box) {
  if (!box) return '';
  const key = await getKey();
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, key, box.ct);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('Não foi possível ler as credenciais guardadas. Edite a lista e introduza-as novamente.');
  }
}

/** Esquece a chave em memória (após eliminar todos os dados). */
export function resetKeyCache() {
  keyPromise = null;
}
