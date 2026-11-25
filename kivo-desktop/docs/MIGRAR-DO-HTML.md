# Passar os dados do Kivo HTML para o Kivo desktop

A versão HTML guarda os dados no armazenamento interno do browser onde é aberta (chave `kivo:v3`), e não tinha exportação real. O script [`scripts/exportar-do-browser.js`](../scripts/exportar-do-browser.js) lê esses dados e cria um ficheiro `.kivo`, que o Kivo desktop restaura. O script não altera nem apaga nada no browser.

Testado: dados criados no `Kivo v3.html` original → script → ficheiro aceite pela validação do Kivo desktop (90 transações, 7 contas a pagar, 12 regras, incluindo a conta criada no teste).

## Passos

1. Abre o Kivo HTML **no mesmo browser e da mesma forma que usas habitualmente**: o mesmo ficheiro no PC ou o mesmo artefacto no claude.ai. Os dados só existem nesse browser.
2. Carrega em **F12** (Mac: `⌥⌘J`) › separador **Consola**.
3. **Só se usas o Kivo como artefacto no claude.ai:** no topo da consola há uma lista que diz `top`. Escolhe a página do Kivo (o *iframe*, normalmente com um nome de domínio `claudeusercontent`). Se escolheres o errado, o script avisa que não encontrou dados.
4. Cola o conteúdo de `exportar-do-browser.js` e carrega em Enter. O Chrome/Edge pode pedir que escrevas `allow pasting` antes de deixar colar.
5. Aparece uma mensagem `KIVO: ficheiro "kivo-migracao-AAAA-MM-DD.kivo" criado — N transações…` e o ficheiro é descarregado.
   - Se o download não aparecer (o claude.ai pode bloqueá-lo), o conteúdo já está copiado: abre o Bloco de Notas/TextEdit, cola, e grava como `kivo-migracao.kivo` (no Bloco de Notas, escolhe "Todos os ficheiros" para não ficar `.txt`).
6. No Kivo desktop: **Definições › Dados › Restaurar cópia de segurança…** › escolhe o ficheiro › confirma.
   O Kivo guarda primeiro o estado atual em `backups/` e só depois substitui.

## Se o script disser que não há dados

- A consola está no contexto errado (passo 3), ou
- estás noutro browser/perfil/janela anónima, ou
- usaste uma versão anterior (`Kivo.html`, `Kivo v2.html`), que não gravava dados — ao fechar, perdiam-se, ou
- o artefacto no claude.ai não permitiu gravar (o Kivo continuava a funcionar, mas sem guardar).

Nesses casos não há nada a migrar.
