# Domain Pitfalls — AURA v1.2 (Sistemas de Iluminação)

**Domain:** Production lighting-quote wizard with live jsonb snapshots and PDF backward-compat
**Researched:** 2026-06-10
**Scope:** Pitfalls specific to adding composite/modular systems, recategorizing product data, voltage rule changes, and calculation logic fixes to a system with real data in `orcamentos.ambientes jsonb` and a v1/v2 PDF router.

---

## Critical Pitfalls

Mistakes that cause rewrites, wrong client-facing prices, or silent data corruption in prod.

---

### Pitfall C-1: tipo_produto UPDATE Breaks the Selector Filter Without Touching the Snapshot

**What goes wrong:**
`useProdutoSearch` filters with `queryBuilder.eq('tipo_produto', filtro)` for `'fita' | 'driver' | 'perfil'`. When a product currently categorized as `null` or `'spot'` (e.g., LM3475, LM3291, WALL WASHER family, CANTONEIRA) is corrected to `'perfil'` or `'driver'`, all *new* quotes see it correctly. But the snapshot in `orcamentos.ambientes` (jsonb) was written at PDF-generation time and contains the **literal object fields** of the item — not a foreign-key back to `produtos`. So old quotes are fine. The danger runs in the other direction: if a product already in active wizard sessions (in-memory React state) has its `tipo_produto` changed *while the user is mid-draft*, a page reload will re-fetch the product with the new type, but the wizard holds the stale in-memory version. This is a minor transient issue, not silent corruption.

The truly critical variant: if you fix `tipo_produto` for a code that is **already a component of a saved rascunho snapshot**, the next time Step 3 opens that rascunho it re-reads `ambientes` from the jsonb column directly — which does NOT re-fetch from `produtos`. The snapshot is self-contained. So recategorizing never retroactively "fixes" the product type inside old snapshots, but it also never breaks them.

**Why it happens:**
Snapshots store denormalized objects (full `ItemPerfil`, `ItemFitaLED`, `ItemDriver` shapes), not product IDs. The calculation functions operate on the in-memory types, not on the DB row.

**Consequences:**
- None for already-saved quotes (intentional design, per v1.1 decision log).
- Selectors fix immediately for new quotes after migration runs.
- If the admin runs an UPDATE and a collaborator has the same tab open with a half-assembled system, they may see a mismatch until they refresh.

**Prevention:**
- Run `UPDATE produtos SET tipo_produto = 'perfil' WHERE ...` as a migration (not a one-off admin panel click) so it's tracked and repeatable.
- Add a migration comment listing each affected SKU family so future devs know what was intentionally recategorized.
- Do NOT add a NOT NULL constraint on `tipo_produto` in this migration — there are unknown products in prod that may legitimately be `null`.
- Verify the `check_tipo_produto` constraint already in place allows the target values; `'wall_washer'` is NOT in the enum (`'fita','driver','perfil','spot','lampada','acessorio','conector','suporte'`). Wall Washer products must be mapped to `'perfil'` (or a new enum value, but adding to the constraint is its own migration).

**Detection:**
- After migration: query `SELECT codigo, tipo_produto FROM produtos WHERE familia_perfil IS NOT NULL AND tipo_produto != 'perfil'` — should return 0 rows.
- Smoke: open selector with `filtro='perfil'`, type "WALL WASHER" — must appear.

**Phase:** Phase 14 (Catalog & Search fix) — data migration only, no TS changes.

---

### Pitfall C-2: Composite System Shape Written Into Snapshots Without a Backward-Compat Guard

**What goes wrong:**
`SistemaIluminacao` currently has a fixed shape: `{ id, perfil, fita, driver, metragemManual, passadasManual, local }`. When you add composite/modular and magneto-track systems, there are two design choices:
  1. Extend `SistemaIluminacao` with optional new fields (`modulos?: ItemModulo[]`, `conectores?: ItemAcessorio[]`, `tipo_sistema?: 'padrao' | 'modular' | 'magneto_trilha'`).
  2. Model composite systems as a separate type or a discriminated union.

If you go with option 1 (the least-disruption path), every place that reads a snapshot will encounter old rows where the new fields are absent. The problem is not reading — TypeScript optional fields handle that. The problem is **calculation functions that implicitly assume the current shape**. Specifically:
- `calcularDemandaFita` checks `if ('fita' in arg)` — that guard still works.
- `isSistemaVazio` in `pdfTemplates/v2.ts` checks `calcularDemandaFita === 0 && calcularConsumoW === 0 && calcularQtdDrivers === 0`. A modular-track system with `fita.wm = 0` (because modules drive themselves) will always look "vazio" and be silently filtered out of the PDF.

