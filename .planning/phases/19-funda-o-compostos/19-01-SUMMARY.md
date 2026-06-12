---
phase: 19-funda-o-compostos
plan: "01"
subsystem: data-model
tags: [data-model, calc, typescript, tdd, backward-compat]
dependency_graph:
  requires: []
  provides: [ItemComposicao, composicao-field, REGRAS_COMPOSICAO, calcularSubtotalComposicao, calcularTotalAmbienteSemFita-extended]
  affects: [src/types/orcamento.ts]
tech_stack:
  added: []
  patterns: [forward-complete interface, optional field backward-compat, guard ?.length, TDD red-green]
key_files:
  created:
    - src/types/__tests__/composicao.test.ts
  modified:
    - src/types/orcamento.ts
decisions:
  - "ItemComposicao forward-complete: comprimento? + potenciaW? added now so Phase 20/21 never re-open the type"
  - "composicao? in ItemLuminaria (not sistemas[]) per architectural anchor D-01: conserves all 4 Fita calc sites byte-identical"
  - "REGRAS_COMPOSICAO lives in code (3 fixed families), not in produto_composicao table (reserved for SKU suggestions)"
  - "calcularSubtotalComposicao uses ?.length guard — old snapshots with undefined sum to 0 with no NaN risk"
metrics:
  duration_seconds: 161
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_modified: 2
---

# Phase 19 Plan 01: Fundação Compostos — Data Model Summary

**One-liner:** Aditivo TypeScript puro — `ItemComposicao` forward-complete (comprimento/potenciaW), `composicao?` em `ItemLuminaria`, `REGRAS_COMPOSICAO` por família (LM2338/LM3168/LM3169/LM2987), `calcularSubtotalComposicao` com guard `?.length`, e extensão backward-safe de `calcularTotalAmbienteSemFita`; 4 calc sites de Fita Padrão byte-idênticos, 137 testes verdes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for ItemComposicao, REGRAS_COMPOSICAO, calcularSubtotalComposicao | c611f4b | src/types/__tests__/composicao.test.ts |
| 1 (GREEN) | ItemComposicao + composicao? + REGRAS_COMPOSICAO + calcularSubtotalComposicao | d731db4 | src/types/orcamento.ts |
| 2 (GREEN) | Extend calcularTotalAmbienteSemFita + all tests green | 7dff031 | src/types/orcamento.ts |

## What Was Built

### `ItemComposicao` interface (forward-complete)
- Fields: `id, codigo, descricao, quantidade, precoUnitario, precoMinimo, imagemUrl?, papel, obrigatorio, comprimento?, potenciaW?`
- `papel` union: `'modulo' | 'driver_recomendado' | 'driver_obrigatorio' | 'conector_energia' | 'kit_fixacao' | 'acessorio_opcional'`
- `comprimento?` and `potenciaW?` are optional — Phase 20/21 use them without re-opening the type

### `composicao?: ItemComposicao[]` in `ItemLuminaria`
- Optional field — old snapshots have `undefined` and continue working exactly as before

### `REGRAS_COMPOSICAO` constant
- Keyed by `sistema` string matching `product_variants.sistema`
- `magneto_48v`: `conectoresObrigatorios: ['LM2338']`, `kitFixacaoEmbutir: 'LM2987'`
- `tiny_magneto`: `conectoresObrigatorios: ['LM3168', 'LM3169']`, `kitFixacaoEmbutir: 'LM2987'`

### `calcularSubtotalComposicao(item: ItemLuminaria): number`
- `?.length` guard: returns `0` for `undefined` or `[]` (backward-compat)
- Returns `Σ(c.precoUnitario × c.quantidade)` when populated

### `calcularTotalAmbienteSemFita` extended
- `totalLum` now includes `calcularSubtotalComposicao(i)` per luminária
- Old ambientes without `composicao` return identical sums (guard ensures +0)

## Invariant Verification

The 4 protected calc sites are byte-identical (verified via `git diff`):
- `calcularDemandaFita` — untouched
- `calcularConsumoW` — untouched
- `calcularQtdDrivers` — untouched
- `calcularSubtotalSistemaSemFita` — untouched

## Test Results

- 137 tests pass (`npm run test --run`)
- 128 pre-existing + 9 new composicao tests
- Backward-compat explicitly covered: snapshot literal without `composicao` key sums correctly

## Deviations from Plan

None — plan executed exactly as written. TDD RED→GREEN followed per spec.

## Known Stubs

None — no UI wired, no data source needed. This plan is purely TypeScript types and calculation functions.

## Threat Flags

No new threat surface — purely client-side TypeScript, no I/O, no DB, no network.

T-19-01 mitigated: `?.length` guard prevents NaN/undefined in `calcularTotalAmbienteSemFita`; backward-compat covered by explicit snapshot test.
T-19-02 mitigated: git diff confirms the 4 calc sites are byte-identical.

## Self-Check: PASSED
