# Arquitetura — IPTV Player (PWA para iPhone)

> Estado: **Fase 1 — aprovada para implementação faseada**
> Última revisão: 2026-11-26

## 1. Princípios

| Princípio | Decisão concreta |
|---|---|
| Custo zero | Site estático (sem backend). Alojamento gratuito com HTTPS. |
| Sem toolchain para o utilizador | **Sem passo de build.** ES Modules nativos servidos tal como estão. O utilizador nunca precisa de `npm`. |
| Leveza | Zero frameworks de UI. Uma única dependência externa opcional: **hls.js** (carregada só quando o HLS nativo não existe — nunca no iPhone). |
| iPhone primeiro | HLS nativo do Safari como motor principal; deteção de capacidades em vez de deteção de browser. |
| Dados não confiáveis | Tudo o que vem das listas/EPG/APIs é tratado como texto. Nunca é inserido como HTML. |
| Privacidade | Nenhum tracker, nenhuma telemetria, nenhum pedido a terceiros além das fontes configuradas pelo utilizador. |

### Porque é que não uso React/Vue/Svelte?
Um framework obrigaria a um passo de build (Vite/npm) — mais uma coisa a manter e a explicar, e uma barreira para quem não programa. O volume de ecrãs (≈10) é gerível com componentes funcionais em JS puro e um *store* reativo minimalista. O ganho real de desempenho (listas de 20 000+ canais) vem da **virtualização de listas** e de **Web Workers**, não do framework.

## 2. Vista em camadas

```
┌──────────────────────────────────────────────────────────────┐
│ UI (screens/ + components/)     ← renderização, eventos       │
├──────────────────────────────────────────────────────────────┤
│ Core: router · store · dom (escape) · events                  │
├───────────────┬──────────────────┬───────────────┬───────────┤
│ IPTV           │ Player            │ EPG           │ PWA        │
│ m3u-parser     │ capabilities      │ xmltv-parser  │ install    │
│ classifier     │ native-hls engine │ epg-service   │ update     │
│ xtream-api     │ hlsjs engine      │ matcher       │            │
│ source-sync    │ controls/state    │               │            │
├───────────────┴──────────────────┴───────────────┴───────────┤
│ Data: db (IndexedDB) · repositories · crypto · backup         │
├──────────────────────────────────────────────────────────────┤
│ Workers: import.worker (M3U/Xtream) · epg.worker (XMLTV)      │
└──────────────────────────────────────────────────────────────┘
          Service Worker (sw.js) — só recursos estáticos
```

Regra de dependências: as camadas de cima dependem das de baixo, nunca o contrário. Os *workers* não tocam no DOM.

## 3. Estrutura de ficheiros

Adaptei a estrutura sugerida para separar responsabilidades por domínio (mais fácil de manter que uma pasta `js/` plana com 20 ficheiros).

```
iptv-player/
├── index.html                 # shell da SPA, meta tags iOS, CSP
├── manifest.webmanifest       # manifesto PWA
├── sw.js                      # service worker (na raiz → scope total)
├── README.md
├── assets/
│   ├── icons/                 # ícones PWA + apple-touch-icon
│   └── images/                # ilustrações de empty states
├── css/
│   ├── tokens.css             # design tokens (única fonte de valores)
│   ├── base.css               # reset, tipografia, safe areas
│   ├── layout.css             # app shell, tab bar, grelhas
│   ├── components.css         # botões, cards, sheets, toasts…
│   ├── screens.css            # ajustes específicos por ecrã
│   └── player.css
├── js/
│   ├── app.js                 # bootstrap
│   ├── core/                  # router, store, dom (html seguro), utils
│   ├── data/                  # db, repositórios, crypto, backup
│   ├── iptv/                  # parser M3U, classificador, Xtream, sync
│   ├── epg/                   # parser XMLTV, serviço, associação canais
│   ├── player/                # motor de reprodução + controlos
│   ├── ui/components/         # componentes reutilizáveis
│   ├── ui/screens/            # ecrãs
│   ├── workers/               # import.worker.js, epg.worker.js
│   └── pwa/                   # instalação e atualização
├── vendor/hls.js/             # versão fixa, auto-alojada (sem CDN)
├── tests/                     # testes unitários (node --test) + fixtures
├── design/                    # pré-visualização do design system
└── docs/                      # esta documentação
```

