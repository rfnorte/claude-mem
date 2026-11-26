# Desafios técnicos e limitações — iPhone / Safari (WebKit)

> Em iOS, **todos** os browsers (Safari, Chrome, Firefox) usam o motor WebKit. As limitações abaixo aplicam-se a qualquer browser no iPhone e à PWA instalada.
>
> Coluna **Confiança**: ✅ comportamento documentado e estável · ⚠️ varia com a versão do iOS ou com a fonte — **tem de ser validado no iPhone real**.

## 1. Rede: CORS e Mixed Content — o risco n.º 1

| Situação | O que acontece | Confiança |
|---|---|---|
| `fetch()` de uma lista M3U ou API Xtream noutro domínio **sem** cabeçalho `Access-Control-Allow-Origin` | Bloqueado pelo browser (CORS). A app não consegue ler a resposta. | ✅ |
| `fetch()` de um URL **http://** a partir da app em **https://** | Bloqueado (mixed content ativo). | ✅ |
| `<video src="https://…m3u8">` com HLS nativo, servidor sem CORS | **Funciona** — o elemento vídeo não exige CORS. | ✅ |
| `<video src="http://…m3u8">` a partir de página HTTPS | Tratado como mixed content "passivo": o WebKit pode reproduzir, tentar promover para HTTPS ou bloquear, conforme a versão. | ⚠️ |
| hls.js (só desktop) | Usa XHR → **exige CORS** em todos os segmentos. | ✅ |

**Consequências e mitigação (por ordem de preferência, todas gratuitas):**

1. **Importar ficheiro M3U do dispositivo** (app Ficheiros) — contorna totalmente CORS/mixed content para a *lista*. Fica sempre disponível.
2. **Fornecedores HTTPS com CORS** — funcionam diretamente. A app testa e informa o resultado ("Ligação OK" / "Bloqueado por CORS" / "Servidor HTTP").
3. **Proxy pessoal opcional** (ex.: Cloudflare Worker no plano gratuito, na conta do próprio utilizador) — só será proposto se o teste real mostrar que é necessário para as fontes do utilizador. **Não é introduzido automaticamente.** Implicação: as credenciais passariam por esse proxy (que seria do utilizador, não de terceiros).

A app **não** usará proxies públicos de terceiros (exporiam credenciais).

## 2. Formatos e codecs

| Formato | iPhone (Safari nativo) | Notas |
|---|---|---|
| HLS `.m3u8` (MPEG-TS ou fMP4) | ✅ Excelente | Motor preferencial. Inclui legendas WebVTT e faixas de áudio alternativas. |
| MP4 (H.264/AAC) progressivo | ✅ | Típico de VOD. |
| H.265/HEVC | ⚠️ | Suportado em hardware recente; mais fiável em fMP4. |
| Áudio AC-3 / E-AC-3 | ⚠️ | Normalmente suportado em HLS; depende da fonte. |
| MPEG-TS "cru" (`.ts` contínuo, sem playlist) | ❌ | Comum em Xtream por omissão → a app pede sempre a variante `.m3u8` para direto. |
| MKV, AVI, FLV | ❌ | Frequentes em VOD Xtream. A app mostra "Formato não suportado no iPhone" em vez de falhar sem explicação. |
| DRM (Widevine/PlayReady) | ❌ | Fora de âmbito; a app não contorna DRM. |

## 3. Reprodução e interface

| Tema | Comportamento iOS | Decisão |
|---|---|---|
| Autoplay | Com som só após gesto do utilizador; `playsinline` obrigatório para não abrir ecrã inteiro. | A reprodução inicia sempre após toque. ✅ |
| Ecrã inteiro | No iPhone **não existe** Fullscreen API para elementos arbitrários — só `video.webkitEnterFullscreen()`, que usa os controlos nativos da Apple. | Player próprio *inline* + modo imersivo em horizontal; botão "Ecrã inteiro" → modo nativo (que inclui AirPlay, PiP, legendas, áudio). ✅ |
| Bloqueio de orientação | `screen.orientation.lock()` não suportado. | O utilizador roda o telemóvel; o layout adapta-se. ✅ |
| Volume | `video.volume` é só de leitura (volume físico). | Slider de volume **escondido** no iOS; mostrado em desktop. ✅ |
| Legendas / áudio | `textTracks`/`audioTracks` expostos pelo HLS nativo. | Seletor mostrado só quando há >1 opção. ⚠️ |
| AirPlay | `webkitShowPlaybackTargetPicker()`; depende de a fonte ser acessível pela Apple TV. | Botão mostrado só se suportado. ⚠️ |
| Picture-in-Picture | Suportado em vídeo; na PWA instalada o comportamento varia por versão. | Botão por deteção de capacidade. ⚠️ |
| Segundo plano | Ao sair da app o vídeo pausa (exceto em PiP). Não há tarefas em segundo plano. | Sem promessas de áudio em background. ✅ |

## 4. Memória e desempenho

- Listas com 20 000–100 000 entradas são comuns. Renderizar tudo no DOM bloqueia/termina a app no iPhone. → **Listas virtualizadas** (só ~30 nós no DOM) e parsing em **Web Worker**.
- XMLTV pode ter centenas de MB → parser em *streaming*, guardar só a janela −2 h/+48 h e só canais presentes.
- Imagens (logótipos/capas) com `loading="lazy"`, `decoding="async"` e tamanhos fixos para evitar *layout shift*.

## 5. Armazenamento e PWA

| Tema | Comportamento | Confiança |
|---|---|---|
| Quota IndexedDB | Generosa em iOS 17+ (proporcional ao disco). | ⚠️ |
| Remoção automática | No Safari (não instalado), dados podem ser apagados após 7 dias sem uso. **PWA instalada no ecrã principal está isenta.** Pedimos `navigator.storage.persist()` quando disponível. | ✅ / ⚠️ |
| Isolamento | Safari e PWA instalada têm armazenamentos **separados**: as listas configuradas no Safari não aparecem na app instalada. | ✅ → Recomendação: instalar primeiro, configurar depois. |
| Service Worker | Requer HTTPS. Funciona na PWA instalada. | ✅ |
| Splash screen | iOS não gera splash a partir do manifesto; requer imagens `apple-touch-startup-image` por resolução. | ✅ |
| Notificações push | Possíveis em iOS 16.4+, mas sem utilidade sem backend. Fora de âmbito. | — |

## 6. Segurança das credenciais

Ver [`SECURITY.md`](./SECURITY.md). Resumo honesto: **uma PWA não tem acesso ao Keychain do iOS.** O que é possível é cifrar a password com uma chave não exportável (Web Crypto) — protege contra fugas acidentais (backups, exportações, inspeção casual), **não** contra alguém com acesso ao telemóvel desbloqueado ou código malicioso a correr na mesma origem.
