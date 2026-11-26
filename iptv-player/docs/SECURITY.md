# Segurança e privacidade

## 1. Modelo de ameaça (o que protegemos e de quê)

| Ameaça | Proteção | Limite |
|---|---|---|
| Metadados maliciosos numa lista (`<script>` no nome do canal, `javascript:` no logótipo) | Todo o texto externo é inserido via `textContent`/template com escape; URLs só aceites com `http:`/`https:`; CSP restritiva. | — |
| Credenciais publicadas no GitHub | Nenhuma credencial no código. Repositório contém só a aplicação. `.gitignore` bloqueia ficheiros `*.m3u`, `*.env`, backups. | Depende de o utilizador não fazer commit de ficheiros pessoais. |
| Credenciais em backups exportados | Backups **excluem passwords por omissão**; opção explícita para as incluir, com aviso. | — |
| Fuga de credenciais para terceiros | Sem trackers, sem analytics, sem CDN em runtime, sem proxies públicos. Pedidos só para servidores configurados pelo utilizador. | — |
| Leitura da password no dispositivo | Password e utilizador Xtream e o URL da lista M3U cifrados com AES-GCM; chave `CryptoKey` **não exportável** em IndexedDB. | **Não é um cofre.** Ver §2. |
| URLs de cada canal/filme em listas M3U | Guardados **sem cifra** em IndexedDB (cifrar dezenas de milhares de entradas tornaria a importação lenta). Se o fornecedor incluir credenciais nesses URLs, ficam legíveis por quem aceda à base de dados do dispositivo. Em contas Xtream isto não acontece: os URLs são construídos no momento da reprodução. | Limitação conhecida e aceite (v1). |
| Credenciais em trânsito | O protocolo Xtream envia username/password no URL. Se o servidor for HTTP, viajam em claro na rede. | Limitação do fornecedor, não da app. A app avisa quando o servidor é HTTP. |

## 2. Porque é que o armazenamento local de uma PWA não é um cofre

- Uma PWA não acede ao **Keychain** do iOS nem a Face ID para proteger segredos.
- A chave de cifra tem de estar disponível para a própria app usar a password — logo, qualquer código que corra na mesma origem (ex.: uma extensão maliciosa, ou a app comprometida) consegue usá-la.
- O que a cifra **efetivamente** garante: a password não aparece em texto simples em exportações, inspeção casual da base de dados ou *dumps* acidentais.
- A password tem também de ser usada nos URLs de reprodução Xtream (`/live/user/pass/id.m3u8`) — é inerente ao protocolo.

**Recomendação ao utilizador:** usar uma password exclusiva para o serviço IPTV (nunca reutilizada noutros serviços).

## 3. Content Security Policy (planeada)

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' https: http: data: blob:;
media-src 'self' https: http: blob:;
connect-src 'self' https: http:;
worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'none';
```

`img-src`, `media-src` e `connect-src` têm de aceitar qualquer origem porque as fontes são definidas pelo utilizador. `script-src 'self'` impede a execução de qualquer script externo ou *inline*.

## 4. Eliminar todos os dados

Definições → Privacidade → "Eliminar todos os dados locais": apaga IndexedDB, LocalStorage, caches do Service Worker e a chave de cifra, com confirmação dupla.
