---
phase: 15-tens-o-valida-o
reviewed: 2026-06-11T06:12:28Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/types/orcamento.ts
  - src/types/orcamento.test.ts
  - src/components/Step3Revisao.tsx
  - src/hooks/useProdutoSearch.ts
  - src/components/ProdutoAutocomplete.tsx
  - src/components/AmbienteCard.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-06-11T06:12:28Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the phase 15 changes (Tensão & Validação): driver grouping-key fix in `calcularDriversPorProjeto`, composite driver label in Step3, voltage pre-filter on driver autocomplete, async driver-suggestion pre-fill, and the non-blocking voltage-divergence warning/badge.

The core grouping-key logic is correct and well-tested. The `codigo|voltagem` composite key + `split('|')[0]` reconstruction works because driver `codigo` values are clean SKU strings (e.g. `LM2130`) that never contain `|`; the new unit tests cover the distinct-voltage, same-voltage-merge, and "no pipe in output" cases. The non-blocking validation behavior (warning toast instead of `return` early, plus the destructive badge) matches the stated D-05/D-10 intent and degrades gracefully.

Two real concerns: (1) a stale-closure write in the async fita→driver suggestion flow that can silently discard concurrent edits, and (2) the grouping key splits on `|` which is theoretically fragile if a driver code ever contains that character. The remaining items are minor (info-level).

## Warnings

### WR-01: Async driver pre-fill writes stale `sis` snapshot — can discard concurrent edits

**File:** `src/components/AmbienteCard.tsx:148-247`
**Issue:** `handleSelectProdutoSistema` is now `async`. In the `fita` branch it captures `sis = ambiente.sistemas[sistemaIndex]` at the top, then `await buscarDriverSugerido(...)` (a Supabase round-trip), and only afterwards calls `updateSistema(sistemaIndex, { ...sis, fita: fitaAtualizada, driver: driverAtualizado })`. The spread uses the `sis` captured before the await. During that network window the user can change W/m, metragem, rolo, preço, or link/edit the perfil — and the final write overwrites the system from the stale snapshot, silently dropping those edits. A second, related risk: if the user removes or reorders systems during the await, `sistemaIndex` no longer points to the same system, so `updateSistema(sistemaIndex, ...)` writes to the wrong row.

This is not present in the `perfil`/`driver` branches because those are synchronous; the bug was introduced specifically by making the fita path await a query before its `updateSistema`.

