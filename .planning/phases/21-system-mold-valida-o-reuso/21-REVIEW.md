---
phase: 21-system-mold-valida-o-reuso
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/types/orcamento.ts
  - src/types/orcamento.test.ts
  - src/hooks/useProdutoSearch.ts
  - src/components/ComposicaoCard.tsx
  - src/components/AmbienteCard.tsx
  - src/components/Step2Ambientes.tsx
  - src/components/__tests__/advisory-compostos.test.ts
  - supabase/migrations/20260616000001_sistema_s_mode_system_mold.sql
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-06-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 21 (SYSTEM MOLD — composição modular) is well-engineered overall. The clone helpers regenerate UUIDs across the full tree (root + `composicao[]`), the advisory in `Step2Ambientes` is genuinely non-blocking (it routes through an `AlertDialog` whose "Continuar mesmo assim" calls `onNext()`), and backward-compat is respected throughout (every `composicao` access is guarded with `?.` / `?? []`, and pure functions return 0/undefined for absent data). Test coverage for the new pure functions and clone helpers is strong.

The issues found are all in async-callback closure handling in `ComposicaoCard` and a few correctness/quality gaps. None are critical: no security vulnerabilities, no data loss, no crashes on the happy path. The most important is WR-01 — the SYSTEM MOLD driver search (`buscarDriverModular`) writes its result into the `sugestao24v`/`buscando24v` state shared with the 24V `useEffect`, with no cancellation coordination between the two, so a stale advisory can be shown.

## Warnings

### WR-01: SYSTEM MOLD driver search shares state with the 24V effect and its cancellation token is dead

**File:** `src/components/ComposicaoCard.tsx:326-369` (and call site `:322`)
**Issue:** `buscarDriverModular` returns a cleanup function `() => { cancelled = true; }`, but it is invoked as a fire-and-forget call from `handleAdicionarFitaModular` (`:322`) — the returned cleanup is discarded, so `cancelled` can never become `true`. The local `if (cancelled) return` guard at `:346` is therefore dead code.

More importantly, both `buscarDriverModular` and the 24V `useEffect` (`:111-165`) write the same `sugestao24v` / `buscando24v` / `sem24v` state. For an `isModular` card, `is24V` is `false`, so the 24V effect early-returns and never competes — but if a user adds a fita (triggering `buscarDriverModular`), then quickly removes/re-adds modules, two in-flight `buscarDriverModular` calls can resolve out of order with no cancellation, leaving a stale driver suggestion. Because `renderPainelDriver24V` is rendered for `isModular` too (`:942`), a stale `sugestao24v` is shown to the user.

**Fix:** Track the in-flight request with a ref so a newer call invalidates older ones, instead of relying on a discarded cleanup:
```ts
const driverReqId = useRef(0);

const buscarDriverModular = async (voltagem: number, wm: number, metragem: number) => {
  const metragemEf = metragem > 0 ? metragem : 5;
  const consumo = wm * metragemEf * MARGEM_SEGURANCA_DRIVER;
  if (consumo <= 0) return;
  const reqId = ++driverReqId.current;
  setBuscando24v(true);
  setSem24v(false);
  const { data } = await supabase /* ...query... */;
  if (reqId !== driverReqId.current) return; // superseded
  // ...setSugestao24v / setSem24v / setBuscando24v as before
};
```
Drop the unused `cancelled`/IIFE/returned-cleanup scaffolding.

### WR-02: `buscando24v` can get stuck `true` for a modular card, hiding the driver panel indefinitely

**File:** `src/components/ComposicaoCard.tsx:322, 326-329`
**Issue:** `buscarDriverModular` sets `setBuscando24v(true)` at `:332`, but returns early at `:329` (`if (consumo <= 0) return`) *before* that — so the early-return path is fine. However the inverse race exists with the 24V effect: when `cargaTotalW` later changes for a modular card, the 24V effect at `:111` early-returns (`if (!is24V) return`) and never resets `buscando24v`. So if `buscando24v` was left `true` by a superseded `buscarDriverModular` (see WR-01), nothing else clears it, and `renderPainelDriver24V` stays stuck on "Calculando driver recomendado..." (`:543-549`). The fix in WR-01 (request-id guard that always reaches `setBuscando24v(false)`) resolves this; without it, add a guaranteed reset.
**Fix:** Ensure every path through `buscarDriverModular` clears `buscando24v` (wrap the body in `try/finally` with `setBuscando24v(false)` in `finally`), gated by the request-id check from WR-01.

### WR-03: `inserirCompostoEm` reads `ambientes[destinoIdx].nome` for the toast after `onChange` — uses pre-clone array, which is correct, but the index can be stale relative to the dialog

**File:** `src/components/Step2Ambientes.tsx:120-129, 296-300`
**Issue:** `inserirCompostoEm(destinoIdx, item)` is called from the dialog with `Number(dupDestinoIdx)`. `dupDestinoIdx` is captured when the user opens the dialog and is a string index into `ambientes`. If the `ambientes` array changes between opening the dialog and clicking "Duplicar" (e.g. another async driver suggestion in a sibling `AmbienteCard` triggers an `onChange` that reorders/removes ambientes), `destinoIdx` may now point at a different ambiente or be out of range. `ambientes[destinoIdx].nome` at `:128` would then read the wrong name (or throw on `undefined.nome`). The dialog is modal so this is unlikely in practice, but the index-based target is fragile.
**Fix:** Key the destination by ambiente `id` rather than array index:
```tsx
// store id in dupDestinoIdx (use a.id as SelectItem value)
const destino = ambientes.find((a) => a.id === dupDestinoId);
if (!destino) { toast.error("Ambiente de destino não encontrado."); return; }
const arr = ambientes.map((a) => a.id === destino.id ? { ...a, luminarias: [...a.luminarias, clone] } : a);
onChange(arr);
toast.success(`Sistema duplicado para "${destino.nome}".`);
```