### Estado real após a Fase 3

```
js/
├── iptv/      net.js · m3u-parser.js · classifier.js · collector.js · xtream-api.js · source-sync.js
├── workers/   import.worker.js        # download + parsing + gravação em lotes
├── data/      db.js (IndexedDB) · crypto.js (AES-GCM) · sources.js · catalog.js · prefs.js · favorites.js · demo-data.js
└── ui/        source-form.js · import-sheet.js · screens/sources.js (lista + detalhe)
tests/  unit/{core,iptv}.test.js · e2e/{smoke,import}.mjs · mocks.mjs (servidores simulados) · fixtures/sample.m3u
```

**Decisões tomadas na implementação**
- O catálogo carrega os itens das listas ativas para memória uma vez (pesquisa instantânea) e invalida a cache quando uma lista muda. Validado com 50 000 canais; para listas muito maiores (VOD com centenas de milhares de títulos) pode ser necessário passar a consultas por índice — reavaliar na Fase 9 com as listas reais.
- Séries Xtream: episódios pedidos ao servidor apenas quando se abre a série (`get_series_info`) e guardados localmente.
- Em caso de erro numa atualização, os itens antigos não são apagados (a limpeza de itens obsoletos só ocorre no fim de uma importação bem-sucedida).

### Estado após a Fase 2

```
js/
├── app.js                     # bootstrap: tab bar, rotas, handlers globais
├── config.js                  # versão (sem segredos)
├── core/  dom.js · router.js · store.js · format.js · validate.js
├── data/  catalog.js (fachada) · prefs.js · favorites.js · demo-data.js
└── ui/
    ├── shared.js              # favoritos, voltar, ficha de canal
    ├── components/            # icons, cards, controls, header, overlay (sheet/diálogo), toast, virtual-list
    └── screens/               # home, tv, library (filmes+séries), detail, search, settings, sources
tests/  unit/*.test.js · e2e/smoke.mjs · serve.mjs
```

**Contrato estável:** os ecrãs só falam com `data/catalog.js`. Na Fase 3 a fachada passa a ler do IndexedDB sem alterar nenhum ecrã. Regras de código verificadas automaticamente pelos testes: sem atributos `style` em templates (CSP), sem `alert/confirm/prompt`, sem `eval`, sem cores literais fora de `tokens.css`.

## 4. Módulos e responsabilidades

### 4.1 Core
- **router.js** — router por *hash* (`#/tv`, `#/movies/123`). Escolhido porque o GitHub Pages não suporta reescrita de URLs: um router por *history* daria 404 ao recarregar uma página interna.
- **store.js** — estado global mínimo com subscrição por chave (sem framework).
- **dom.js** — `html\`...\`` (tagged template que **escapa todos os valores por omissão**), `text()`, `safeUrl()`. É a defesa central contra injeção.

### 4.2 Data (IndexedDB)
Wrapper próprio sobre IndexedDB (≈150 linhas, Promise-based). Base de dados `iptv-player`, *object stores*:

