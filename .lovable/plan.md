
# Importacao Dinamica de Produtos e Precos

## Problema Atual
A importacao atual exige que a planilha tenha colunas com nomes exatos ("N do item", "PRECO TABELA V2", etc.), o que e fragil e confuso para o usuario.

## Solucao

### 1. Duas novas abas no Admin
- **Importar Produtos**: importa codigo + descricao (cadastro base)
- **Importar Precos**: importa codigo + preco_tabela + preco_minimo (atualiza precos de produtos ja cadastrados)

A aba "Produtos" existente continua apenas para visualizacao/busca (sem o bloco de importacao).

### 2. Sistema de Mapeamento Dinamico de Colunas

Fluxo em cada aba de importacao:

1. Usuario faz upload do arquivo Excel/CSV
2. O sistema le os headers da planilha e mostra uma **preview das primeiras 5 linhas**
3. Para cada campo do banco (ex: "Codigo", "Descricao"), o usuario seleciona qual coluna da planilha corresponde usando um **dropdown com os headers detectados**
4. O sistema aplica o mapeamento e importa

```text
+------------------------------------------+
|  Campo do Sistema    |  Coluna da Planilha |
|----------------------|---------------------|
|  Codigo (obrigatorio)|  [v] "N do item"    |
|  Descricao (obrig.)  |  [v] "Desc do item" |
+------------------------------------------+
|  Preview dos dados mapeados (5 linhas)    |
+------------------------------------------+
|  [ Importar X produtos ]                  |
+------------------------------------------+
```

### 3. Componente Reutilizavel: `ImportMapper`

Novo componente `src/components/ImportMapper.tsx` que recebe:
- `fields`: lista de campos alvo (nome, label, obrigatorio)
- `onImport(mappedRows)`: callback com os dados ja mapeados

Estados internos:
- `headers`: headers detectados da planilha
- `mapping`: objeto `{ campo_sistema: coluna_planilha }`
- `previewRows`: primeiras 5 linhas para visualizacao
- `rawRows`: todas as linhas para envio

### 4. Novas paginas/componentes

- **`src/components/ImportProdutos.tsx`**: usa `ImportMapper` com campos `codigo` (obrig.) e `descricao` (obrig.). Chama a edge function `import-produtos` apenas com esses campos.
- **`src/components/ImportPrecos.tsx`**: usa `ImportMapper` com campos `codigo` (obrig.), `preco_tabela` e `preco_minimo`. Chama uma nova edge function `import-precos` que faz UPDATE nos produtos existentes pelo codigo.

### 5. Nova Edge Function: `import-precos`

`supabase/functions/import-precos/index.ts`

Recebe um array de `{ codigo, preco_tabela, preco_minimo }` e faz upsert na tabela `produtos` atualizando apenas os campos de preco (sem sobrescrever descricao).

### 6. Alteracoes no Admin.tsx

- Adicionar duas novas `TabsTrigger`: "Importar Produtos" e "Importar Precos"
- Remover o bloco de importacao da aba "Produtos" (manter apenas busca/listagem e o botao de upload de imagens)
- Cada nova aba renderiza o respectivo componente de importacao

## Detalhes Tecnicos

- Leitura do Excel continua com a lib `xlsx` ja instalada
- O `ImportMapper` usa `XLSX.utils.sheet_to_json` com `{ header: 1 }` para extrair headers da primeira linha
- Os dropdowns de mapeamento usam o componente `Select` do shadcn/ui
- A preview usa o componente `Table` existente
- A edge function `import-precos` usa `upsert` com `onConflict: 'codigo'` e envia apenas os campos de preco, preservando `descricao`
- Adicionar `[functions.import-precos]` com `verify_jwt = false` no `config.toml`