The magneto `analisarMagneto48V` function reads `amb.luminarias`, not `amb.sistemas` — it treats magneto modules as luminarias with `sistema === 'magneto_48v'`. If you migrate magneto to `SistemaIluminacao`, you break that function without obviously knowing it.

**Why it happens:**
The domain model was built assuming the only "system" shape is fita + driver + optional perfil. Modular and magnetic-track composites violate that assumption.

**Consequences:**
- Modular systems silently omitted from PDF (invisible to client).
- `calcularTotalGeral` undercounts because `calcularSubtotalSistemaSemFita` skips modular components that aren't in `perfil | fita | driver`.
- `calcularRolosPorGrupo` produces wrong fita deduplication if modular systems have a nominal fita entry with incorrect `wm`.

**Prevention:**
- Before writing a single new type, document the 5 places that iterate `amb.sistemas` and must be updated together: `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita`, `isSistemaVazio` in v2.ts.
- Add `tipo_sistema?: 'padrao' | 'modular' | 'magneto_trilha' | 'tiny'` as an optional field — default `'padrao'`. Any code that doesn't check this field continues to work correctly on old snapshots (they have no `tipo_sistema`, treated as `'padrao'`).
- `isSistemaVazio` must be patched to: if `tipo_sistema !== 'padrao'` and the system has at least one module/component, not vazio.
- Keep `analisarMagneto48V` reading from `luminarias` until a conscious migration decision is made — do not silently repurpose it.

**Detection:**
- Generate a PDF from a modular system before shipping — check that the system block appears and has a non-zero subtotal.
- Regression: generate a PDF from an old v1 snapshot (no `tipo_sistema`) — must still render identically.

**Phase:** Phase 15 (Composite/Modular Systems) — must be addressed before any composite system is saveable.

---

### Pitfall C-3: metragemManual=null + perfil=null Produces 0m → R$0 Fita Subtotal Already in Prod

**What goes wrong:**
`calcularDemandaFita(sistema)` on line 134 returns `(sis.metragemManual || 0) * (sis.passadasManual || 1)`. When `perfil` is null and `metragemManual` is null (the current default in `addSistema()`), the result is `0`. This means `calcularConsumoW = 0`, `calcularQtdDrivers = 0`, and `calcularTotalFitasGlobal = 0` for any system without a perfil where the user forgot to set `metragemManual`. These systems also pass `isSistemaVazio` check (all zeros) and are silently dropped from the PDF.

The fix is straightforward (require a non-null `metragemManual` when `perfil` is null, enforced in the UI), but it has snapshot implications: old saved snapshots in prod may have `metragemManual: null` + `perfil: null` legitimately (user never set a length). Re-opening such a rascunho will not retroactively compute a metragem — the snapshot will still show 0 unless the user edits it.

**Why it happens:**
`addSistema()` initializes `metragemManual: null` (correct — the placeholder state). The UI does not enforce that the user fills it before advancing to Step 3.

**Consequences:**
- System present in Step 2 but contributes R$0 in Step 3 and is absent from PDF.
- No validation error shown — the user may submit an underpriced quote.

**Prevention:**
- Add a guard in Step 3 (or at `handleNext` in Step 2): if any `sistema` has `perfil === null && (metragemManual == null || metragemManual <= 0)`, show a warning toast and block advancement.
- Do NOT change `addSistema()` defaults — leaving `metragemManual: null` is the correct empty state.
- For saved rascunhos with this state: the validation warning in Step 3 will surface them when re-opened — no silent data fix needed.

**Detection:**
- Unit test: `calcularDemandaFita({ perfil: null, metragemManual: null, passadasManual: 1, ... })` must return 0. Document this is intentional for the empty state, but the UI guard prevents it reaching Step 3 unblocked.

**Phase:** Phase 16 (Calculation/Accounting fixes).

---

### Pitfall C-4: Voltage Block Between Ambientes Silently Persists After the Per-Ambiente Fix