### WR-04: Duplicating a SYSTEM MOLD composto carries the snapshot `comprimento` of `fita_modular` but never re-derives it — silent divergence if modules later change

**File:** `src/types/orcamento.ts:634-640` (`clonarItemLuminaria`); behavioral interaction with `src/components/ComposicaoCard.tsx:304-323`
**Issue:** `clonarItemLuminaria` deep-clones `composicao` verbatim (correct for UUIDs). For a SYSTEM MOLD item the cloned `fita_modular.comprimento` is the snapshot computed at the original's add-time. After duplication into another ambiente, the cloned card's "Fita necessária" derived value (`metragemDerivada`, recomputed live from modules at `:104`) and the cloned `fita_modular.comprimento` (static snapshot) are independent. This is by design (snapshot-at-add-time, D-03), but the cloned card shows no signal that the fita metragem may not match the derived value, and there is no advisory for "fita_modular comprimento ≠ derived metragem". A user duplicating then editing module quantities on the clone gets a fita length that silently no longer matches.
**Fix:** Not necessarily a code change — confirm this is intended. If a mismatch should warn, add a check in `detectarAvisosComposto` for `s_mode`: when `fita_modular` exists and `Math.abs(fitaModular.comprimento - calcularMetragemModulosDifusos(comp)) > epsilon`, push a `modular-fita-divergente` advisory. At minimum, document the intended snapshot semantics near the `fita_modular` handling.

## Info

### IN-01: Dead cancellation scaffolding duplicated across two async helpers

**File:** `src/components/ComposicaoCard.tsx:331, 368` and `:123, 162-164`
**Issue:** The `let cancelled = false` + inner IIFE + `return () => { cancelled = true; }` pattern in `buscarDriverModular` mirrors the 24V `useEffect`'s cancellation, but only the effect's cleanup is actually wired to React. The helper's version is non-functional (see WR-01). Two near-identical async-driver-search blocks (`:127-160` and `:335-366`) also duplicate ~30 lines each.
**Fix:** Extract a single `async function buscarDriverPorTensao(voltagem, consumoMinimoW): Promise<Sugestao24V | null>` and call it from both the effect and the modular path, applying the WR-01 request-id guard once.

### IN-02: `parsearComprimentoModulo` regex requires the literal "FITA LED" prefix — brittle to catalog description drift

**File:** `src/types/orcamento.ts:201-207`
**Issue:** Both regexes anchor on `FITA LED\s+(\d+...)\s*MM|MT`. If a future difuso description omits "FITA LED" before the dimension (e.g. "MODULO DIFUSO 264MM SYSTEM MOLD"), the parse silently returns `undefined`, the module gets no `comprimento`, and `calcularMetragemModulosDifusos` silently excludes it — producing a too-low fita demand with no error surfaced. Tests cover the current 15 descriptions but not reordered variants.
**Fix:** Loosen to match a dimension token anywhere after "DIFUSO", or fall back to a bare `(\d+(?:[,.]\d+)?)\s*(MM|MT)\b` when the "FITA LED"-anchored match fails. Keep the snapshot-at-add-time behavior.

### IN-03: `useProdutoSearch` interpolates raw `query` into Supabase `.or(ilike)` filter strings

**File:** `src/hooks/useProdutoSearch.ts:61, 75`
**Issue:** `queryBuilder.or(\`codigo.ilike.%${query}%,descricao.ilike.%${query}%\`)` interpolates user input directly into the PostgREST filter expression. The Supabase SDK parameterizes the *values*, but commas/parentheses in `query` could alter the `.or()` expression structure (PostgREST `or` is comma-delimited). This is a pre-existing pattern (not introduced this phase) and is low-risk against a read-only `produtos` view under RLS, but a `query` containing `,` or `)` would break the filter rather than search literally. Same applies to the fallback at `:75`.
**Fix:** Sanitize/escape PostgREST reserved chars in `query` before interpolation, or use the builder's `.ilike()` with separate `.or()` composition. Pre-existing — flag for backlog, not a Phase 21 blocker.

### IN-04: Migration has no rollback section and relies on description ILIKE heuristics with a hard expected-row contract in comments only

**File:** `supabase/migrations/20260616000001_sistema_s_mode_system_mold.sql:8, 19`
**Issue:** The comments assert "esperado: 12 linhas" and "esperado: 15 linhas" but nothing in the migration verifies the row count, so a catalog where descriptions don't match the ILIKE patterns silently marks 0 rows and the whole SYSTEM MOLD flow is inert with no signal. The migration is idempotent (good, via `IS DISTINCT FROM`) but has no `DOWN`/rollback to un-set `sistema='s_mode'`.
**Fix:** Optionally add a guard inside the transaction, e.g. `DO $$ BEGIN IF (SELECT count(*) FROM product_variants WHERE descricao ILIKE '%SYSTEM MOLD%' AND sistema='s_mode') < 12 THEN RAISE WARNING '...'; END IF; END $$;`. Document the inverse UPDATE for rollback.

---

_Reviewed: 2026-06-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
