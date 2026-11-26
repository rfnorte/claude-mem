# IPTV Player — PWA para iPhone

Leitor IPTV pessoal, instalável no iPhone pelo Safari ("Adicionar ao ecrã principal"), sem App Store e sem custos de alojamento.

> A aplicação **não inclui** canais, listas, credenciais nem conteúdos. Cada utilizador introduz as suas próprias fontes autorizadas, que ficam guardadas **apenas no dispositivo**.

## Estado

| Fase | Estado |
|---|---|
| 1. Planeamento e arquitetura | ✅ Concluída |
| 2. Design System + shell | ⏳ Seguinte |
| 3–10 | Por iniciar |

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
