---
phase: 14-cat-logo-dados
reviewed: 2026-06-10T14:54:30Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - supabase/migrations/20260610000001_tipo_produto_correcao_catalogos.sql
  - e2e/catalogo.spec.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-10T14:54:30Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the CAT-01 data-correction migration and the Playwright E2E spec that validates it against PROD. The migration is well-constructed: explicitly transactional (`BEGIN`/`COMMIT`), idempotent via `IS DISTINCT FROM` guards, scoped to an explicit allow-list of SKUs, targets the base table `product_variants` (not the `produtos` view), and documents a concrete rollback. It is consistent with the filter logic in `useProdutoSearch.ts:27` (`.eq('tipo_produto', filtro)`) that the fix is designed to satisfy. No correctness or security issues found in the migration.

The E2E spec is sound in structure — defensive cleanup with snapshot-diff + fingerprint, stays in Step 2 so no orcamento is persisted, and asserts against real prod data. The findings below are all test-robustness and documentation concerns, not production-code defects. No critical issues.

## Warnings

### WR-01: Substring code-match in option assertions can match the wrong product row

**File:** `e2e/catalogo.spec.ts:80, 90, 101`
**Issue:** Option visibility is asserted with `getByRole("button", { name: new RegExp(p.codigo, "i") })`. The regex is unanchored, so `LM982` also matches `LM982AC`, `LM9820`, etc., and `LM3291` matches `LM3291AC`. Because the dropdown filters by `codigo.ilike.%query%`, typing `LM982` returns both `LM982` and `LM982AC` as buttons. The assertion only needs *one* visible match (`.first()`), so the test still passes even if the exact SKU `LM982` were missing but `LM982AC` were present — weakening the guarantee that the specific corrected SKU surfaced. Since both variants are in the migration list this won't produce a false pass today, but it makes the test less precise than its intent ("this exact SKU appears").
**Fix:** Anchor the match to the exact code, e.g. assert against a button whose accessible name starts with the code followed by a word boundary, or match the rendered `codigo` span exactly:
```ts
new RegExp(`^${p.codigo}\\b`, "i")
```
or locate the option by its `font-mono` code span text equal to `p.codigo`.

## Info

### IN-01: Autocomplete input has no accessible name beyond `placeholder`

**File:** `src/components/ProdutoAutocomplete.tsx:35-40` (referenced by `e2e/catalogo.spec.ts:75, 87, 100`)
**Issue:** The `Input` exposes only a `placeholder` ("Código do perfil" / "Código da fita" / "Código do item"), no `aria-label` or associated `<label>`. The test relies on Playwright deriving the accessible name from the placeholder (`getByRole("textbox", { name: /Código do perfil/i })`). This works in Playwright today, but placeholder-as-accessible-name is a fragile contract: any future addition of a real label or aria-label would silently change the name and break these locators. It is also an a11y gap.
**Fix:** Add an explicit `aria-label` to the autocomplete `Input` (forward a prop or default it from `placeholder`), making the accessible name intentional rather than incidental.

### IN-02: Contradictory / confusing comment on the FITA test constant

**File:** `e2e/catalogo.spec.ts:21`
**Issue:** The inline comment `// FITA LED ULTRA POWER ... 48V? (não — 24V/12V); rolo de fita real` reads as an unresolved self-question left in the source. It does not clarify what `LM3825` is and may mislead a future reader about voltage semantics that are irrelevant to the fita selector test.
**Fix:** Replace with a definitive one-line description of `LM3825` (e.g. `// FITA LED ULTRA POWER 24V — rolo de fita corrigido para tipo_produto='fita'`).

### IN-03: Magneto toast hinges on a literal `MAGNETO22` regex unrelated to the tested SKU

**File:** `src/components/AmbienteCard.tsx:81` (asserted by `e2e/catalogo.spec.ts:106`)
**Issue:** The CAT-02 toast branch fires on `produto.sistema_magnetico === 'magneto_48v' || /MAGNETO22/.test(d)`. The test SKU `LM2331` ("TRILHO ... MAGNETICO ... 48V") almost certainly matches via the `sistema_magnetico === 'magneto_48v'` data condition, not via `/MAGNETO22/` (its description contains "MAGNETICO", not "MAGNETO22"). The literal `MAGNETO22` regex is an undocumented magic string whose origin is unclear; if the `sistema` column for any magneto SKU is ever wrong, the description fallback won't catch it. This is pre-existing app code (not changed in this phase) — flagged for awareness because the test's correctness depends on the data condition holding in PROD.
**Fix:** No change required for Phase 14. Consider documenting why `MAGNETO22` exists, or broadening the description fallback to `/MAGNET[IÉ]?CO/i` for resilience, in a future phase.

### IN-04: Cleanup retry loop accumulates instead of stopping at first success cleanly

**File:** `e2e/catalogo.spec.ts:36-42`
**Issue:** The `afterEach` loops up to 3 times summing `total += deleteOrcamentoDeTeste(...)` and breaks once `total >= 1`. Because each `deleteOrcamentoDeTeste` call re-queries and deletes any *newly matching* rows, the running sum is correct, but the structure is slightly confusing: the retry exists to handle eventual-consistency lag, yet the assertion `total <= 1` would fail loudly if two distinct test rows leaked. Given the test stays in Step 2 and creates no orcamento, the expected value is 0; the retry/poll adds little value here and the intent ("we created nothing, but defensively clean") could be stated more directly.
**Fix:** Optional — since this spec never persists an orcamento, the loop could be simplified to a single defensive `deleteOrcamentoDeTeste` call (still asserting `<= 1`), reducing per-test wall-clock by up to ~2s of `setTimeout` waits.

---

_Reviewed: 2026-06-10T14:54:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
