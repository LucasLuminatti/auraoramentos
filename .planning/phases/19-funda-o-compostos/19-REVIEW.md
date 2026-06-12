---
phase: 19-funda-o-compostos
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/types/orcamento.ts
  - src/types/__tests__/composicao.test.ts
  - src/hooks/useProdutoSearch.ts
  - supabase/migrations/20260612000001_cat03_tipo_produto_conector_kit.sql
  - supabase/migrations/20260612000002_produto_composicao_table.sql
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 19 (Fundação Compostos) adds an additive data model for composite lighting
systems plus a CAT-03 catalog fix and a new `produto_composicao` table. The work is
clean and disciplined. No bugs, security issues, or backward-compatibility regressions
were found. Only three low-severity Info items are noted below.

Verification against the project's stated invariants:

- **5 Fita Padrão calc sites backward-safe — CONFIRMED.** `calcularDemandaFita`,
  `calcularConsumoW`, `calcularQtdDrivers`, and `calcularSubtotalSistemaSemFita`
  (orcamento.ts) are untouched by the new code paths. `isSistemaVazio` (v2.ts) was
  not modified (confirmed: only additions to orcamento.ts). The single integration
  point — `calcularTotalAmbienteSemFita` (orcamento.ts:524-531) — adds
  `+ calcularSubtotalComposicao(i)` per luminária, and that helper guards with
  `if (!item.composicao?.length) return 0`, so old snapshots with `composicao=undefined`
  return 0 (no behavior change). Tests at composicao.test.ts:39-42 explicitly cover the
  literal-snapshot-without-the-key case.
- **New composite code uses `?.length` guards — CONFIRMED.** `calcularSubtotalComposicao`
  (orcamento.ts:287) uses the optional-chaining guard. `ItemComposicao` and `composicao`
  are optional fields; `REGRAS_COMPOSICAO` is a static map with no read-time dependency on
  snapshots.
- **useProdutoSearch new filters don't break existing branches — CONFIRMED.** The
  `'conector'`/`'kit_fixacao'` filters route through the same `.eq('tipo_produto', filtro)`
  branch as `'fita'`/`'driver'`/`'perfil'` (line 28). The `'luminaria'` and `'todos'`
  branches are unchanged. The driver voltage pre-filter still applies only when
  `filtro === 'driver'`.
- **Migrations additive + RLS correct — CONFIRMED.** The CAT-03 migration is transactional,
  idempotent (`IS DISTINCT FROM` guards), and uses an explicit auditable codigo list (no mass
  UPDATE). It targets `product_variants`; the `produtos` view re-exposes `tipo_produto`
  (migration 20260501000001, view lines 88-115), so `useProdutoSearch` sees the corrected
  values. RLS on `produto_composicao` matches the established pattern: read for
  `authenticated`, write gated by `has_role(auth.uid(), 'admin'::app_role)` — identical to
  the cast convention in 20260515000001 / 20260514000002. Service role bypasses RLS naturally.

## Info

### IN-01: `conector` value appears in both the `luminaria` and `conector` filter branches

**File:** `src/hooks/useProdutoSearch.ts:31`
**Issue:** The `'luminaria'` branch includes `conector` in its `tipo_produto.in.(spot,lampada,acessorio,conector,suporte)` list. After CAT-03 tags magneto/tiny conectores as `tipo_produto='conector'`, those SKUs will now surface under BOTH the `'luminaria'` search and the new dedicated `'conector'` search. This is likely intentional (a collaborator can still add a connector as a standalone luminária line), and it is pre-existing behavior (`conector` was already in that IN-list), so it is not a regression. Flagging only so the overlap is a conscious decision rather than an accident.
**Fix:** No change required if the overlap is intended. If conectores should be reachable only via the dedicated `'conector'` filter once composite UI ships (Phase 20+), remove `conector` from the `luminaria` IN-list at that time.

### IN-02: CAT-03 rollback comment is inconsistent with the SET-NULL rollback for already-`conector` SKUs

**File:** `supabase/migrations/20260612000001_cat03_tipo_produto_conector_kit.sql:22-29`
**Issue:** The header note (line 22) correctly warns "LM3168/LM3169 já eram 'conector' antes da fase — não reverter esses para NULL", but the rollback SQL block (lines 24-26) sets the full magneto/tiny list to NULL excluding only LM3168/LM3169 — which is consistent with the note. This is fine, but the forward UPDATE (lines 49-52) includes LM3168/LM3169 in the `conector` list with an `IS DISTINCT FROM` guard, so they are no-ops forward and correctly excluded from rollback. The asymmetry between the forward list (10 codes) and the rollback list (8 codes) is intentional but easy to misread during an incident. Consider a one-line inline comment on the rollback to restate why LM3168/LM3169 are absent.
**Fix:** Add a comment in the rollback block, e.g. `-- LM3168/LM3169 omitidos: já eram 'conector' antes da fase (ver nota L22).`

### IN-03: `papel` literal union duplicated between TS type and SQL CHECK with no single source of truth

**File:** `src/types/orcamento.ts:51` and `supabase/migrations/20260612000002_produto_composicao_table.sql:14-17`
**Issue:** The six `papel` values (`'modulo' | 'driver_recomendado' | 'driver_obrigatorio' | 'conector_energia' | 'kit_fixacao' | 'acessorio_opcional'`) are declared independently in the `ItemComposicao.papel` TS union and in the `produto_composicao.papel` CHECK constraint. They currently match exactly. Because they are maintained by hand in two places, a future edit to one risks silent drift (e.g., adding a role in TS but not in SQL would let an insert fail at runtime, or vice versa). Note the two sets serve slightly different domains — `ItemComposicao.papel` lives on the snapshot, `produto_composicao.papel` on the suggestion table — but they share the same vocabulary by design.
**Fix:** No action required for v1. When the admin/CSV importer for `produto_composicao` is built (Phase 20+), centralize the role list as a shared constant or a generated type from `supabase/types.ts`, and reference it in both validation layers.

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
