---
status: partial
phase: 03-produtos-importa-o
source: [03-VERIFICATION.md]
started: 2026-04-30T10:00:00Z
updated: 2026-04-30T10:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Admin cria produto manual via botão '+ Novo Produto'
expected: "Preencher código (ex: LM9999), nome, descrição, upload JPG < 2MB, clicar Criar — produto aparece na lista com origem='manual', editado_manualmente=true, imagem_url preenchida no DB"
result: [pending]

### 2. Admin edita AU001 via Pencil (D-13)
expected: "Abrir ProdutoEditDialog em mode='edit' para AU001 — codigo readonly, salvar → DB confirma editado_manualmente=true, dados atualizados"
result: [pending]

### 3. Sub-tab Master: upload de XLSX, preview, confirm
expected: "Subir base_dados_site_2026.xlsx → preview mostra criar/atualizar/skipped (AU001..16 em skipped com razão origem_coringa) → confirmar aplica batches → produto-pai e variante aparecem no DB"
result: [pending]

### 4. Sub-tab Produtos (CSV diário): create/update preview + template
expected: "Botão 'Baixar template' gera template-produtos.xlsx; subir CSV com nova linha (create) e linha existente (update) → preview mostra '1 Criar / 1 Atualizar'; confirmar aplica via edge fn; toast mostra contadores reais"
result: [pending]

### 5. Sub-tab Imagens: bulk upload para bucket produtos-imagens
expected: "Upload de ZIP ou arquivos individuais vai para bucket 'produtos-imagens' (plural), URLs atualizadas em product_variants (não na view)"
result: [pending]

### 6. Sub-tab Preços mostra mensagem de deferimento
expected: "Abrir sub-tab Preços → Card 'Indisponível neste marco' com explicação D-18 visível, sem crash"
result: [pending]

### 7. Wizard de orçamento não regrediu (Phase 3 regression)
expected: "AU001..16 aparecem no autocomplete de produto nos 3 passos do wizard. Criar orçamento com AU001 como item → Step3 funciona → PDF gera sem erro."
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