**What goes wrong:**
Today the voltage validation in `handleSelectProdutoSistema` (AmbienteCard.tsx lines 137-154) is a per-sistema check: if `produto.voltagem !== sis.fita.voltagem`, reject with toast. This is correct behavior. The UAT complaint is about a *cross-ambiente* link — the fact that selecting a product in Ambiente B seems to get blocked by the voltage state of a system in Ambiente A. This cross-ambiente interference is almost certainly not in the code reviewed here (each `AmbienteCard` receives its own `ambiente` prop and checks only `sis.fita.voltagem` within that ambiente). The reported bug is more likely that `calcularDriversPorProjeto` **groups drivers across ambientes by driver.codigo** (orcamento.ts lines 288-342). If two ambientes use the same driver code but different tape voltages, the global driver summary will aggregate them as if they're the same circuit, potentially underounting drivers.

**Why it happens:**
`calcularDriversPorProjeto` groups by `sis.driver.codigo` only, not by `(codigo, voltagem)` tuple. Two ambientes could theoretically have the same driver SKU driving different-voltage tapes — which is impossible physically but not blocked by the UI per-sistema check.

**Consequences:**
- Global driver summary undercounts if same driver code is used at different voltages across ambientes (edge case, but not impossible after the per-ambiente voltage unblocking feature).
- PDF driver summary row shows a combined wattage that's physically nonsensical.

**Prevention:**
- When implementing "different voltage per ambiente", change the grouping key in `calcularDriversPorProjeto` from `sis.driver.codigo` to `${sis.driver.codigo}::${sis.driver.voltagem}` as a safety measure.
- The per-ambiente voltage unblocking itself is just removing a global state check — there is no global state here; the cross-ambiente block the UAT team reported should be reproduced and isolated to its actual code path before implementing the fix.

**Detection:**
- Create two ambientes, both using the same driver code, one at 24V and one at 12V — verify the global driver summary shows 2 distinct lines, not one aggregated line.

**Phase:** Phase 17 (Voltage/Validation fixes).

---

### Pitfall C-5: passadasManual Not Validated Against New 3-Passadas Rule for 50mm Profile After Snapshot Is Saved

**What goes wrong:**
`SistemaIluminacao.passadasManual` is typed `1 | 2 | 3`. When `perfil` is set, `passadas` comes from `ItemPerfil.passadas` which also is `1 | 2 | 3`. The new rule is: `familia_perfil = 'light_50'` (the 50mm family) allows up to 3 passadas, and `passadas_padrao = 3` is already in `regras_compatibilidade_perfil` seed. The current code sets `passadasAuto = (produto.passadas ?? base.passadas) as 1 | 2 | 3` on product select. So the auto-assignment already works correctly — the issue is that the `passadas_padrao` value in `regras_compatibilidade_perfil` must match the value in `produtos.passadas_padrao` for `light_50` products, and both must be 3.

If a `light_50` product has `passadas_padrao = 1` in the `produtos` table (due to incorrect import data), the auto-assignment will default to 1, the user won't know to change it, and the fita demand will be 1/3 of what it should be.

**Why it happens:**
The seed in `20260319000002` has `light_50 passadas_padrao = 3` but the `produtos` rows for those SKUs may have been imported with `passadas_padrao = 1` (the column default). There's no FK between `produtos.familia_perfil` + `produtos.passadas_padrao` and `regras_compatibilidade_perfil` — they're two independent sources of truth.

**Consequences:**
- Fita demand underestimated by 3x for light_50 profiles.
- Quote prices significantly lower than cost.

**Prevention:**
- Add a migration that syncs `passadas_padrao` from `regras_compatibilidade_perfil` to `produtos` for all rows where `familia_perfil` matches: `UPDATE produtos p SET passadas_padrao = r.passadas_padrao FROM regras_compatibilidade_perfil r WHERE p.familia_perfil = r.familia_perfil`.
- Run this sync in the same migration that unlocks passadas in the UI (Phase 18).

**Detection:**
- Query: `SELECT p.codigo, p.familia_perfil, p.passadas_padrao, r.passadas_padrao AS regra FROM produtos p JOIN regras_compatibilidade_perfil r ON p.familia_perfil = r.familia_perfil WHERE p.passadas_padrao != r.passadas_padrao`.

**Phase:** Phase 18 (passadas + metragem fixes) — sync migration must run before UI unlocking.

---

## Moderate Pitfalls

---

### Pitfall M-1: PDF v2 rowFita Shows "— global —" Subtotal Even When metragemManual Is Used

