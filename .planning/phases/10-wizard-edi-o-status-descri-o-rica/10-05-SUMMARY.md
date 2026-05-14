---
phase: 10-wizard-edi-o-status-descri-o-rica
plan: "05"
subsystem: pdf-description
tags: [wiz-05, descrição-rica, tanstack-query, pdf-v2, builder-puro]
dependency_graph:
  requires: [10-03, 10-04]
  provides: [descrição-rica-step3, descrição-rica-pdf-v2, atributos-batch-lookup]
  affects: [Step3Revisao, gerarPdfHtml, pdfTemplates/v2, OrcamentoDetalhe]
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery batch lookup com staleTime 5min
    - Pure function builder com suppress-on-missing
    - Async PDF router (gerarOrcamentoHtml tornou-se async)
key_files:
  created:
    - src/lib/produtoDescricao.ts
    - src/lib/__tests__/produtoDescricao.test.ts
    - .planning/phases/10-wizard-edi-o-status-descri-o-rica/10-05-SMOKE.md
  modified:
    - src/components/Step3Revisao.tsx
    - src/lib/pdfTemplates/v2.ts
    - src/lib/gerarPdfHtml.ts
    - src/pages/OrcamentoDetalhe.tsx
decisions:
  - "D-19: formato Nome | TK | WW | IRC X | nicho com separador pipe implementado"
  - "D-20: atributo ausente suprimido — null/undefined/string-vazia não aparecem"
  - "D-21: AmbienteCard (Step 2) e PDF v1 intocados — descrição crua preservada"
  - "D-22: snapshot antigo re-resolve por código; fallback ao nome cru se produto sumiu"
  - "D-23: batch lookup WHERE codigo IN (...) único, staleTime 5min, queryKey estável via useMemo+sort"
  - "D-24: atributos consumidos: temperatura_k, potencia_watts, irc, nicho"
  - "D-30: smoke checklist criado cobrindo 5 fluxos para execução manual em prod"
  - "gerarOrcamentoHtml tornou-se async (deviation: necessário para propagar atributosMap ao v2 builder)"
metrics:
  duration: ~35min
  completed_date: "2026-05-14"
  tasks_completed: 4
  tasks_total: 5
  files_created: 3
  files_modified: 4
---

# Phase 10 Plan 05: Descrição Rica (WIZ-05) Summary

**One-liner:** Builder puro `construirDescricaoRica` com formato `Nome | TK | WW | IRC X | nicho`, integrado em Step 3 via TanStack Query batch lookup e em PDF v2 via `buildAtributosMap` async — suprime atributos ausentes, fallback ao snapshot puro para produtos removidos do master.

## Tasks Completed (4/5)

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Builder puro + 8 testes Vitest | 3b1f6ca | produtoDescricao.ts, produtoDescricao.test.ts |
| 2 | Step3Revisao batch lookup + 4 TableCells | 6b23b7c | Step3Revisao.tsx |
| 3 | PDF v2 row functions + gerarPdfHtml async | 71f4d26 | v2.ts, gerarPdfHtml.ts, OrcamentoDetalhe.tsx, Step3Revisao.tsx |
| 4 | Smoke checklist 10-05-SMOKE.md | c4059e0 | 10-05-SMOKE.md |
| 5 | Smoke manual em prod | — | CHECKPOINT (pendente) |

## Arquivos Novos

- `src/lib/produtoDescricao.ts` — `construirDescricaoRica` pura + interface `AtributosRicos`
- `src/lib/__tests__/produtoDescricao.test.ts` — 8 testes Vitest (formato completo, parcial, snapshot antigo, null, 0W, string vazia, suppress, JSONB stringificado)
- `.planning/phases/10-wizard-edi-o-status-descri-o-rica/10-05-SMOKE.md` — checklist smoke 5 fluxos D-30

## Arquivos Modificados

- `src/components/Step3Revisao.tsx` — imports `useQuery` + `construirDescricaoRica`; `allCodigos` useMemo; `useQuery` batch lookup `product_variants` staleTime 5min; helper `descricaoRica()`; 4 TableCells substituídas (luminária/fita/perfil/driver)
- `src/lib/pdfTemplates/v2.ts` — tipo `AtributosMap` exportado; import `construirDescricaoRica`; `rowLuminaria/rowFita/rowPerfil/rowDriver` ganham parâmetro `atributosMap`; `blocoSistema/blocoLocal/blocoAmbiente/gerarOrcamentoHtmlV2` propagam `atributosMap`
- `src/lib/gerarPdfHtml.ts` — `buildAtributosMap` async helper (batch lookup, só para v>=2); `gerarOrcamentoHtml` tornou-se `async` retornando `Promise<string>`
- `src/pages/OrcamentoDetalhe.tsx` — `await gerarOrcamentoHtml(params)` (corrigido para assinatura async)

## Preservação D-21

- `src/components/AmbienteCard.tsx` — NÃO modificado (Step 2 permanece com nome cru)
- `src/lib/pdfTemplates/v1.ts` — NÃO modificado (PDF v1 legacy permanece com nome cru)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] gerarOrcamentoHtml precisou tornar-se async**
- **Found during:** Task 3
- **Issue:** O plan especificava `buildAtributosMap` como helper chamado antes do v2 builder, mas a função `gerarOrcamentoHtml` era síncrona. Tornar async era necessário para `await buildAtributosMap()` internamente.
- **Fix:** `gerarOrcamentoHtml` agora retorna `Promise<string>`; todos os call sites (`Step3Revisao.handlePDF`, `OrcamentoDetalhe.handleReemitirPdf`) já eram `async` — adicionado `await` em ambos.
- **Files modified:** `src/lib/gerarPdfHtml.ts`, `src/components/Step3Revisao.tsx`, `src/pages/OrcamentoDetalhe.tsx`
- **Commits:** 71f4d26

## Test Results

```
Test Files  6 passed (6)
Tests       55 passed (55)
```

Inclui 8 novos testes do builder `construirDescricaoRica`.

## Known Stubs

Nenhum. Todos os dados fluem de `product_variants` via batch lookup real. Fallback ao snapshot puro (D-22) é comportamento intencional, não stub.

## Threat Flags

Nenhum novo surface de segurança introduzido além do registrado no threat_model do PLAN.md:
- T-10-19 (Tampering snapshot): mitigado — snapshot não é reescrito, lookup é read-only
- T-10-20 (DoS N queries): mitigado — batch único + staleTime 5min
- T-10-22 (XSS via JSONB): mitigado — v2.ts já passa por `esc()` em todos os pontos de inserção HTML

## Self-Check: PASSED

- FOUND: src/lib/produtoDescricao.ts
- FOUND: src/lib/__tests__/produtoDescricao.test.ts
- FOUND: .planning/phases/10-wizard-edi-o-status-descri-o-rica/10-05-SMOKE.md
- FOUND: .planning/phases/10-wizard-edi-o-status-descri-o-rica/10-05-SUMMARY.md
- FOUND commit 3b1f6ca (Task 1 — builder + tests)
- FOUND commit 6b23b7c (Task 2 — Step3Revisao)
- FOUND commit 71f4d26 (Task 3 — PDF v2 + gerarPdfHtml)
- FOUND commit c4059e0 (Task 4 — smoke checklist)
