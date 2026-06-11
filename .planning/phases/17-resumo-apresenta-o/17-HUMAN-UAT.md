---
status: partial
phase: 17-resumo-apresenta-o
source: [17-VERIFICATION.md]
started: 2026-06-11
updated: 2026-06-11
---

## Current Test

[awaiting human testing]

## Tests

### 1. LOCAL breakdown chips no Resumo de Fitas (Step 3)
expected: No Step 3, no "RESUMO DE FITAS", cada fita mostra chips "Ambiente — Local · Xm" (ex.: "Sala — Sanca · 12m") quando a mesma fita aparece em locais diferentes. Orçamento antigo sem local não quebra.
result: [pending]

### 2. Rótulo "incluída no Resumo de Fitas" inline
expected: A fita inline por sistema mostra "incluída no Resumo de Fitas" (não mais "Global →"), sem subtotal duplicado na célula.
result: [pending]

### 3. Bloco de drivers global rebaixado a Collapsible interno
expected: "Análise de Otimização de Drivers" inicia recolhido (defaultOpen=false), com badge "interno" e nota "não aparece no PDF do cliente"; expande/recolhe ao clicar. Drivers por ambiente seguem como fonte visível.
result: [pending]

### 4. PDF v2 — foto da fita + chips de LOCAL
expected: Gerar PDF (v2) de um orçamento com a mesma fita (com imagem cadastrada) em 2 locais → no "RESUMO DE FITAS" aparece a foto à esquerda + chips "Ambiente — Local · Xm". `rowFita` inline intocado. Orçamento antigo/sem imagem → placeholder sem quebrar layout. Restante do PDF idêntico ao anterior.
result: [pending]

### 5. Advisory não-bloqueante no gate Step 2 → Step 3
expected: Sistema com fita sem driver (metragem válida) → "Próximo" mostra dialog "Alguns itens parecem incompletos" listando o item. "Revisar" fica no Step 2; "Continuar mesmo assim" avança. Orçamento completo não mostra dialog. Regressão Phase 16: fita sem metragem ainda BLOQUEIA com toast.error.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