**What goes wrong:**
`rowFita` in `pdfTemplates/v2.ts` always shows `"— global —"` in the subtotal cell and says `qty = demanda m`. This is correct for the global fita rollup model. But the UAT complaint about "fita duplicated in per-ambiente AND global summary" is about Step 3's UI rendering (React table), not the PDF. The PDF v2 template itself is fine — it intentionally shows fita as a per-system line but marks it global. The Step 3 React render shows a per-ambiente systems table AND a global `calcularRolosPorGrupo` table. If both show fita, that's a UI dedup issue in the JSX, not in the PDF generator.

Fixing the Step 3 React render to not double-show fita must not touch the PDF v2 rowFita function — they're separate code paths.

**Prevention:**
- In Step 3 JSX: suppress the per-sistema fita line item from the per-ambiente breakdown table (or clearly label it "ver resumo global"), keep the global summary table as the single source of fita pricing.
- Do not modify `rowFita` in v2.ts to suppress the "— global —" marker without also updating the PDF fita summary section — they're co-dependent.

**Phase:** Phase 19 (Summary/UX fixes).

---

### Pitfall M-2: buildAtributosMap in gerarPdfHtml Doesn't Know About New Composite System Component Codes

**What goes wrong:**
`buildAtributosMap` (gerarPdfHtml.ts lines 43-68) collects codes from `amb.luminarias`, `sis.fita`, `sis.driver`, `sis.perfil`. If composite systems add new component arrays (e.g., `modulos`, `conectores`) to `SistemaIluminacao`, these codes won't be collected for the atributos batch lookup. Those components will render with bare descriptions in the PDF (no rich `4000K | 12W | IRC 90` suffix).

**Prevention:**
- When adding new component arrays to `SistemaIluminacao`, update `buildAtributosMap` and the `allCodigos` memo in `Step3Revisao` in the same PR. These two places must always be in sync.
- Write a unit test: given a `SistemaIluminacao` with `modulos: [{ codigo: 'X' }]`, assert that `buildAtributosMap` returns a map including key `'X'`.

**Phase:** Phase 15 (Composite Systems) — update alongside new type definition.

---

### Pitfall M-3: MAGNETO/TINY Warning Logic Hardcodes Codes That May Be Recategorized

**What goes wrong:**
`analisarMagneto48V` (orcamento.ts line 262) hardcodes `LM2343`, `LM2344`, `LM2338` to check for driver/connector presence. `AmbienteCard.tsx` line 83 hardcodes `sistema_magnetico === 'magneto_48v'` and regex `MAGNETO22`. If the UAT-reported magneto/tiny tip swap is because the `sistema` column in `produtos` is wrong for some SKUs, fixing the column data without auditing these hardcoded checks will cause the warnings to fire incorrectly (e.g., tiny showing a 48V warning).

**Prevention:**
- Before recategorizing any product's `sistema` column, audit every hardcoded code reference in: `analisarMagneto48V`, `handleSelectProdutoLuminaria` in AmbienteCard, and `handleSelectProdutoSistema`.
- If a SKU was previously classified `magneto_48v` and is being changed to `tiny_magneto`, the check `produto.sistema_magnetico === 'magneto_48v'` (which reads from the DB column at product-select time) will automatically update. But the regex checks (`/MAGNETO22/`, `/TINY\s+MAG/`) are pattern-based and won't break — they're defensive.

**Phase:** Phase 14 (Catalog & Search) — audit at the same time as data migration.

---

### Pitfall M-4: Snapshot Opened as Rascunho Has Stale metragemRolo on ItemFitaLED

**What goes wrong:**
`ItemFitaLED.metragemRolo` is `5 | 10 | 15` and is used by `calcularRolosPorGrupo` to determine fita roll grouping. This value is denormalized into the snapshot at wizard-time (from `useProdutoSearch`, which maps `tamanho_rolo_m` from the DB). If an admin later changes the rolo size for a fita product in the `produtos` table (e.g., a supplier changes the standard roll), re-opening an old rascunho will still compute rolls using the snapshot's stale `metragemRolo`. This is correct behavior per the backward-compat constraint — but it means the "fix metragem" work in v1.2 cannot assume `metragemRolo` is always current.

**Prevention:**
- No action needed — this is a deliberate trade-off (snapshot = point-in-time). Document it explicitly in any new calculation logic comments.
- Do NOT add a `reFetchProductData` step when re-opening rascunhos without explicit user confirmation.

**Phase:** Awareness only — not a fix, a constraint to respect in Phase 18.

---

## Minor Pitfalls

---

### Pitfall N-1: LOCAL Field in Summary Requires sistemas to Always Have local Set

