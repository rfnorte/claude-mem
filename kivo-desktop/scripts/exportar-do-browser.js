/* Kivo — exportar os dados da versão HTML (browser) para a aplicação desktop.
 * Colar na consola do browser (F12 › Consola) com a página do Kivo aberta.
 * Cria um ficheiro .kivo que se restaura no Kivo desktop em Definições › Dados › Restaurar cópia de segurança.
 * Não altera nem apaga nada no browser. */
(async () => {
  const KEY = 'kivo:v3';
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const keys = Object.keys(localStorage).filter(k => /kivo/i.test(k));
    console.warn('KIVO: não há dados do Kivo guardados nesta página' + (keys.length ? ' (outras chaves: ' + keys.join(', ') + ')' : '') + '. Confirma que a consola está no contexto da página do Kivo.');
    return;
  }
  let o;
  try { o = JSON.parse(raw); } catch (e) { console.error('KIVO: os dados guardados estão danificados.'); return; }
  if (!crypto.subtle) { console.error('KIVO: este browser não permite calcular a verificação (abre a página em Chrome ou Edge).'); return; }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const resumo = { transacoes: (o.tx || []).length, contasAPagar: (o.bills || []).length, regras: (o.rules || []).length };
  const env = { formato: 'kivo-backup', versao: 1, aplicacao: 'Kivo', versaoApp: 'html', criadoEm: new Date().toISOString(), resumo, sha256: hash, dados: raw };
  const text = JSON.stringify(env);
  const name = 'kivo-migracao-' + new Date().toISOString().slice(0, 10) + '.kivo';
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { /* download bloqueado: fica a cópia para a área de transferência */ }
  if (typeof copy === 'function') copy(text);
  console.log('KIVO: ficheiro "' + name + '" criado — ' + resumo.transacoes + ' transações, ' + resumo.contasAPagar + ' contas a pagar, ' + resumo.regras + ' regras.\n' +
    'Se o download não aparecer: o conteúdo foi copiado. Cola-o num ficheiro de texto vazio e grava-o como ' + name);
})();
