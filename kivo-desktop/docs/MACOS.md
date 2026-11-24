# Kivo para macOS

## Que ficheiro descarregar

| Mac | Ficheiro |
|---|---|
| Apple Silicon (M1, M2, M3, M4…) | `Kivo-1.0.0-macOS-arm64.zip` |
| Intel | `Kivo-1.0.0-macOS-x64.zip` |

Para saber qual é o teu: menu  › **Acerca deste Mac** › linha "Chip" (Apple M…) ou "Processador" (Intel).

Requisitos: macOS 12 (Monterey) ou mais recente.

## Instalar (1–2 minutos)

1. Faz duplo clique no `.zip`. Aparece `Kivo.app`.
2. Arrasta `Kivo.app` para a pasta **Aplicações**.
3. A app não está assinada pela Apple (não existe conta Apple Developer), por isso o macOS bloqueia-a. Abre o **Terminal** (Aplicações › Utilitários) e cola estas duas linhas:

   ```bash
   xattr -cr /Applications/Kivo.app
   codesign --force --deep --sign - /Applications/Kivo.app
   ```

   - A 1.ª linha retira a marca "descarregado da internet".
   - A 2.ª aplica uma assinatura local ("ad-hoc"). É obrigatória em Apple Silicon, porque sem ela o macOS diz que a app "está danificada". Em Intel não faz mal correr. O `codesign` já vem com o macOS.
4. Abre o Kivo a partir de Aplicações ou do Launchpad.

Sem estes comandos, o macOS mostra *"Kivo está danificado e não pode ser aberto"* ou *"não é possível verificar o programador"*. É um aviso de assinatura, não um problema com o ficheiro.

## Dados

| | |
|---|---|
| Pasta de dados | `~/Library/Application Support/Kivo/` (mesma estrutura do Windows: `data/`, `backups/auto/`, `settings.json`) |
| Abrir a pasta | No Kivo: **Ficheiro › Abrir pasta de dados** ou **Ajuda › Onde estão os meus dados?** |
| Desinstalar | Arrastar `Kivo.app` para o Lixo. **Os dados ficam.** Para apagar tudo, apaga também a pasta acima |

As cópias de segurança `.kivo` são compatíveis entre Windows e macOS. Para passar os dados de um PC para um Mac: **Descarregar cópia de segurança** no Windows e depois **Restaurar cópia de segurança** no Mac.

## Diferenças em relação ao Windows

- Menu da aplicação "Kivo" (Sobre, Definições `⌘,`, Ocultar, Sair `⌘Q`) e menu "Janela", como nas apps nativas.
- Fechar a janela (`⌘W`) mantém o Kivo na Dock; clicar no ícone reabre-a. Para sair: `⌘Q`.
- Atalhos: `⌘S` cópia de segurança, `⌘K` pesquisa, `⌘1`…`⌘9` secções. A dica "Ctrl K" na barra lateral é do desenho original; em Mac funciona com `⌘K`.
- Formato `.zip` em vez de instalador (num Mac não é necessário instalador).

## Compilar num Mac (recomendado para uso continuado)

Num Mac com Node.js 20+:

```bash
npm install
npm run dist:mac:signed    # gera dist/Kivo-1.0.0-macOS-arm64.dmg/.zip e …-x64, já com assinatura ad-hoc
```

Assim já não é preciso o comando `codesign`. Na primeira abertura, se o macOS avisar, vai a **Definições do Sistema › Privacidade e segurança › Abrir mesmo assim**.

Para distribuir a outras pessoas sem avisos é preciso uma conta **Apple Developer** (99 USD/ano): certificado "Developer ID Application" + notarização. Configurar `mac.identity`, `mac.hardenedRuntime: true` e `mac.notarize` no `electron-builder.yml`.

## O que foi testado

| Verificação | Resultado |
|---|---|
| Código da aplicação (partilhado com Windows): 12 testes end-to-end | ✅ 12/12 (em Linux) |
| `Kivo.app` arm64 e x64: executável Mach-O da arquitetura certa, Info.plist (nome, `pt.kivo.desktop`, versão 1.0.0, macOS ≥ 12, categoria Finanças), ícone `.icns`, `app.asar` igual ao código testado, links simbólicos da framework preservados no zip | ✅ Verificado |
| Abrir a app num Mac real | ⚠️ **Não executado** (compilado em Linux, sem Mac disponível) |

Checklist num Mac: seguir "Instalar" acima → criar uma conta a pagar → `⌘Q` → reabrir (a conta existe) → desligar o Wi-Fi e navegar → descarregar e restaurar uma cópia de segurança → confirmar `~/Library/Application Support/Kivo/data/kivo-state.json`.
