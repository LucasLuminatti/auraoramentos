
# Barra de Progresso nas Importacoes

## Abordagem

Atualmente, a importacao envia todos os dados de uma vez para a edge function e aguarda a resposta. Para mostrar progresso real, vamos dividir o envio em lotes no frontend e atualizar a barra a cada lote concluido.

## Alteracoes

### 1. ImportMapper.tsx
- Adicionar estados `progress` (0-100) e `progressLabel` ("150 de 3000 registros")
- Mudar a interface `onImport` para aceitar um callback de progresso: `onImport(rows, onProgress)` onde `onProgress(processed, total)` e chamado a cada lote
- Importar e exibir o componente `Progress` do shadcn/ui durante a importacao
- Mostrar o texto de progresso abaixo da barra (ex: "150 de 3000 registros processados")

### 2. ImportProdutos.tsx
- Dividir o array de produtos em lotes de 500
- Para cada lote, chamar `supabase.functions.invoke("import-produtos")` separadamente
- Apos cada lote, chamar `onProgress(processados, total)` para atualizar a barra

### 3. ImportPrecos.tsx
- Mesma logica de lotes de 500
- Chamar `supabase.functions.invoke("import-precos")` por lote
- Atualizar progresso a cada lote concluido

## Detalhes Tecnicos

A assinatura do `onImport` muda de:
```
onImport: (rows: Record<string, any>[]) => Promise<void>
```
para:
```
onImport: (rows: Record<string, any>[], onProgress: (processed: number, total: number) => void) => Promise<void>
```

A barra de progresso aparece apenas durante a importacao, substituindo o botao, mostrando:
- Barra visual com percentual
- Texto "X de Y registros processados"

As edge functions permanecem inalteradas -- o controle de lotes e feito no frontend.
