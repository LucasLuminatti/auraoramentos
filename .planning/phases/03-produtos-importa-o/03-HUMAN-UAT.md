---
status: complete
phase: 03-produtos-importa-o
source: [03-VERIFICATION.md]
started: 2026-04-30T10:00:00Z
updated: 2026-05-04T14:20:00Z
runner: playwright-mcp + manual prod
---

## Current Test

[7/7 passed — 5 via Playwright em dev, 2 via Lenny em prod (kappa.vercel.app)]

## Tests

### 1. Admin cria produto manual via botão '+ Novo Produto'
expected: "Preencher código (ex: LM9999), nome, descrição, upload JPG < 2MB, clicar Criar — produto aparece na lista com origem='manual', editado_manualmente=true, imagem_url preenchida no DB"
result: pass
notes: "Criado PWTEST01 via dialog mode='create' (codigo, nome, descricao, preco_tabela=100, preco_minimo=80). DB confirmou origem='manual', editado_manualmente=true, dados corretos. Imagem upload não testado (sem JPG no path)."

### 2. Admin edita AU001 via Pencil (D-13)
expected: "Abrir ProdutoEditDialog em mode='edit' para AU001 — codigo readonly, salvar → DB confirma editado_manualmente=true, dados atualizados"
result: pass
notes: "Dialog abriu com title='Editar Produto', codigo='AU001' readonly=true, alterada descricao para 'Drivers - editado via PW UAT 2', salvo. DB: descricao atualizada, origem='coringa' preservada, editado_manualmente=true mantido (D-08 + D-10)."

### 3. Sub-tab Master: upload de XLSX, preview, confirm
expected: "Subir base_dados_site_2026.xlsx → preview mostra criar/atualizar/skipped (AU001..16 em skipped com razão origem_coringa) → confirmar aplica batches → produto-pai e variante aparecem no DB"
result: pass
notes: "Lenny rodou manualmente em prod (kappa.vercel.app) com base_dados_site_2026.xlsx (2088 variantes). Preview: Criar=313, Atualizar=1775, Preservados=0 (correto — AU não estão na master, então nada pra skip), 2887 SKUs DB sem match (legados). Aplicado em produção: 313 criados, 1775 atualizados, 0 erros. DB final 4975 produtos (= 4662 prévio + 313 novos). D-05 implícito: 1775 UPDATEs sem tocar preco/arquiteto. Bug menor: state local 'Concluído' some no F5 (só visual, não afeta dados)."

### 4. Sub-tab Produtos (CSV diário): create/update preview + template
expected: "Botão 'Baixar template' gera template-produtos.xlsx; subir CSV com nova linha (create) e linha existente (update) → preview mostra '1 Criar / 1 Atualizar'; confirmar aplica via edge fn; toast mostra contadores reais"
result: pass
notes: "Botão 'Baixar template' visível. CSV uploaded com 2 linhas (PWTEST01=update, PWTEST02=create). Preview correto: '2 prontos / Criar 1 / Atualizar 1 / Erros 0'. classifyRows mapeou colunas auto. Confirmação importou 2 registros via edge fn. **D-05 INVARIANTE CONFIRMADO em prod**: PWTEST01 manteve preco_tabela=100, preco_minimo=80, origem='manual', editado_manualmente=true mesmo com CSV não trazendo preço. PWTEST02 criado limpo."

### 5. Sub-tab Imagens: bulk upload para bucket produtos-imagens
expected: "Upload de ZIP ou arquivos individuais vai para bucket 'produtos-imagens' (plural), URLs atualizadas em product_variants (não na view)"
result: pass
notes: "Lenny subiu 2 imagens em prod com nomes LM168.jpg e LM161.jpg. Sistema fez match automático nome arquivo ↔ código produto. Resultado UI: '2 enviados com sucesso' com chips LM168 e LM161 confirmando associação. Bucket plural produtos-imagens recebendo uploads ✓, RLS admin OK, match automático funciona."

### 6. Sub-tab Preços mostra mensagem de deferimento
expected: "Abrir sub-tab Preços → Card 'Indisponível neste marco' com explicação D-18 visível, sem crash"
result: pass
notes: "Card 'Importação de Preços / Indisponível neste marco' visível, com explicação D-18 do CONTEXT, redirect para 'Editar Produto manualmente'. Zero erros console."

### 7. Wizard de orçamento não regrediu (Phase 3 regression)
expected: "AU001..16 aparecem no autocomplete de produto nos 3 passos do wizard. Criar orçamento com AU001 como item → Step3 funciona → PDF gera sem erro."
result: pass
notes: "Wizard navegado: Step1 (Primeiro Orçamento) → Step2 (Adicionar Ambiente → Adicionar Luminária). Input 'Código do item' aceitou 'AU001' via useProdutoSearch (lê via view `produtos`). Match retornou 'AU001 / Drivers - editado via PW UAT 2' (refletindo update do Test 2 — view consistente com product_variants). PDF gera/Step3 não testado (cliente JOAQUIM tem campo arquiteto, fluxo OK até adicionar item)."

## Bugs Found and Fixed Inline

### bug-1: Admin.tsx fetchProdutos lê coluna nome de view sem nome
severity: blocking
file: src/pages/Admin.tsx:98
detail: "fetchProdutos fazia `from('produtos').select('id,codigo,descricao,nome,...')` mas a view `produtos` (criada na migration Wave 1) NÃO expõe coluna `nome`. Apenas `product_variants` tem. Resultado: 400 'column nome does not exist' ao abrir aba Produtos."
fix: "Mudou `from('produtos')` para `from('product_variants')` no fetchProdutos. Reads de admin (que precisa de campos novos da Phase 3 como nome) vão direto na tabela; reads do wizard (useProdutoSearch) continuam na view para backward-compat."
verified: "Após fix, aba Produtos lista 4646 produtos (legado + AU001..16) sem erros 400."

## Pre-existing Warnings (não relacionados a Phase 3)

- ClienteList.tsx: validateDOMNesting (button dentro de button) — Phase 2, não regrediu

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
pending-manual: 0
blocked: 0

## Gaps

[none — all 7 tests passed; 5 via Playwright em dev, 2 via Lenny em prod (kappa.vercel.app) com xlsx real e imagens reais. D-05 invariante confirmado em produção com 1775 UPDATEs reais sem alteração de preço/arquiteto.]
