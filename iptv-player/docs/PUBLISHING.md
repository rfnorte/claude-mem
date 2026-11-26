# Publicação gratuita (GitHub Pages)

## Porquê um repositório próprio e público

- O GitHub Pages gratuito exige repositório **público**. Não é um risco: o código não tem credenciais, listas nem conteúdos — esses ficam apenas no iPhone.
- Um repositório só com a app evita publicar outro projeto por engano e simplifica o endereço final: `https://<utilizador>.github.io/iptv-player/`.
- O GitHub vê os acessos ao site (como qualquer alojamento), mas **não** vê as suas listas, credenciais nem o que reproduz: esses pedidos vão diretamente do iPhone para o fornecedor.

## Passo 1 — Criar o repositório (utilizador, ~2 minutos)

1. Abra **github.com** no browser e inicie sessão.
2. No canto superior direito, toque em **+** → **New repository**.
3. Em **Repository name** escreva: `iptv-player`.
4. Selecione **Public**.
5. **Não** marque "Add a README", ".gitignore" nem "license" (o repositório tem de ficar vazio).
6. Toque em **Create repository**.
7. Deve aparecer uma página com o título "Quick setup". Pode fechá-la.

## Passo 2 — Enviar o código (Claude Code, automático)

O Claude Code envia o conteúdo da pasta `iptv-player/` para a raiz do novo repositório (ramo `main`).

## Passo 3 — Ativar o GitHub Pages (utilizador, ~1 minuto)

1. No repositório `iptv-player`, toque em **Settings** (separador no topo).
2. No menu lateral, toque em **Pages**.
3. Em **Build and deployment → Source** escolha **Deploy from a branch**.
4. Em **Branch** escolha `main` e a pasta `/ (root)`. Toque em **Save**.
5. Aguarde 1–2 minutos e recarregue a página: aparece "Your site is live at https://…github.io/iptv-player/".

**Como confirmar:** abrir esse endereço no Safari do iPhone → deve aparecer o ecrã "Bem-vindo ao seu leitor IPTV".

## Passo 4 — Teste de ligação com a sua lista (utilizador)

1. No iPhone, abra o endereço no Safari.
2. Definições → Listas IPTV → **Adicionar lista**.
3. Escolha URL ou Xtream, preencha e toque em **Testar ligação** (não precisa de guardar).
4. Comunique o resultado (a mensagem que aparece). Não partilhe o endereço nem as credenciais.

| Resultado | Significado |
|---|---|
| "Lista acessível" / "Conta ativa" | Funciona diretamente a partir do iPhone. |
| "O servidor usa HTTP…" | O fornecedor não tem HTTPS: o iPhone bloqueia o pedido. Alternativas: endereço HTTPS do fornecedor, importação por ficheiro, ou proxy pessoal (decisão futura). |
| "Não foi possível ligar…" | Provavelmente o servidor não permite acesso a partir de browsers (CORS). A importação por **ficheiro** funciona sempre. |

## Atualizações futuras

Cada nova versão é enviada para o repositório e o GitHub Pages publica-a automaticamente em 1–2 minutos. O mecanismo de atualização da app (Fase 8) garante que o iPhone não fica preso a uma versão antiga.
