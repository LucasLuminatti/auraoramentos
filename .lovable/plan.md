
# Correcao do Relatorio de Erros na Importacao de Precos

## Problema Identificado

O card de resultado (com contagem de erros e botao de download) nao aparece porque o `ImportMapper.handleImport` tem um bloco `try/finally` **sem `catch`**. Quando a edge function retorna um erro HTTP ou o `data` vem nulo, o acesso a `data.updated` lanca uma excecao nao tratada, o `setImportResult` nunca e chamado, e a UI volta silenciosamente ao estado inicial.

## Correcoes

### 1. ImportMapper.tsx - Adicionar catch com fallback

Adicionar um bloco `catch` no `handleImport` que cria um `ImportResult` de fallback com a mensagem de erro, garantindo que o card de resultado SEMPRE apareca:

```typescript
try {
  // ... existing code ...
  const result = await onImport(mappedData, onProgress);
  setImportResult(result);
} catch (err: any) {
  setImportResult({
    totalProcessed: 0,
    totalSuccess: 0,
    failed: [{ _erro: err?.message || "Erro desconhecido durante a importacao" }],
  });
} finally {
  setImporting(false);
}
```

### 2. ImportMapper.tsx - Melhorar visibilidade do botao de download

Substituir o botao simples de download por um bloco mais destacado com texto explicativo ao lado:

```text
+--------------------------------------------------------------+
| [!] Alguns registros nao foram importados                    |
|                                                              |
| Baixe a planilha abaixo para ver quais linhas falharam      |
| e o motivo de cada erro. Corrija os dados na planilha       |
| e importe novamente.                                         |
|                                                              |
| [ Download icon ] Baixar planilha com erros (20 linhas)      |
| Contém as linhas que nao foram importadas com o motivo       |
| do erro e sugestao de correcao para cada registro.           |
+--------------------------------------------------------------+
```

O botao tera:
- Um card com fundo destacado (bg-destructive/10 ou similar) envolvendo o botao
- Texto descritivo ABAIXO do botao explicando que a planilha contem as linhas que nao subiram para a base de dados, com motivo do erro e sugestao de correcao
- Icone mais visivel

### 3. ImportPrecos.tsx - Proteger acesso a data nula

Adicionar verificacao defensiva para o caso de `data` ser nulo mesmo sem `error`:

```typescript
if (error) {
  // ... push all to failed ...
} else if (!data) {
  for (const item of batch) {
    allFailed.push({ ...item, _erro: "Resposta vazia do servidor" });
  }
} else {
  totalUpdated += data.updated ?? 0;
  // ... rest ...
}
```

## Detalhes Tecnicos

### Arquivos modificados

1. **`src/components/ImportMapper.tsx`**:
   - Adicionar `catch` no `handleImport` para capturar excecoes e exibir resultado de erro
   - Redesenhar a secao de download: envolver em card destacado com borda colorida (destructive), adicionar texto descritivo abaixo do botao explicando que e uma planilha com as linhas que nao foram importadas para a base de dados, com motivo do erro e sugestao de correcao

2. **`src/components/ImportPrecos.tsx`**:
   - Adicionar verificacao `else if (!data)` para tratar resposta nula do servidor sem lancar excecao

3. **`src/components/ImportProdutos.tsx`**:
   - Mesma verificacao defensiva de `data` nulo para consistencia
