# Relatório de testes e revisão de segurança — Kivo 1.0.0

Data: 24 nov 2026 · Ambiente de execução: Linux x64 (contentor), Electron 38, Playwright, ecrã virtual Xvfb 1920×1080.

## Resumo

| | Resultado |
|---|---|
| Testes automáticos sobre o código-fonte | **12/12 passaram** |
| Os mesmos testes sobre a aplicação **empacotada** (`app.asar`, `isPackaged = true`) | **12/12 passaram** |
| Compilação Windows (NSIS + portátil, x64) | Concluída; ícone (9 tamanhos) e metadados verificados no `.exe` |
| Instalação/desinstalação real em Windows | **Não executada** — ver §3 |

Comando: `xvfb-run -a npm test` (código-fonte) e `KIVO_EXECUTABLE=dist-linux/linux-unpacked/kivo-desktop xvfb-run -a npm test` (empacotada).

## 1. Testes obrigatórios

| # | Teste pedido | Estado | Como foi verificado |
|---|---|---|---|
| 1 | Arranque da aplicação | ✅ Executado | Janela visível, título "Kivo", menu nativo, sem erros JS, fonte Inter local carregada, `require`/`process`/`ipcRenderer` inexistentes na página |
| 2 | Navegação entre todas as secções | ✅ Executado | As 15 secções pela barra lateral (uma única vista visível de cada vez) + menu nativo "Ir" |
| 3 | Criar, editar e eliminar registos | ✅ Executado | Conta a pagar: criar, editar valor, eliminar com confirmação. Transação: editar comerciante. Regra: criar e eliminar |
| 4 | Persistência após fechar e reabrir | ✅ Executado | Alterações presentes após reabrir; espelho em disco atualizado. Extra: apagado o `Local Storage` → dados recuperados do disco |
| 5 | Funcionamento sem internet | ✅ Executado | Todas as secções percorridas sem nenhum pedido fora de `kivo://`; `fetch` externo bloqueado (CSP + filtro de rede) |
| 6 | Exportação e importação de dados | ✅ Executado | Cópia `.kivo` gerada e validada (SHA-256); exportação Duetto com contas, categorias, transações e investimentos |
| 7 | Backups e recuperação | ✅ Executado | Restauro com confirmação; cancelar não altera nada; ficheiro estragado, adulterado (falha de integridade) e extensão errada recusados sem tocar nos dados; cópia "antes de restaurar" criada e com os dados substituídos; restauro persiste após reabrir; cópias automáticas no arranque |
| 8 | Fecho e reabertura | ✅ Executado | Vários ciclos fechar/abrir ao longo da suite; tamanho/posição da janela guardados |
| 9 | Instalação numa pasta diferente | ⚠️ **Não executado** | Ver §3 |
| 10 | Desinstalação e dados do utilizador | ⚠️ **Não executado em Windows** | Verificado por configuração — ver §3 |

Testes adicionais executados:

- **Resoluções** 1920×1080, 1366×768, 1024×700 e 800×600 em todas as 15 secções: sem deslocamento horizontal (tolerância 2 px, ver P7 na auditoria).
- **Segurança**: navegação para site externo bloqueada; `window.open` devolve `null` e não cria janelas; estado inválido enviado por IPC é rejeitado (ficheiro intacto); `kivo://app/../electron/main.js` não é servido.
- **Repor dados de exemplo**: o estado anterior é guardado (`kivo-state.removido-*.json`) e não "ressuscita" ao reabrir.
- **Cancelar o diálogo de gravação**: sem ficheiros nem mensagens de erro.

## 2. Verificações do instalador (estáticas)

