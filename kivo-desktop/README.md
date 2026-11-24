# Kivo — aplicação desktop para Windows

Conversão do protótipo **Kivo v3** (Claude Design → artefacto "Kivo") numa aplicação Windows nativa, **totalmente offline**, com Electron e electron-builder.
A interface, o design e o comportamento são os do protótipo original; as alterações estão listadas em [`docs/AUDITORIA.md`](docs/AUDITORIA.md).

## Entregáveis

| Ficheiro (após `npm run dist`) | O que é |
|---|---|
| `dist/Kivo-Setup-1.0.0.exe` | Instalador NSIS (escolha da pasta, atalhos no ambiente de trabalho e menu Iniciar, desinstalador) |
| `dist/Kivo-Portable-1.0.0.exe` | Versão portátil (corre sem instalar) |
| `dist/win-unpacked/` | Aplicação descompactada (diagnóstico) |

O utilizador final **não** precisa de Node.js, npm ou Electron.

## Estrutura

```
kivo-desktop/
├─ original/            Código original do protótipo, intocado (referência)
├─ app/                 Aplicação web usada pelo Electron (cópia do original + adaptações mínimas assinaladas "[desktop]")
│  ├─ index.html        = "Kivo v3.html" (fontes locais, CSP, script inline extraído)
│  ├─ kivo-v3.js        dados e lógica (original + KV.snapshot / KV.duetto)
│  ├─ kivo-ui.js        interface (ex-<script> inline; cópias de segurança reais)
│  ├─ desktop/bridge.js espelho localStorage ↔ disco
│  ├─ fonts/            Inter (variável) local — sem Google Fonts
│  └─ _ds/…             tokens do design system
├─ electron/            Camada desktop
│  ├─ main.js           janela, protocolo kivo://, segurança, IPC
│  ├─ preload.js        API mínima exposta via contextBridge
│  ├─ storage.js        armazenamento em userData, cópias de segurança, validação
│  └─ menu.js           menus nativos (PT-PT)
├─ build/               Ícones (icon.ico, icon.png) e imagem de origem
├─ scripts/build-win.js Compilação Windows (NSIS + portátil)
├─ electron-builder.yml Configuração do instalador
├─ tests/               Testes end-to-end (Playwright + Electron)
└─ docs/                Auditoria e relatório de testes
```

## Onde ficam os dados (Windows)

Tudo em **`%APPDATA%\Kivo\`** (ex.: `C:\Users\<utilizador>\AppData\Roaming\Kivo\`) — nunca na pasta de instalação.

| Caminho | Conteúdo |
|---|---|
| `Local Storage\` | Armazenamento principal usado pela aplicação (chave `kivo:v3`) |
| `data\kivo-state.json` (+ `.bak`) | Espelho em disco, escrito de forma atómica a cada alteração. Se o armazenamento principal se perder, a aplicação recupera daqui no arranque |
| `backups\auto\` | Cópia automática em cada arranque (guarda as últimas 10) |
| `backups\kivo-antes-de-restaurar-*.kivo` | Estado anterior guardado automaticamente antes de cada restauro |
| `settings.json` | Tamanho/posição da janela e últimas pastas usadas |
| `kivo-erros.log` | Só existe se ocorrer um erro |

No Kivo: **Ajuda › Onde estão os meus dados?** ou **Ficheiro › Abrir pasta de dados**.

**Desinstalar não apaga esta pasta.** Para apagar tudo manualmente: desinstalar e depois eliminar `%APPDATA%\Kivo`.

## Cópias de segurança

- **Definições › Dados › Descarregar cópia de segurança** (ou `Ctrl+S`): escolhe a pasta e o nome; gera um ficheiro `.kivo` (JSON com verificação SHA-256).
- **Restaurar cópia de segurança…**: valida o ficheiro (formato, versão, integridade, estrutura), pede confirmação, guarda o estado atual em `backups\` e só depois substitui.
- **Exportar para o Duetto**: JSON com contas, categorias, transações e investimentos.

## Compilar

Requisitos de desenvolvimento: Node.js 20+.

```bash
npm install
npm start            # abre a aplicação em modo de desenvolvimento
npm test             # testes end-to-end (em Linux sem ecrã: xvfb-run -a npm test)
npm run dist         # gera dist/Kivo-Setup-1.0.0.exe e dist/Kivo-Portable-1.0.0.exe
```

Em Windows, `npm run dist` funciona diretamente. Em Linux/macOS também funciona sem Wine (ver `scripts/build-win.js`).
Para testar a versão empacotada: `KIVO_EXECUTABLE=<caminho do executável> npm test`.

## Atualizar a aplicação

1. Alterar o código em `app/` (interface) ou `electron/` (camada desktop).
2. Subir a versão em `package.json` (ex.: `1.0.1`).
3. `npm test` e `npm run dist`.
4. Instalar o novo `Kivo-Setup-1.0.1.exe` por cima do anterior: o instalador substitui os ficheiros do programa e **mantém os dados** (`%APPDATA%\Kivo`). O `appId` (`pt.kivo.desktop`) não deve mudar, senão o Windows trata a nova versão como outra aplicação.

Para trazer uma nova versão do protótipo do Claude Design: copiar os novos ficheiros para `original/`, repetir as adaptações descritas em `docs/AUDITORIA.md` (secção "Alterações feitas") e correr os testes.

## Assinatura de código

O executável não está assinado (não existe certificado). No primeiro arranque o Windows SmartScreen pode mostrar "O Windows protegeu o computador" → **Mais informações › Executar mesmo assim**. Para distribuir a terceiros, recomenda-se um certificado de assinatura de código (configurar `win.signtoolOptions` / `CSC_LINK`).