**What goes wrong:**
The `local` field on `SistemaIluminacao` is `string | null | undefined`. `agruparPorLocal` in v2.ts treats `null/undefined/""` as `null` (groups under implied "Geral"). The UAT request to show LOCAL in the global fita/driver summary requires reading `sis.local` at the point where `calcularRolosPorGrupo` aggregates — but that function doesn't track per-local breakdowns, only per-fita-codigo. Adding LOCAL to the fita summary means changing the grouping key or adding a parallel structure.

**Prevention:**
- Decide: is the LOCAL display in the fita summary a visual annotation (show which ambientes/locais use this fita) or a separate accounting (separate subtotals per local)? The former is additive and safe; the latter requires a new calculation function.
- The grouping function change is isolated to `calcularRolosPorGrupo` — it doesn't affect snapshots.

**Phase:** Phase 19 (Summary/UX).

---

### Pitfall N-2: The check_tipo_produto Constraint Doesn't Include 'wall_washer' or 'driver' Subtypes

**What goes wrong:**
The DB constraint `check_tipo_produto` allows: `'fita','driver','perfil','spot','lampada','acessorio','conector','suporte'`. The catalog fix involves setting `tipo_produto = 'perfil'` for WALL WASHER and CANTONEIRA families. This is valid — those are profiles. But CANTONEIRA might have subtypes that don't exist in `check_sistema`. The `sistema` column check allows: `'padrao','tiny_magneto','magneto_48v','s_mode','trilha'`. A new system type added for modular/composite would need a migration to extend this constraint before any product row can be updated to use it.

**Prevention:**
- Any time you add a new `tipo_sistema` enum value to the TypeScript types, add a corresponding `ALTER TABLE produtos DROP CONSTRAINT check_sistema; ALTER TABLE produtos ADD CONSTRAINT check_sistema CHECK (...)` in the same migration.
- The same applies to `check_tipo_produto` if a truly new category is needed.

**Phase:** Phase 14 for catalog fixes; Phase 15 if composite systems need a new `sistema` value.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 14 — Catalog & Search (tipo_produto fixes) | C-1: constraint doesn't include existing type values for all affected SKUs | Audit constraint before UPDATE; check 'wall_washer' is not a valid tipo_produto value |
| Phase 14 — Catalog & Search (tipo_produto fixes) | M-3: hardcoded magneto/tiny code references diverge from corrected sistema column | Audit AmbienteCard + analisarMagneto48V before data migration |
| Phase 15 — Composite/Modular Systems | C-2: new sistema shape breaks isSistemaVazio and calcularSubtotalSistemaSemFita | Patch all 5 calculation sites in the same PR as the new type |
| Phase 15 — Composite/Modular Systems | M-2: buildAtributosMap misses new component codes | Update both buildAtributosMap and allCodigos memo in Step3 in same PR |
| Phase 16 — Metragem Without Perfil | C-3: metragemManual=null → 0m silently skips PDF block | Add Step 2 advancement guard before fixing calculation defaults |
| Phase 17 — Voltage Per Ambiente | C-4: calcularDriversPorProjeto groups by codigo only, not (codigo, voltagem) | Change grouping key before unblocking cross-ambiente voltage |
| Phase 18 — Passadas + Metragem | C-5: produtos.passadas_padrao diverges from regras_compatibilidade_perfil | Run sync migration before unlocking passadas in UI |
| Phase 19 — Summary/UX | M-1: Step 3 JSX fita dedup fix must not touch pdfTemplates/v2.ts rowFita | Separate JSX changes from PDF template changes; test PDF regression after |
| Phase 19 — Summary/UX | N-1: LOCAL in fita summary requires new grouping logic, not just a display tweak | Decide accounting vs annotation before coding |

---

## Sources

- Direct code review: `src/types/orcamento.ts`, `src/hooks/useProdutoSearch.ts`, `src/components/AmbienteCard.tsx`, `src/components/Step3Revisao.tsx`, `src/lib/gerarPdfHtml.ts`, `src/lib/pdfTemplates/v2.ts`, `src/lib/produtoDescricao.ts`
- Migration audit: `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql`, `20260319000002_regras_compatibilidade_perfil.sql`, `20260416000001_orcamentos_ambientes_tipo.sql`
- Project context: `.planning/PROJECT.md` (v1.0/v1.1 decision log, additive-schema constraint, PDF v1/v2 router rationale)
- Confidence: HIGH — all pitfalls derived from direct source code inspection, not assumptions.
