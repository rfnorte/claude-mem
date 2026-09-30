# Pawtencial App v2

Protótipo interativo (dono e treinador · Lisboa), importado do projeto Claude Design
`Pawtencial App v2.dc.html` com o design system Pawtencial.

## Executar

Servir **esta pasta como raiz** (o bundle do design system resolve `../../assets/` a partir da raiz):

```bash
cd pawtencial
python3 -m http.server 8000
# abrir http://localhost:8000/index.html
```

O runtime (`support.js`) carrega React 18.3.1, ReactDOM e Babel Standalone a partir do unpkg
(com SRI), por isso é necessário acesso à internet.

## Estrutura

| Ficheiro | Função |
|---|---|
| `Pawtencial App v2.dc.html` | Ecrãs, estado e lógica do protótipo |
| `support.js` | Runtime que interpreta o formato `x-dc` (gerado, não editar) |
| `ios-frame.jsx` | Moldura de iPhone (`IOSDevice`) |
| `_ds/…/_ds_bundle.js` | Componentes do design system (Button, Input, Avatar, Badge, …) |
| `_ds/…/tokens/*.css` | Tokens de cor, tipografia, espaçamento, raio e sombra |
| `assets/paw-mark-simple.svg` | Marca |
