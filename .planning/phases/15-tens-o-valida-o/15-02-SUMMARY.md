---
phase: 15-tens-o-valida-o
plan: "02"
subsystem: wizard/sistemas
tags: [validacao, drivers, voltagem, autocomplete, tiny, advisory]
dependency_graph:
  requires:
    - src/hooks/useProdutoSearch.ts (extended with filtroVoltagem)
    - src/components/ProdutoAutocomplete.tsx (extended with filtroVoltagem prop)
    - src/types/orcamento.ts (MARGEM_SEGURANCA_DRIVER, calcularDemandaFita)
  provides:
    - filtroVoltagem pre-filter on driver autocomplete
    - driver auto-suggestion on fita selection (D-02a)
    - non-blocking voltage divergence (toast.warning + badge)
    - TINY MAG 24V advisory (toast + amber badge)
  affects:
    - src/components/AmbienteCard.tsx
tech_stack:
  added: []
  patterns:
    - async event handler with Supabase query (buscarDriverSugerido)
    - state-derived badge (no extra useState for divergence/tiny)
    - filtroVoltagem prop threading: AmbienteCard -> ProdutoAutocomplete -> useProdutoSearch
key_files:
  created: []
  modified:
    - src/hooks/useProdutoSearch.ts
    - src/components/ProdutoAutocomplete.tsx
    - src/components/AmbienteCard.tsx
decisions:
  - "D-02a approved: suggest smallest sufficient driver with tensao preenchida; metragem real if available, 5m fallback"
  - "D-05: remove blocking return from voltage validation — toast.warning only, selection proceeds"
  - "D-03: pre-fill driver only when driver.codigo is empty — never overwrite manual choice"
  - "D-04: divergence badge derived from state, no extra useState needed"
  - "D-07: TINY detection via produto.sistema_magnetico === 'tiny_magneto' (data-driven, not regex)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-10"
  tasks: 3
  files: 3
requirements: [TENS-01, SIST-04, UX-02]
---

# Phase 15 Plan 02: Tensão/Validação — Driver Advisory Summary

Driver selection is now proactive and voltage validation is non-blocking: the driver autocomplete pre-filters by fita voltage, auto-suggests a compatible driver when driver is empty, replaces the blocking error with a warning badge, and flags TINY luminarias with an amber advisory.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Estender useProdutoSearch + ProdutoAutocomplete com filtroVoltagem | 82658c3 | useProdutoSearch.ts, ProdutoAutocomplete.tsx |
| 2 | Pré-fill driver sugerido + toast/badge divergência não-bloqueante | f83cc75 | AmbienteCard.tsx |
| 3 | Advisory TINY — toast + badge "requer driver 24V externo" | ef3e96c | AmbienteCard.tsx |

## What Was Built

### Task 1 — filtroVoltagem in useProdutoSearch + ProdutoAutocomplete

- `useProdutoSearch` gained optional 3rd param `filtroVoltagem?: number`
- When `filtro === 'driver'` and `filtroVoltagem` is set, adds `.or('tensao.eq.X,tensao.is.null')` to the query — includes 46/61 drivers that have `tensao = null` but are compatible by description
- `filtroVoltagem` added to `useEffect` dependency array
- `ProdutoAutocomplete` interface extended with `filtroVoltagem?: number` prop, threaded to hook

### Task 2 — Pre-fill + non-blocking validation + divergence badge

- `buscarDriverSugerido(voltagem, wm, metragemReal)` helper: async Supabase query to fetch the smallest sufficient driver (`potencia_watts >= consumo * 1.05`) with `tensao = voltagem`, excluding `DESCONTINUAR` items
- `handleSelectProdutoSistema` made `async`
- When `component === 'fita'` and `driverVazio` (D-03): awaits `buscarDriverSugerido`, pre-fills driver fields if found
- Blocking `toast.error + return` on voltage mismatch replaced by `toast.warning` — selection proceeds (D-05)
- Voltage warning on `fita` branch now only fires when `sis.driver.codigo` is set (avoids false warning before pre-fill)
- Driver `ProdutoAutocomplete` now receives `filtroVoltagem={sis.fita.voltagem}` (D-01)
- Divergence badge `⚠ {fv}V × {dv}V` rendered in sistema header when both fita and driver have codes and voltages differ; disappears automatically when they match (D-04)

### Task 3 — TINY advisory

- TINY toast updated to explicitly state "requer driver 24V externo" for both embutir and standard variants (D-06)
- Detection primary via `produto.sistema_magnetico === 'tiny_magneto'` (D-07); regex fallback preserved
- Amber badge `requer driver 24V externo` with `border-amber-400 text-amber-700 bg-amber-50` added to luminaria card, conditioned on `item.sistema === 'tiny_magneto'`; disappears when item replaced (state-derived)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Minor adjustment

Voltage warning on the `fita` branch was enhanced beyond the plan spec: added `sis.driver.codigo &&` check before comparing voltages. Without this, selecting a fita with a newly pre-filled driver (from `buscarDriverSugerido`) would briefly fire a spurious warning if the driver default `voltagem: 24` mismatched — even though the driver field was empty before. This aligns with D-03 semantics (only warn when a real driver was already manually chosen).

## Known Stubs

None — all three behaviors (pre-filter, pre-fill, TINY badge) are fully wired to live state and Supabase data.

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` covered:
- `buscarDriverSugerido` reads the same `produtos` table already used by `useProdutoSearch`, same RLS
- `filtroVoltagem` interpolated as `number` (typed `12 | 24 | 48`) — no injection risk (T-15-03 mitigated)

## Self-Check

Files created/modified:
- src/hooks/useProdutoSearch.ts — MODIFIED
- src/components/ProdutoAutocomplete.tsx — MODIFIED
- src/components/AmbienteCard.tsx — MODIFIED

Commits:
- 82658c3 — feat(15-02): add filtroVoltagem to useProdutoSearch + ProdutoAutocomplete
- f83cc75 — feat(15-02): driver pre-fill + non-blocking voltage warning + divergence badge
- ef3e96c — feat(15-02): TINY advisory - update toast message + persistent amber badge

## Self-Check: PASSED
