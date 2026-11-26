# IPTV Player — PWA para iPhone

Leitor IPTV pessoal, instalável no iPhone pelo Safari ("Adicionar ao ecrã principal"), sem App Store e sem custos de alojamento.

> A aplicação **não inclui** canais, listas, credenciais nem conteúdos. Cada utilizador introduz as suas próprias fontes autorizadas, que ficam guardadas **apenas no dispositivo**.

## Estado

| Fase | Estado |
|---|---|
| 1. Planeamento e arquitetura | ✅ Concluída |
| 2. Design System + shell (5 ecrãs, componentes, modo demonstração) | ✅ Concluída |
| 3. Gestão IPTV (parser M3U, Xtream, IndexedDB) | ⏳ Seguinte |
| 4–10 | Por iniciar |

### O que já funciona (v0.2.0)
- Navegação completa: Início, TV, Filmes, Séries, Definições, Pesquisa global, detalhe de filme/série, gestão de listas.
- **Modo demonstração** com conteúdos fictícios gerados localmente (sem URLs nem streams) para avaliar a interface.
- TV: categorias, pesquisa instantânea, ordenação, vista lista/grelha, lista virtualizada (milhares de canais sem lentidão), ficha do canal com "agora/a seguir".
- Filmes e séries: géneros, ordenação, continuar a ver, temporadas e episódios, último episódio visto.
- Favoritos (em memória nesta fase — persistência na Fase 7).
- Formulário de lista (URL / ficheiro / Xtream) com validação real; **a gravação é ativada na Fase 3**.
- Eliminação de dados locais com confirmação.

### O que ainda não funciona (intencionalmente)
- Reprodução de vídeo (Fase 4) — o botão "Reproduzir" está desativado e indica a fase.
- Importação de listas reais (Fase 3), EPG real (Fase 6), backup (Fase 7), instalação offline completa (Fase 8).

## Pré-visualizar no computador

Requer [Node.js](https://nodejs.org) (só para desenvolvimento — a app não precisa dele):

```bash
cd iptv-player
node tests/serve.mjs
```

Abrir `http://localhost:5173` no browser. Para simular um iPhone no Chrome: F12 → ícone de telemóvel → "iPhone 14 Pro".

## Testes

```bash
npm test            # testes unitários (node --test, sem dependências)
npm run test:e2e    # fluxos completos em Chromium, vertical e horizontal (requer Playwright)
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, módulos, modelo de dados, fluxos, testes |
| [docs/IOS-CONSTRAINTS.md](docs/IOS-CONSTRAINTS.md) | Limitações técnicas do iPhone/Safari e mitigação |
| [docs/SECURITY.md](docs/SECURITY.md) | Segurança, credenciais, CSP, privacidade |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Plano por fases, complexidade, riscos, alojamento |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Identidade visual, tokens, componentes |

## Stack

HTML + CSS + JavaScript (ES Modules nativos), sem passo de build · IndexedDB · Service Worker · HLS nativo do Safari (hls.js apenas como alternativa em desktop).

## Nunca colocar neste repositório

Listas `.m3u`, ficheiros de backup, URLs de servidores, usernames ou passwords. O `.gitignore` bloqueia os casos mais comuns, mas a responsabilidade final é de quem faz o commit.
