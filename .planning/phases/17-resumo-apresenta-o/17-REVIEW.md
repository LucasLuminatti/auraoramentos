---
phase: 17-resumo-apresentacao
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/types/orcamento.ts
  - src/components/Step3Revisao.tsx
  - src/lib/pdfTemplates/v2.ts
  - src/types/orcamento.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 17: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 4
**Status:** clean

## Summary

Reviewed the four files changed in Phase 17 (resumo-apresentação): the `LocalBreakdown` interface and `GrupoFita` extension in `orcamento.ts`, the localBreakdown chips and drivers Collapsible in `Step3Revisao.tsx`, the photo + LOCAL chips in `blocoResumoFitas` in `v2.ts`, and the test suite.

**Backward-compat:** Solid. `localBreakdown` and `imagemUrl` are both optional fields on `GrupoFita`, and the field is always re-computed from `ambientes[]` (never stored/loaded from JSONB). Old snapshots without `sis.local` produce `label = amb.nome` cleanly. Old fitas without `imagemUrl` hit the `thumb()` empty-div fallback. No regressions to the 3-step wizard.

**Accumulator correctness:** The `Map<string, number>` accumulator in `calcularRolosPorGrupo` correctly merges same-label entries (same ambiente + same local), preserving Map insertion order. The invariant `sum(localBreakdown.demanda) === demandaTotal` holds mathematically and is validated by a dedicated test.

**XSS:** `blocoResumoFitas` passes `lb.label` through `chip()` which calls `esc()` internally. `thumb(g.imagemUrl)` passes the URL through `esc()` before interpolating into a double-quoted `src` attribute. Both are safe. The `imagemUrl` pipeline (Supabase URL → `inlineImagensSnapshot` → base64 `data:` URL → `esc()`) has no injection surface.

**Test coverage:** The six new tests in `orcamento.test.ts` cover the core contract: multi-ambiente merge, no-local fallback, same-label deduplication, backward-compat for `qtdRolosTotal`/`subtotal`, `imagemUrl` propagation, and the sum invariant. No gaps in the happy paths.

All reviewed files meet quality standards. The two info items below are cosmetic and carry no correctness or security risk.

## Info

### IN-01: `lb.demanda` displayed without rounding in chips

**File:** `src/lib/pdfTemplates/v2.ts:273` and `src/components/Step3Revisao.tsx:741`

**Issue:** `lb.demanda` is rendered as a raw JS number (`${lb.demanda}m`). When `metragemManual` is a non-integer (e.g. `2.5`) and multiple systems share the same label, accumulated float addition could produce values like `7.999999999m` in edge cases. This is consistent with how `g.demandaTotal` and `g.demanda` are already displayed elsewhere in the component (no prior rounding), so it is not a Phase 17 regression — but the new local chips are a fresh display surface.

**Fix:** Apply `Number.isInteger(lb.demanda) ? lb.demanda : lb.demanda.toFixed(1)` before rendering, or use the same `Intl`-based approach as `formatarMoeda` for numeric display consistency. Example:

```ts
// chip in v2.ts
chip(`${lb.label} · ${Number.isInteger(lb.demanda) ? lb.demanda : lb.demanda.toFixed(1)}m`)
```

### IN-02: `key={i}` for `localBreakdown` badges uses array index

**File:** `src/components/Step3Revisao.tsx:741`

**Issue:** `key={i}` (array index) is used for the `localBreakdown` badge list. The list is computed from a `Map` (deterministic insertion order) and never reordered or individually animated, so this causes no visible bug. However, `lb.label` is unique within a single `GrupoFita` and would be a more semantically stable key.

**Fix:**

```tsx
{g.localBreakdown.map((lb) => (
  <Badge key={lb.label} variant="outline" ...>
    {lb.label} · {lb.demanda}m
  </Badge>
))}
```

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
