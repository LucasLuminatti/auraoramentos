---
status: partial
phase: 17-resumo-apresenta-o
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md, 17-04-SUMMARY.md]
started: 2026-06-11
updated: 2026-06-11
---

## Current Test

[testing complete — partial: automated smoke passed, 5 visual items pending human review]

## Tests

### 0. Smoke automatizado (Playwright MCP)
expected: App carrega autenticado, navega cliente → projeto → lista de orçamentos sem erros de console; componentes alterados (Step2Ambientes, Step3Revisao, v2.ts, orcamento.ts) no bundle ativo.
result: pass
note: Sessão Supabase do Lenny reinjetada no localStorage do dev server (localhost:8080). Navegação Clientes → Ablim → Cozinha Ablim → lista de 7 orçamentos com 0 erros de console em todas as telas. Build OK, 96/96 testes, code review clean, gsd-verifier 4/4 must-haves. Reabertura de orçamento existente no wizard não foi forçada para evitar mutação de dados de PRODUÇÃO.

### 1. LOCAL breakdown chips no Resumo de Fitas (Step 3)
expected: Chips "Ambiente — Local · Xm" (ex.: "Sala — Sanca · 12m") quando a mesma fita aparece em locais diferentes. Orçamento antigo sem local não quebra.
result: [pending]
note: Requer orçamento com a mesma fita em 2+ locais. Não verificado visualmente para não montar/mutar dados em prod.

### 2. Rótulo "incluída no Resumo de Fitas" inline
expected: Fita inline por sistema mostra "incluída no Resumo de Fitas" (não "Global →"), sem subtotal duplicado.
result: [pending]

### 3. Bloco de drivers global rebaixado a Collapsible interno
expected: "Análise de Otimização de Drivers" inicia recolhido (defaultOpen=false), badge "interno" + nota "não aparece no PDF"; expande/recolhe. Drivers por ambiente seguem visíveis.
result: [pending]

### 4. PDF v2 — foto da fita + chips de LOCAL
expected: PDF (v2) de orçamento com a mesma fita (com imagem) em 2 locais → foto à esquerda + chips "Ambiente — Local · Xm" no RESUMO DE FITAS; rowFita inline intocado; orçamento antigo/sem imagem → placeholder sem quebrar; resto do PDF idêntico.
result: [pending]
note: PDF é gerado client-side (download). Verificação de conteúdo visual precisa do olho humano; code review confirmou pipeline esc()/thumb() sem XSS e backward-compat.

### 5. Advisory não-bloqueante no gate Step 2 → Step 3
expected: Fita sem driver (metragem válida) → "Próximo" mostra dialog "Alguns itens parecem incompletos". "Revisar" fica no Step 2; "Continuar mesmo assim" avança. Orçamento completo não mostra dialog. Regressão Phase 16: fita sem metragem ainda BLOQUEIA com toast.error.
result: [pending]
note: Lógica coberta por testes unitários (Step2Gate.test.ts, 12/12). Confirmação visual do dialog requer montar sistema incompleto em prod — não forçado.

## Summary

total: 6
passed: 1
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

[none — no functional issues found; pending items are human-visual confirmations against production data]
