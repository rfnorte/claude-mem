# Auditoria técnica — Kivo (artefacto Claude Design)

## 1. Estrutura encontrada

O artefacto "Kivo" é um projeto Claude Design com várias iterações:

| Ficheiro | Natureza | Usado? |
|---|---|---|
| `Kivo v3.html` + `kivo-v3.js` | **Versão mais recente e funcional** (protótipo interativo, 15 secções) | **Sim — base da app desktop** |
| `Kivo v3 (offline).html` | A mesma v3 empacotada pelo "bundler" do Claude Design (560 KB, recursos em base64) | Não (duplicado) |
| `Kivo v2.html`, `Kivo.html`, `uploads/Kivo.html` | Versões anteriores | Não |
| `*.dc.html` (Kivo App, Design System, Direções visuais, Proposta) | Páginas de desenho/apresentação | Não (não são a aplicação) |
| `uploads/kivo.png` | Logótipo 1254×1254 | Sim — ícone |
| `_ds/…/tokens/sserp-tokens.css` | Tokens do design system | Sim |

## 2. Tecnologias

- HTML + CSS + JavaScript puro (sem frameworks, sem bundler, sem dependências npm).
- Ícones SVG inline; logótipo PNG em `data:` URI.
- Navegação por `location.hash` (15 vistas: Início, Revisão, Transações, Contas a pagar, Contas, Importar, Análises, Património líquido, Investimentos, Previsão, Dívida, Orçamento, Objetivos, Revisão semanal, Definições).
- Diálogos `<dialog>` nativos, `MutationObserver` para persistir partes editáveis da interface.

## 3. Armazenamento original

- **`localStorage`, chave `kivo:v3`**: objeto JSON `{ v: 1, tx, bills, rules, wiped, snaps, payday, review, ui, seq }`.
- `snaps` guarda o HTML de 4 zonas editáveis (`#acc-list`, `#groups`, `#people`, `#imp-list`).
- Gravação com atraso de 150 ms após cada alteração.
- Dados de exemplo gerados por código (`seedTx`, `seedBills`, `seedRules`) quando não há estado.

## 4. Dependências externas / online

| Dependência | Impacto offline | Solução |
|---|---|---|
| Google Fonts (Inter 400–700) | Sem internet, a fonte cairia para Segoe UI → aspeto diferente | Inter variável servida localmente (`app/fonts/`, licença OFL) |
| Nenhuma outra | — | — |

Não há chamadas `fetch`/XHR, CDN, analytics nem serviços cloud.

## 5. Compatibilidade com Electron

| Ponto | Avaliação |
|---|---|
| Código só de browser, sem Node | Compatível com `contextIsolation` + `sandbox` |
| `<script>` inline | Extraído para `kivo-ui.js` para permitir CSP estrita (`script-src 'self'`) |
| Estilos inline (muitos) | Mantidos; CSP permite `style-src 'unsafe-inline'` (não executa código) |
| `localStorage` | Funciona; servido a partir de um protocolo próprio `kivo://app` com origem estável → dados persistentes em `%APPDATA%\Kivo` |
| `<input type=file>` e arrastar ficheiros | Funcionam; `navigateOnDragDrop: false` evita que largar um ficheiro fora da zona substitua a app |

## 6. Problemas identificados

| # | Problema | Gravidade | Decisão |
|---|---|---|---|
| P1 | **Cópia de segurança simulada**: "Descarregar cópia" só mostrava um aviso; "Restaurar" esperava 1,2 s e dizia "restaurada" sem fazer nada | Alta (risco de falsa sensação de segurança) | **Implementado de verdade** (ficheiro `.kivo`, validação, cópia prévia do estado atual) |
| P2 | **"Exportar para o Duetto" simulado** (só aviso) | Média | **Implementado** (JSON real) |
| P3 | **Importação de extratos simulada**: qualquer PDF/CSV/XLSX/OFX "importa" sempre 41 transações fictícias; XTB idem com 3 | Alta | **Não alterado** — ler extratos ActivoBank/XTB é funcionalidade nova (parsers), não conversão. Fica identificado como limitação do protótipo e proposto como fase seguinte |
| P4 | Data "hoje" fixa (`05 out 2026`) e dados de exemplo | Média | Não alterado (é o comportamento do protótipo; mudar altera todos os cálculos) |
| P5 | Só `localStorage` (um único ponto de falha) | Média | Espelho em disco + cópias automáticas (ver §7) |
| P6 | Rótulos só para leitores de ecrã posicionados fora da janela → 13 px de deslocamento horizontal em Transações a ≤ 1100 px | Baixa | Corrigido com 1 regra CSS sem efeito visual |
| P7 | 1–2 px de texto a mais em "Análises"/"Importar" exatamente a 1024 px | Muito baixa | Não alterado (design original) |

## 7. Armazenamento escolhido (e porque não SQLite)

O estado é um único documento JSON de ~100–300 KB. Migrar para SQLite obrigaria a reescrever a camada de dados de `kivo-v3.js` (contrário a "não reconstruir") e a trazer um módulo nativo para o pacote, sem ganho real para este volume.

Solução adotada (sem alterar a lógica da app):

1. **Primário**: `localStorage` do Electron, no perfil persistente `%APPDATA%\Kivo\Local Storage` — sobrevive a atualizações e reinstalações.
2. **Espelho em disco**: cada gravação de `kivo:v3` é validada e escrita de forma atómica (ficheiro temporário + `fsync` + `rename`) em `data\kivo-state.json`, mantendo `.bak` da versão anterior.
3. **Recuperação**: no arranque, se o `localStorage` estiver vazio mas existir espelho válido, os dados são repostos antes de a app os ler.
4. **Cópias automáticas**: uma por arranque em `backups\auto` (últimas 10).
5. **Nunca se apaga**: "Repor dados de exemplo" e "Restaurar" renomeiam/guardam o estado anterior em vez de o eliminar.

Migração de dados: não há registos a migrar. O protótipo guardava os dados no `localStorage` do browser onde era aberto (isolado por origem, inacessível a outra aplicação) e não tinha exportação real (P1), pelo que não existe um caminho para transferir esses dados. A app desktop arranca com os mesmos dados de exemplo do protótipo e passa a ser a fonte de dados.

## 8. Alterações feitas ao código original

Todas assinaladas com `[desktop]` no código. Nada foi removido.

| Ficheiro | Alteração |
|---|---|
| `index.html` | Google Fonts → `fonts/inter.css`; CSP; título "Kivo"; `<script>` inline → `kivo-ui.js`; `desktop/bridge.js` carregado antes; botões de cópia/exportação ligados a ações reais; texto `.db` → `.kivo`; 1 regra CSS (P6) |
| `kivo-v3.js` | `KV.snapshot()` e `KV.duetto()` acrescentados à API existente |
| `kivo-ui.js` | Restauro real (com validação e confirmação existente), exportações reais, ações do menu nativo. No browser mantém o comportamento original |
