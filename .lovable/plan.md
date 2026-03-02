
# Adicionar etapa "Analise" no fluxo de importacao de Produtos e Precos

## O que sera feito

### 1. Renomear "Pre-analise" para "Analise" em ImportImagens.tsx
- Linha 228: mudar o titulo de "Pre-analise" para "Analise"

### 2. Adicionar secao "Analise" no ImportMapper.tsx (usado por Produtos e Precos)

Apos o mapeamento de colunas e antes do botao de importar, adicionar um card "Analise" no mesmo estilo do ImportImagens, mostrando:

- Total de linhas encontradas na planilha
- Quantas linhas estao validas (todos os campos obrigatorios preenchidos) - com indicador verde
- Quantas linhas serao ignoradas por campos obrigatorios vazios - com indicador vermelho/amarelo e lista expansivel das linhas com problema
- Amostra das primeiras 5 linhas mapeadas (a tabela de preview atual sera movida para dentro deste card)

O card tera a mesma estrutura visual do ImportImagens:
- Titulo "Analise" com subtitulo "X linhas analisadas"
- Bloco verde: "X prontos para importacao"
- Bloco vermelho (se houver): "X linhas com campos obrigatorios vazios" (expansivel para ver detalhes)
- Tabela de amostra com as primeiras linhas validas
- Botao de importar dentro do card

### Detalhes tecnicos

**Arquivos modificados:**

1. `src/components/ImportImagens.tsx` - Renomear "Pre-analise" para "Analise" (1 linha)

2. `src/components/ImportMapper.tsx` - Substituir a secao "Preview" atual por um card "Analise" completo:
   - Calcular `totalInvalid` (linhas com campos obrigatorios vazios)
   - Coletar as linhas invalidas com motivo (qual campo esta vazio)
   - Exibir card com contadores verde/vermelho
   - Secao expansivel (Collapsible) para linhas invalidas
   - Manter a tabela de preview das primeiras linhas validas dentro do card
   - Botao de importar dentro do card
   - Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` do radix-ui