| Verificação | Resultado |
|---|---|
| `Kivo.exe` (x64): ícone e metadados | 9 ícones; ProductName "Kivo", versão 1.0.0.0 |
| `Kivo-Setup-1.0.0.exe` / `Kivo-Portable-1.0.0.exe` | Ícone próprio; versão 1.0.0 |
| Conteúdo do instalador (7-Zip) | `Kivo.exe`, `resources/app.asar` (só `app/`, `electron/`, `package.json`, ícone — sem testes, docs ou `node_modules`) |
| Opções NSIS | Assistido (não "one-click"), escolha da pasta, atalhos no ambiente de trabalho e menu Iniciar, desinstalador, executar no fim |
| Dados na desinstalação | `deleteAppDataOnUninstall: false` → o modelo de desinstalação do electron-builder só executa `RMDir "$APPDATA\Kivo"` se `DELETE_APP_DATA_ON_UNINSTALL` estiver definido (não está) ou se for chamado com `--delete-app-data` |

## 3. O que não foi possível executar — e como validar em Windows

O contentor de compilação é Linux. O Wine (9.0 do sistema e 11 do electron-builder) falha neste ambiente (*segmentation fault* / `ntdll.dll c0000135`), por isso **não foi possível correr o instalador nem o `.exe`**. O `.exe` contém exatamente o mesmo `app.asar` que passou os 12 testes na versão empacotada Linux, mas o comportamento específico de Windows não foi observado.

Checklist manual (≈10 min, num PC Windows 10/11):

1. Correr `Kivo-Setup-1.0.0.exe` → SmartScreen: *Mais informações › Executar mesmo assim*.
2. Em "Pasta de destino", escolher outra pasta (ex.: `D:\Apps\Kivo`) → instalar. Confirmar atalho no ambiente de trabalho e no menu Iniciar com o ícone Kivo.
3. Abrir, criar uma conta a pagar, fechar, reabrir → a conta existe.
4. Desligar o Wi-Fi → abrir e navegar por todas as secções.
5. Definições › Descarregar cópia de segurança → guardar no Ambiente de trabalho. Restaurar essa cópia.
6. Confirmar que existe `%APPDATA%\Kivo\data\kivo-state.json` e `%APPDATA%\Kivo\backups\auto\`.
7. Desinstalar (Definições do Windows › Aplicações). Confirmar que `%APPDATA%\Kivo` **continua** a existir.
8. Reinstalar → os dados reaparecem.
9. Abrir `Kivo-Portable-1.0.0.exe` → abre com os mesmos dados (partilha `%APPDATA%\Kivo`).

## 4. Revisão de segurança

| Requisito | Implementação |
|---|---|
| Não expor Node.js | `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` (e `app.enableSandbox()`); o `ipcRenderer` não sai do preload |
| API mínima | 8 funções via `contextBridge`; argumentos convertidos para string; ações de menu filtradas por lista |
| Validação IPC | Cada pedido confirma que vem da janela principal e de `kivo://app/`; estado validado (JSON, versão, estrutura, tamanho ≤ 50 MB) antes de gravar; cópias validadas (formato, versão, SHA-256, estrutura) |
| Sem execução arbitrária | CSP `default-src 'none'; script-src 'self'` (sem `eval`, sem scripts inline); `webviewTag: false`; `will-attach-webview` bloqueado |
| Navegação restrita | `will-navigate`/`will-redirect` limitados à app; `window.open` negado; downloads e permissões (câmara, notificações, etc.) negados |
| Offline garantido | Todo o tráfego fora de `kivo://` é cancelado ao nível da sessão |
| Ficheiros servidos | Protocolo `kivo://` só serve ficheiros dentro de `app/`, só GET, tipos conhecidos, `nosniff` |
| Ferramentas de programador | Desativadas na versão empacotada |
| Segredos | Nenhum (a app não usa credenciais nem serviços) |
| Dependências | **Zero dependências de produção.** Desenvolvimento: só `electron`, `electron-builder` e `@playwright/test` |
| Escrita de ficheiros | Atómica; o diálogo nativo confirma sobrescrita; extensão forçada (`.kivo`/`.json`) |
| Instância única | Uma segunda execução foca a janela existente (evita duas instâncias a gravar o mesmo estado) |

Não implementado: assinatura de código (sem certificado) e atualizações automáticas (sem servidor — contrário ao requisito offline).
