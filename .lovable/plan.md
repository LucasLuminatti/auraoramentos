

# Correcao da Importacao de Precos e Reorganizacao do Admin

## 1. Correcao da Importacao de Precos

### Edge Function `import-precos`
- Paralelizar os updates usando `Promise.all` em vez de loop sequencial (causa timeout com muitos registros)

### Frontend `ImportPrecos.tsx`
- Filtrar registros onde tanto `preco_tabela` quanto `preco_minimo` sao zero/vazios (evita sobrescrever precos validos com 0)
- Melhorar `parsePreco` para retornar `undefined` em vez de `0` quando o valor e vazio/traco, e enviar apenas campos com valor real

## 2. Reorganizacao das Abas do Admin

Substituir as abas separadas "Importar Produtos" e "Importar Precos" por uma unica aba **"Importacao"** com sub-navegacao interna via cards:

```text
Abas: Dashboard | Excecoes | Importacao | Produtos | Colaboradores | Orcamentos | Clientes

Dentro de "Importacao":
+------------------+  +------------------+  +------------------+
|   Produtos       |  |   Precos         |  |   Imagens        |
|   (codigo+desc)  |  |   (atualizar)    |  |   (fotos)        |
+------------------+  +------------------+  +------------------+

(componente selecionado aparece abaixo dos cards)
```

## 3. Importacao de Imagens Inline

Extrair a logica de `AdminUploadImagens.tsx` para um componente `ImportImagens.tsx` (sem header/navegacao propria) que pode ser renderizado dentro da aba "Importacao". O componente mantem toda a logica existente:
- Nome do arquivo = codigo do produto (ex: `LM2439.jpg`)
- Pre-analise: valida formato, tamanho, e verifica se o codigo existe na base
- Upload em lotes com barra de progresso
- Atualiza `imagem_url` na tabela `produtos`

A rota `/admin/upload-imagens` continua funcionando como fallback.

## Detalhes Tecnicos

### Arquivos modificados

1. **`supabase/functions/import-precos/index.ts`** -- substituir loop sequencial por `Promise.all` para paralelizar updates dentro de cada lote

2. **`src/components/ImportPrecos.tsx`** -- `parsePreco` retorna `undefined` para valores vazios; filtrar campos undefined antes de enviar

3. **`src/components/ImportImagens.tsx`** -- novo componente extraido de `AdminUploadImagens.tsx`, apenas o conteudo (sem header/layout de pagina)

4. **`src/pages/AdminUploadImagens.tsx`** -- refatorar para usar `ImportImagens` internamente

5. **`src/pages/Admin.tsx`**:
   - Remover `TabsTrigger` "Importar Produtos" e "Importar Precos"
   - Adicionar `TabsTrigger` "Importacao"
   - Estado local `importSubTab` controla qual sub-secao esta ativa (produtos/precos/imagens)
   - Renderizar 3 cards clicaveis + componente selecionado abaixo
   - Remover card "Upload de Imagens" da aba Produtos