| Store | Chave | Índices | Conteúdo |
|---|---|---|---|
| `sources` | `id` | — | Listas configuradas (tipo, URL/servidor, credencial cifrada, estado, última atualização, intervalo de auto-update, ativa) |
| `items` | `id` (hash fonte+url) | `sourceId`, `kind`, `[kind+categoryId]`, `nameNorm` | Canais, filmes, séries (registo comum + campos por tipo) |
| `categories` | `id` | `sourceId`, `kind` | Categorias normalizadas + overrides do utilizador |
| `episodes` | `id` | `seriesId` | Episódios (carregados a pedido em Xtream) |
| `favorites` | `itemKey` | `kind`, `addedAt` | Favoritos |
| `history` | `itemKey` | `kind`, `updatedAt` | Último visto + posição de reprodução (continuar a ver) |
| `epgChannels` | `id` | — | Canais XMLTV |
| `epgProgrammes` | `[channelId+start]` | `channelId`, `stop` | Programas (janela limitada: −2 h a +48 h) |
| `settings` | `key` | — | Preferências |
| `keys` | `id` | — | `CryptoKey` AES-GCM **não exportável** |

`itemKey` usa `tvg-id`/ID Xtream quando existe, senão hash de nome normalizado + URL — assim favoritos e histórico **sobrevivem a uma atualização da lista**.

LocalStorage só guarda: vista lista/grelha, último separador, tema de ordenação.

### 4.3 IPTV
- **m3u-parser.js** — parser incremental (linha a linha, por *chunks*), tolerante: atributos com/sem aspas, `#EXTGRP`, `#EXTVLCOPT` (ignorado com registo), BOM, CRLF, linhas vazias, entradas sem URL, URL sem `#EXTINF`. Corre num **Web Worker** e grava na BD em lotes de 500 → a UI nunca bloqueia; progresso reportado ao ecrã.
- **classifier.js** — classifica cada entrada em `live | movie | series` com regras ponderadas e configuráveis: padrão do URL (`/movie/`, `/series/`, extensão `.mp4/.mkv`), palavras em `group-title` (VOD, Filmes, Séries, S01E02…), presença de `tvg-id`. O utilizador pode **reclassificar uma categoria inteira** (override guardado em `categories`).
- **xtream-api.js** — cliente defensivo do `player_api.php` (`get_live_categories`, `get_live_streams`, `get_vod_*`, `get_series*`, `get_short_epg`, `xmltv.php`). Valida cada resposta com esquemas simples (tipo, campos obrigatórios), normaliza diferenças entre implementações (números vs strings, `null` vs `""`, arrays vs objetos) e traduz erros (`auth: 0`, conta expirada, max connections) para mensagens compreensíveis.
- **source-sync.js** — orquestra atualizações (manual, ao abrir a app se o intervalo expirou). **Não há atualização em segundo plano no iOS** — explicado ao utilizador.

### 4.4 Player
- **capabilities.js** — deteção real: `canPlayType('application/vnd.apple.mpegurl')`, `MediaSource`/`ManagedMediaSource`, `webkitShowPlaybackTargetPicker` (AirPlay), `webkitSupportsPresentationMode('picture-in-picture')`, volume controlável (teste de escrita em `video.volume`), `audioTracks`, `textTracks`. **A UI só mostra controlos suportados.**
- **Motores**: `native` (iPhone/Safari) → `hls.js` (Chrome/Firefox desktop) → `direct` (MP4 progressivo). Escolha automática por tipo de conteúdo e capacidade.
- **Recuperação**: estados `idle → loading → playing ↔ buffering → error`. Em direto: reconexão com *backoff* exponencial (1s, 2s, 4s, 8s, máx. 5 tentativas) em `stalled`/`error`; em VOD: retoma na última posição.
- **Progresso VOD** gravado a cada 10 s e em `pagehide` → "Continuar a ver".

### 4.5 EPG
- **xmltv-parser.js** — XMLTV pode ter 50–200 MB. `DOMParser` não existe em Workers e carregaria tudo em memória, portanto: **parser de streaming próprio** para o subconjunto XMLTV (`channel`, `display-name`, `icon`, `programme`, `title`, `desc`), suporte a `.xml.gz` via `DecompressionStream`, e filtro por janela temporal e por canais presentes nas listas. Corre em `epg.worker.js`.
- **Fusos horários**: XMLTV usa `20261126203000 +0000`; converte-se para epoch UTC e mostra-se no fuso do dispositivo. Ajuste manual de desvio (±h) por fonte para EPGs mal configurados.
- **Associação** canal↔EPG por ordem: `tvg-id` exato → `tvg-id` normalizado (minúsculas, sem `.pt`, sem espaços) → `tvg-name`/nome normalizado (remove "HD", "FHD", "PT:", "|") → associação manual pelo utilizador.

