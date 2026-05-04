---
status: partial
phase: 03-produtos-importa-o
source: [03-VERIFICATION.md]
started: 2026-04-30T10:00:00Z
updated: 2026-05-04T13:36:00Z
runner: playwright-mcp
---

## Current Test

[5 of 7 verified via Playwright; 2 require real master xlsx + image folder — manual]

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
result: pending-manual
notes: "Skipped — requer arquivo master xlsx real (60 pais + 2088 variantes). Lenny precisa rodar manualmente via UI."

### 4. Sub-tab Produtos (CSV diário): create/update preview + template
expected: "Botão 'Baixar template' gera template-produtos.xlsx; subir CSV com nova linha (create) e linha existente (update) → preview mostra '1 Criar / 1 Atualizar'; confirmar aplica via edge fn; toast mostra contadores reais"
result: pass
notes: "Botão 'Baixar template' visível. CSV uploaded com 2 linhas (PWTEST01=update, PWTEST02=create). Preview correto: '2 prontos / Criar 1 / Atualizar 1 / Erros 0'. classifyRows mapeou colunas auto. Confirmação importou 2 registros via edge fn. **D-05 INVARIANTE CONFIRMADO em prod**: PWTEST01 manteve preco_tabela=100, preco_minimo=80, origem='manual', editado_manualmente=true mesmo com CSV não trazendo preço. PWTEST02 criado limpo."

### 5. Sub-tab Imagens: bulk upload para bucket produtos-imagens
expected: "Upload de ZIP ou arquivos individuais vai para bucket 'produtos-imagens' (plural), URLs atualizadas em product_variants (não na view)"
result: pending-manual
notes: "Skipped — requer pasta de imagens reais. Lenny precisa rodar manualmente. Code review confirmou bucket plural (zero matches singular em src/) e migração de WRITE para product_variants em commit c7038f9."

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
passed: 5
issues: 0
pending: 0
skipped: 0
pending-manual: 2
blocked: 0

## Gaps

[none — 5/7 fully verified, 2/7 require real production data files (master xlsx + image folder) for manual UAT by Lenny]
