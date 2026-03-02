

# Relatorio de Erros na Importacao e Download de Falhas

## Problema

As edge functions atuais falham silenciosamente ou abortam no primeiro erro de lote, sem informar quais linhas especificas falharam, o motivo, ou como corrigir. O usuario precisa de visibilidade total sobre o resultado da importacao.

## Solucao

### 1. Edge Functions - Retornar resultados por linha

**`import-produtos`**: Em vez de abortar no primeiro erro de lote, processar cada produto individualmente dentro do lote e coletar erros por linha. Retornar:
```json
{
  "success": true,
  "inserted": 480,
  "failed": [
    { "codigo": "ABC123", "descricao": "Prod X", "erro": "Codigo duplicado ou campo vazio" },
    { "codigo": "", "descricao": "Sem codigo", "erro": "Campo codigo obrigatorio" }
  ]
}
```

**`import-precos`**: Mesmo padrao. Cada update individual ja e feito separado, entao capturar o erro de cada um e retornar quais codigos nao foram atualizados e por que (ex: "codigo nao encontrado na base").

Para o `import-precos`, alem de verificar se o update deu erro no Supabase, tambem verificar se o update afetou 0 linhas (codigo nao existe). Isso sera feito usando `.select()` apos o update para checar se retornou dados, ou fazendo um select previo dos codigos existentes.

### 2. Frontend - Coletar e exibir erros

**`ImportMapper.tsx`**: Mudar a interface `onImport` para retornar um objeto de resultado:
```typescript
interface ImportResult {
  totalProcessed: number;
  totalSuccess: number;
  failed: Array<Record<string, any> & { _erro: string }>;
}
```

Apos a importacao, se houver falhas:
- Mostrar um card de resumo: "X registros importados com sucesso, Y falharam"
- Listar os motivos dos erros agrupados (ex: "15 registros com codigo nao encontrado", "3 com campo vazio")
- Mostrar instrucoes claras do que o usuario precisa fazer para corrigir
- Botao "Baixar planilha com erros" que gera um Excel com as linhas que falharam + coluna extra "Motivo do Erro"

**`ImportProdutos.tsx`**: Acumular os `failed` de cada lote e retornar o resultado consolidado.

**`ImportPrecos.tsx`**: Mesma logica - acumular falhas de cada lote.

### 3. Download da planilha de erros

Usar a lib `xlsx` (ja instalada) para gerar um arquivo Excel no navegador com:
- Todas as colunas originais do registro que falhou
- Uma coluna adicional "Motivo do Erro"
- Uma coluna "Sugestao" com orientacao de correcao

O download sera disparado por um botao que aparece apenas quando ha erros.

### 4. Logica de atualizacao de precos

A logica de atualizacao de precos ja existe no `ImportPrecos.tsx` (aba "Precos" dentro de "Importacao"). O problema atual e que a edge function `import-precos` faz update por codigo mas nao informa quais codigos nao existem na base. A correcao e:
- Na edge function, antes de atualizar, buscar todos os codigos existentes na base
- Marcar como falha os registros cujo codigo nao foi encontrado com mensagem "Codigo nao cadastrado - importe o produto primeiro"
- Retornar a lista de falhas para o frontend

## Detalhes Tecnicos

### Arquivos modificados

1. **`supabase/functions/import-produtos/index.ts`**
   - Processar cada item individualmente com try/catch
   - Validar campos antes do insert (codigo vazio, descricao vazia)
   - Coletar erros por item
   - Retornar `{ inserted, failed: [{...dados, erro: "motivo"}] }`

2. **`supabase/functions/import-precos/index.ts`**
   - Buscar lista de codigos existentes antes de processar (`SELECT codigo FROM produtos WHERE codigo IN (...)`)
   - Marcar como falha itens com codigo nao encontrado
   - Coletar erros de update do Supabase
   - Retornar `{ updated, failed: [{...dados, erro: "motivo"}] }`

3. **`src/components/ImportMapper.tsx`**
   - Nova interface `ImportResult` com `totalSuccess`, `totalProcessed`, `failed`
   - Mudar assinatura de `onImport` para retornar `Promise<ImportResult>`
   - Novo estado `importResult` para armazenar o resultado
   - Apos importacao, exibir card de resumo com contagem de sucesso/falha
   - Botao "Baixar planilha com erros" usando `XLSX.writeFile`
   - Instrucoes de correcao exibidas em um alert/card

4. **`src/components/ImportProdutos.tsx`**
   - Acumular `failed` de cada batch
   - Retornar `ImportResult` consolidado

5. **`src/components/ImportPrecos.tsx`**
   - Acumular `failed` de cada batch
   - Retornar `ImportResult` consolidado

### Fluxo do usuario apos importacao com erros

```text
+--------------------------------------------+
|  Resultado da Importacao                   |
|                                            |
|  [check] 480 registros importados          |
|  [x] 20 registros com erro                 |
|                                            |
|  Motivos:                                  |
|  - 15x "Codigo nao encontrado na base"    |
|  - 5x "Campo descricao vazio"             |
|                                            |
|  O que fazer:                              |
|  - Codigos nao encontrados: importe os    |
|    produtos primeiro na aba "Produtos"     |
|  - Campos vazios: preencha os dados       |
|    obrigatorios na planilha                |
|                                            |
|  [ Baixar planilha com erros ]             |
+--------------------------------------------+
```