**Fix:** Apply the fita update synchronously first (so the user's selection is never lost), then merge the suggested driver in a separate functional update that reads the latest state. For example, lift the update into the parent via a functional setter, or re-read the current system by `id` (not index) at write time:

```ts
// 1. Commit the fita immediately (synchronous, never lost)
updateSistema(sistemaIndex, { ...sis, fita: fitaAtualizada });

// 2. Suggest driver only if still empty, merging against latest state by id
if (driverVazio && fitaVolt) {
  const sugerido = await buscarDriverSugerido(fitaVolt, fitaAtualizada.wm, calcularDemandaFita(sis));
  if (sugerido) {
    const idx = ambiente.sistemas.findIndex((s) => s.id === sis.id);
    if (idx === -1) return; // system was removed during await
    const atual = ambiente.sistemas[idx];
    if (atual.driver.codigo) return; // user filled driver meanwhile — don't clobber
    updateSistema(idx, { ...atual, driver: { ...atual.driver, codigo: sugerido.codigo, /* ... */ } });
  }
}
```

Note: because `ambiente` is captured from props and React state updates are async, even `ambiente.sistemas` may be stale inside the same handler — the most robust fix is to route the merge through a functional `onChange`/setState in the parent that receives the current ambiente. At minimum, guarding on `id` instead of `index` removes the wrong-row write.

### WR-02: Grouping key `split('|')[0]` is fragile if a driver code ever contains `|`

**File:** `src/types/orcamento.ts:303,326`
**Issue:** The composite key is `` `${sis.driver.codigo}|${sis.driver.voltagem}` `` and the code is later recovered via `chave.split('|')[0]`. If a driver `codigo` ever contained a `|` (e.g. a malformed import or a future "combo" SKU), `split('|')[0]` would truncate the code and two distinct codes sharing a prefix could collide or render wrong. Current data uses clean SKUs so this is latent, not active — hence Warning, not Critical. The test `Teste 3` only asserts the *output* has no `|`, which holds as long as the *input* code has none, so it does not actually guard against this.

**Fix:** Avoid round-tripping the code through string parsing. Store the original `codigo` (and voltagem) as fields inside the map value instead of re-deriving from the key:

```ts
grupos.set(chave, {
  driverCodigo: sis.driver.codigo, // keep the raw code
  descricao: sis.driver.descricao,
  voltagem: sis.driver.voltagem,
  // ...
});
// then in the result loop:
driverCodigo: g.driverCodigo, // no split needed
```

Alternatively use `chave.split('|').slice(0, -1).join('|')` to be split-safe, but storing the field is cleaner and removes the dependency entirely.

## Info

### IN-01: `temDivergencia` badge can desync from the toast warning after voltage edit

**File:** `src/components/AmbienteCard.tsx:390-396` and `533`
**Issue:** The non-blocking divergence badge (`⚠ {fv}V × {dv}V`) recomputes live from `sis.fita.voltagem` vs `sis.driver.voltagem`, which is correct and good. But the one-shot toast warning (lines 155-170) only fires at selection time, while the driver Voltagem `<Select>` (line 542) lets the user change driver voltage afterward with no toast. The badge will reflect the new divergence but the user gets no active nudge. This is consistent with the "orientative, non-blocking" design (the badge is the persistent signal), so it is acceptable — flagging only so the divergence-signal surface is intentional and not an oversight.

**Fix:** No change required if the badge is considered the source of truth. If desired, also surface the divergence near the driver Voltagem select (reuse the same `temDivergencia` expression) so the warning is co-located with the control that changes it.

### IN-02: Voltage pre-filter `.or()` may interact with the search `.or()` on the same query

**File:** `src/hooks/useProdutoSearch.ts:33-39`
**Issue:** When `filtro === 'driver'` with `filtroVoltagem` set AND the user types a search of length ≥ 2, the builder chains two separate `.or(...)` calls (voltage `or`, then search `or`). PostgREST combines top-level filters with AND, so this yields `(tensao=v OR tensao IS NULL) AND (codigo ilike OR descricao ilike)` — which is the intended semantics. This works today, but stacking multiple `.or()` calls is easy to misread and a future third `.or()` would silently AND-chain in a way that surprises. No bug now; noting for maintainability.

**Fix:** Optional — add a short comment that the two `.or()` blocks are AND-combined by PostgREST, or compose explicitly. No functional change needed.

### IN-03: Suggested-driver query lacks a tie-break / `is_baby` and perfil-restriction awareness

**File:** `src/components/AmbienteCard.tsx:133-146`
**Issue:** `buscarDriverSugerido` picks the lowest-wattage driver `>= consumoEstimado` for the voltage, ordered by `potencia_watts` ascending, `limit(1)`. It does not consider the perfil's `driver_restr_tipo` (`slim`) or `driver_restr_max_w` that the manual driver-select branch *does* enforce (lines 250-263). So the auto-suggestion can pre-fill a driver that the perfil would physically reject, and that rejection only surfaces if the user re-selects the driver manually. Since the suggestion only fires when the driver slot is empty (`driverVazio`) and is a convenience pre-fill (user can still override), this is low severity. Also, ties at equal wattage resolve non-deterministically (no secondary `order`).

**Fix:** When `sis.perfil` has restrictions, pass them into `buscarDriverSugerido` and add `.eq('subtipo','slim')` / `.lte('potencia_watts', driver_restr_max_w)` accordingly; add a secondary `.order('codigo')` for deterministic tie-break.

---

_Reviewed: 2026-06-11T06:12:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