### 4.6 PWA
- **sw.js** — *precache* versionado do *app shell* (HTML/CSS/JS/ícones). Estratégia: *cache-first* para o shell, **rede direta (sem cache) para tudo o que é externo**: streams, listas, API Xtream, imagens de terceiros (estas podem usar uma cache de imagens limitada a N entradas, sem credenciais nos URLs).
- **Atualização**: ao detetar nova versão do SW → toast "Nova versão disponível · Atualizar" → `skipWaiting` + reload. Fallback: verificação de versão a cada abertura da app, para nunca ficar preso numa versão antiga.

## 5. Fluxos principais

**Adicionar lista M3U por URL**
1. Validação do URL (`https:`/`http:`, sem credenciais embutidas visíveis no log, tamanho máx.).
2. `fetch` com *timeout* (AbortController, 30 s) → se falhar por CORS/mixed content, mensagem específica com alternativas (ver §6).
3. Stream de texto → Worker → parse + classificação → gravação em lotes → progresso na UI.
4. Resumo: N canais, N filmes, N séries, N duplicados ignorados, N entradas inválidas.

**Reproduzir canal**
Toque no canal (gesto do utilizador → autoplay com som permitido) → `capabilities` escolhe motor → overlay de carregamento → `playing` → grava histórico/último canal → se erro, reconexão automática com feedback visual.

## 6. Restrições críticas do iPhone (resumo)

Detalhe completo em [`IOS-CONSTRAINTS.md`](./IOS-CONSTRAINTS.md). As três que condicionam a arquitetura:

1. **CORS + Mixed content** — a app é servida por HTTPS; muitos servidores IPTV são HTTP e não enviam cabeçalhos CORS. O carregamento de *listas/API* por `fetch` pode ser bloqueado. A reprodução por `<video>` com HLS nativo **não exige CORS**, mas pode ser afetada por mixed content.
2. **Formatos** — Safari reproduz HLS (TS/fMP4) e MP4. **Não reproduz MKV/AVI nem MPEG-TS "cru"** (sem playlist `.m3u8`). Em Xtream, os canais em direto são pedidos com extensão `.m3u8`; filmes `.mkv` serão marcados como incompatíveis em vez de falharem silenciosamente.
3. **Ecrã inteiro e orientação** — no iPhone só o *elemento vídeo* entra em ecrã inteiro (com controlos nativos da Apple). Não existe bloqueio de orientação programático. O player próprio funciona *inline* (com modo imersivo em horizontal); o botão "Ecrã inteiro" passa para o modo nativo do iOS, que traz AirPlay, PiP, legendas e áudio.

## 7. Testes

| Nível | Ferramenta | Âmbito |
|---|---|---|
| Unitário | `node --test` (Node 22, sem dependências) | parser M3U, classificador, normalização Xtream, parser XMLTV, matcher EPG, escape HTML, validação de URLs |
| Integração UI | Playwright (Chromium, já disponível no ambiente de desenvolvimento) | navegação, estados vazios, importação de fixtures, viewport iPhone |
| Reprodução | Streams HLS públicos de teste (ex.: streams de teste da Apple) | motor nativo/hls.js, erros, reconexão |
| Dispositivo real | **iPhone do utilizador** (insubstituível) | instalação, HLS nativo, AirPlay, PiP, rotação, safe areas, mixed content |

O ambiente de desenvolvimento **não tem WebKit/iOS**. Tudo o que for específico do Safari iOS fica marcado como "a validar no dispositivo" até o utilizador confirmar.
