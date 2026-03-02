

# Ajustes no PDF - Logo, Termos e Icone

## 1. Aumentar o logo no header do PDF
- Linha 145: Alterar `height:68px` para `height:100px` no logo do header

## 2. Reduzir espacamento na secao "Informacoes Importantes"
- Linha 254: Reduzir padding da `.terms-section` de `28px 32px` para `20px 24px`
- Linha 255: Reduzir margin-bottom do `.terms-header` de `18px` para `10px`
- Linha 259: Reduzir padding dos `li` de `6px 0 6px 18px` para `3px 0 3px 18px`
- Linha 263: Reduzir margin-top do `.thanks` de `10px` para `6px`

## 3. Trocar emoji da balanca por check
- Na secao de termos no HTML (por volta da linha 345), trocar o emoji `⚖` por `✓`

**Arquivo afetado:** `src/lib/gerarPdfHtml.ts`
