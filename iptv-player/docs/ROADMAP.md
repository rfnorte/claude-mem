# Plano de desenvolvimento, complexidade, riscos e alojamento

## 1. Plano por fases

Cada fase termina com: código, testes, relatório (feito / ficheiros / testes / problemas / próxima fase) e — quando aplicável — **validação no iPhone pelo utilizador**.

| Fase | Entregáveis | Critério de saída | Complexidade | Validação no iPhone |
|---|---|---|---|---|
| **1. Planeamento** | Arquitetura, restrições iOS, segurança, plano, tokens | Documentação aprovada | Baixa | — |
| **2. Design System + shell** | CSS (base, layout, componentes), tab bar, router, 5 ecrãs com dados fictícios, empty states, skeletons, sheet/modal/toast | Navegação completa, sem botões sem ação (ações futuras marcadas como "em breve" explícito ou ocultas) | Média | Recomendada (safe areas, Dynamic Island, rotação) |
| **3. Gestão IPTV** | IndexedDB, parser M3U em Worker, classificador, cliente Xtream, CRUD de listas, sync manual/auto, testes unitários | Importa fixtures de 50 000 entradas sem bloquear; erros legíveis | **Alta** | **Obrigatória** — testar as fontes reais (CORS) |
| **4. Reprodução** | Player, motores nativo/hls.js, controlos, erros, reconexão, AirPlay/PiP/legendas/áudio por capacidade | Stream de teste reproduz; reconexão comprovada | **Alta** | **Obrigatória** |
| **5. Filmes e séries** | Bibliotecas, detalhe, temporadas/episódios, continuar a ver | Fluxo VOD completo | Média | Sim |
| **6. EPG** | Parser XMLTV streaming, associação, agora/a seguir, grelha | XMLTV de 100 MB processado sem crash | **Alta** | Sim |
| **7. Persistência** | Favoritos, histórico, backup/restauro, eliminar dados | Backup → apagar → restaurar sem perdas | Média | Sim |
| **8. PWA** | Manifesto, SW, ícones, splash, atualização, publicação | Instalação pelo Safari + atualização de versão comprovada | Média | **Obrigatória** |
| **9. QA** | Testes completos, desempenho, segurança, acessibilidade | Zero bugs críticos | Média | Sim |
| **10. Entrega** | Manual, instalação, atualização, backup | Utilizador autónomo | Baixa | — |

> Nota sobre ordem: a Fase 7 (persistência) depende de IndexedDB, que é introduzido logo na Fase 3 — a camada de dados é construída uma vez e completa, e as fases seguintes acrescentam *stores*. Isto evita "versões simplificadas a reconstruir".

### Pedido de antecipação (recomendação)
Recomendo um **"teste de fumo" de conectividade no início da Fase 3**: uma página mínima onde o utilizador cola o URL da sua lista e vê se o iPhone a consegue carregar (CORS/HTTP). É o risco com maior impacto e convém conhecê-lo cedo — determina se será necessário um proxy pessoal.

## 2. Estimativa de complexidade

| Componente | Linhas JS estimadas | Dificuldade principal |
|---|---|---|
| Core + componentes UI | ~2 000 | Lista virtualizada fluida no iOS |
| Dados (IndexedDB, backup, crypto) | ~800 | Migrações de esquema |
| IPTV (parser, classificador, Xtream) | ~1 200 | Variabilidade entre fornecedores |
| Player | ~900 | Diferenças Safari vs. desktop; recuperação de erros |
| EPG | ~800 | Tamanho dos ficheiros; associação de canais |
| PWA | ~300 | Atualização fiável |
| CSS | ~2 000 | — |
| **Total** | **≈ 8 000 linhas** | — |

Classificação global: **projeto de complexidade média-alta**. A interface é trabalho previsível; a incerteza está na rede (CORS/HTTP), nos formatos das fontes e no tamanho dos dados.

## 3. Registo de riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Fonte do utilizador sem CORS / só HTTP → lista não carrega por URL | **Alta** | **Alto** | Importação de ficheiro; teste de fumo cedo; proxy pessoal opcional e gratuito (decisão do utilizador) |
| R2 | Streams só HTTP bloqueados como mixed content no iOS | Média | **Alto** | Validação no dispositivo na Fase 4; preferir HTTPS se o fornecedor oferecer; proxy como último recurso |
| R3 | VOD em MKV não reproduz no iPhone | **Alta** | Médio | Mostrar claramente "formato não suportado"; preferir extensão alternativa (`.mp4`/`.m3u8`) quando o servidor a oferece |
| R4 | Listas/EPG enormes esgotam memória | Média | Alto | Workers, streaming, lotes, virtualização, janela temporal no EPG |
| R5 | API Xtream não normalizada entre fornecedores | **Alta** | Médio | Validação defensiva, normalização, mensagens claras, testes com respostas variadas |
| R6 | Utilizador preso em versão antiga (cache do SW) | Média | Médio | Versionamento, toast de atualização, verificação ativa, botão "Forçar atualização" nas Definições |
| R7 | Dados configurados no Safari não aparecem na PWA instalada | Alta | Baixo | Instruções: instalar primeiro; backup/restauro como ponte |
| R8 | Falta de WebKit/iPhone no ambiente de desenvolvimento | Certa | Médio | Testes em Chromium + checklist explícita para validação manual no iPhone |

## 4. Alojamento gratuito — comparação e recomendação

| Critério | **GitHub Pages** | Cloudflare Pages | Netlify |
|---|---|---|---|
| Custo | Grátis | Grátis | Grátis (limites de largura de banda) |
| HTTPS | ✅ Automático | ✅ Automático | ✅ Automático |
| Repositório privado | ❌ No plano gratuito o repositório tem de ser **público** | ✅ | ✅ |
| Simplicidade para o utilizador | ✅ Tudo no GitHub, sem outra conta | Requer conta Cloudflare | Requer conta Netlify |
| Proxy CORS no mesmo serviço (se necessário) | ❌ | ✅ Workers gratuitos | ⚠️ Functions (limites) |
| Cabeçalhos HTTP personalizados (CSP) | ❌ (CSP via `<meta>`) | ✅ | ✅ |

**Recomendação: GitHub Pages**, a partir de um **repositório dedicado e público** só com a aplicação.

- O código ser público **não é um problema de segurança**: não contém credenciais, listas nem conteúdos — esses ficam apenas no iPhone.
- Simplicidade máxima e sem nova conta.
- **Plano B:** se o teste de fumo (R1) mostrar que é necessário um proxy, migrar para **Cloudflare Pages + Worker** (também gratuito) — a app é estática, por isso a migração é trivial.

Implicações de privacidade do GitHub Pages: o GitHub vê os acessos ao site (IP, user-agent), como qualquer alojamento. Não vê as listas, credenciais ou o que é reproduzido — esses pedidos vão diretamente do iPhone para o fornecedor IPTV.
