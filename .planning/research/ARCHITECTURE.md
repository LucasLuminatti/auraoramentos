# Architecture Research

**Domain:** Composite/modular lighting systems integration into existing budget wizard
**Researched:** 2026-06-10
**Confidence:** HIGH — based on direct codebase reading of all relevant files

---

## Context

This research answers one focused question: how should composite/modular systems (magnetic track, Tiny Mag, profile+modules) integrate into the AURA v1.2 architecture without breaking the existing wizard, old snapshots, or the PDF v1/v2 router.

The existing model is:

```
Orcamento
  └── Ambiente[]
        ├── luminarias: ItemLuminaria[]      (flat fixtures, entered as-is)
        └── sistemas: SistemaIluminacao[]    (fita + driver + optional perfil)
```

Composite systems today are entered as flat `ItemLuminaria` rows (trilho magnético, módulos, drivers, conectores — all as separate luminária lines). The UAT feedback asks for a guided composition flow instead.

---

## (a) Data Model: Compatibility / Composition

### Current schema surface relevant to composites

`product_variants` (via view `produtos`) already has:
- `tipo_produto` TEXT — values: `'fita' | 'driver' | 'perfil' | 'spot' | 'lampada' | 'acessorio' | 'conector' | 'suporte'`
- `sistema` TEXT — values: `'padrao' | 'tiny_magneto' | 'magneto_48v' | 's_mode' | 'trilha'`
- `subtipo` TEXT — driver subtypes (`'slim' | 'convencional' | 'magnetico'`), fita subtypes (`'baby'`)
- `tensao` INTEGER — 12/24/48V
- `potencia_watts` NUMERIC — individual module wattage
- `familia_perfil` TEXT — rail family grouping
- `driver_max_watts` / `driver_tipo_permitido` — perfil constraints (already used by wizard)
- `atributos` JSONB — rich specs, free-form

### The categorization bug

Several products are invisible in the perfil/driver selector because their `tipo_produto` is wrong or NULL. Specific examples from UAT feedback:
- LM3475 (driver magnético Tiny Mag) — wrong `tipo_produto`, doesn't appear in driver selector
- LM3291 — missing from search
- WALL WASHER family — `tipo_produto` mismatch
- CANTONEIRA family — incomplete `tipo_produto` assignment

Root cause: `useProdutoSearch` filters strictly by `tipo_produto`:
```typescript
queryBuilder.eq('tipo_produto', filtro)  // 'fita' | 'driver' | 'perfil'
```
If a driver has `tipo_produto = NULL` or `tipo_produto = 'acessorio'`, it never appears.

### Recommended fix: additive, no new columns needed

The categorization problem does NOT require schema changes. `tipo_produto` and `sistema` columns already exist. The fix is a targeted data UPDATE migration:

```sql
-- Migration: fix tipo_produto for composite system components
UPDATE product_variants
SET tipo_produto = 'driver'
WHERE codigo IN ('LM3475', ...) AND tipo_produto IS NULL OR tipo_produto != 'driver';

UPDATE product_variants
SET tipo_produto = 'perfil', sistema = 'tiny_magneto'
WHERE descricao ILIKE '%TINY%TRILHO%' AND tipo_produto IS NULL;

-- etc. for each misclassified family
```

This migration must be written per-family after an admin audits the affected SKUs. It is a pure data correction — no schema change, no code change. Do this FIRST because it unblocks all subsequent UI work.

### Modeling composition relationships

**Question:** new table vs atributos jsonb vs relationship table?

**Recommendation: `produto_composicao` relationship table (additive).**

Rationale: the core need is "which modules/connectors/drivers are valid for a given rail/profile/track". This is a many-to-many relationship with a role (e.g., `'modulo' | 'driver_recomendado' | 'conector_energia' | 'kit_fixacao'`). Encoding this in `atributos` JSONB works for display but makes querying and validation unreliable — you'd need jsonb operators to find compatible drivers, which is fragile and slow.

A dedicated table is clean, additive, and queryable:

```sql
CREATE TABLE public.produto_composicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pai_codigo TEXT NOT NULL REFERENCES public.product_variants(codigo),
  filho_codigo TEXT NOT NULL REFERENCES public.product_variants(codigo),
  papel TEXT NOT NULL CHECK (papel IN (
    'modulo', 'driver_recomendado', 'driver_obrigatorio',
    'conector_energia', 'kit_fixacao', 'acessorio_opcional'
  )),
  ordem INTEGER NOT NULL DEFAULT 0,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pai_codigo, filho_codigo, papel)
);

CREATE INDEX idx_composicao_pai ON public.produto_composicao(pai_codigo);
CREATE INDEX idx_composicao_filho ON public.produto_composicao(filho_codigo);

-- RLS: leitura para todos autenticados, escrita só admin
ALTER TABLE public.produto_composicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read composicao" ON public.produto_composicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin composicao" ON public.produto_composicao FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

For v1.2, the table starts empty — the wizard uses it for suggestions and validation warnings but the user can still override. The admin can populate it via a simple UI or CSV import later. This avoids blocking the wizard implementation on data completeness.

**What does NOT need a new table:**

Driver voltage validation (fita.tensao == driver.tensao) is already implemented in `AmbienteCard.tsx`. Perfil baby-only / driver-slim constraints use existing columns (`somente_baby`, `driver_tipo_permitido`). These need no schema changes.

---

## (b) Snapshot Representation Without Breaking Old Snapshots

### How snapshots work today

`orcamentos.ambientes` is a JSONB column storing `Ambiente[]` verbatim. When the PDF is re-rendered (in `OrcamentoDetalhe`), it reads the snapshot and routes to v1 or v2 template via `pdf_template_version`.

Old snapshots have `luminarias` with magnetic-track items as flat `ItemLuminaria` rows (with `sistema: 'magneto_48v'` field). New snapshots can have a richer structure. The v1/v2 router already handles this — v1 just renders whatever it finds in `luminarias`.

### Recommended representation for composite systems

Do NOT change the `Ambiente` interface's top-level shape (`luminarias[]` and `sistemas[]`). Instead, extend `ItemLuminaria` to optionally carry a `composicao` sub-array:

```typescript
// ADDITIVE extension to ItemLuminaria — new optional field
export interface ItemLuminaria {
  // ... all existing fields unchanged ...
  composicao?: ItemComposicao[];   // only present when item is a composite root
}

export interface ItemComposicao {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
  papel: 'modulo' | 'driver_recomendado' | 'driver_obrigatorio' | 'conector_energia' | 'kit_fixacao' | 'acessorio_opcional';
  obrigatorio: boolean;
}
```

This is backward-compatible because:
1. Old snapshots have `composicao: undefined` — all existing code ignores unknown fields in TypeScript interfaces when reading JSONB (structural subtyping).
2. `calcularSubtotalLuminaria(item)` only uses `item.precoUnitario * item.quantidade` on the root item. Subtotals for sub-items need a new function but old code paths are untouched.
3. `analisarMagneto48V()` checks `amb.luminarias` — the root trilho entry still appears there, so the existing magneto analysis continues to work on old AND new snapshots.
4. PDF v2 template iterates `amb.luminarias` and calls `rowLuminaria()`. The new template version (v3, below) handles `composicao`, while v2 renders the root item only — acceptable fallback for the rare case where v2 receives a composite snapshot.

### PDF versioning

Introduce `pdf_template_version: 3` for orçamentos that contain composite systems. This follows the existing pattern:
- v1: legacy (pre-Phase 5)
- v2: current editorial (Phase 5+, all new orçamentos)
- v3: composites (Phase 14+, only when ambiente has at least one item with `composicao`)

The router in `gerarOrcamentoHtml` gains one branch:

```typescript
if (v >= 3) return gerarOrcamentoHtmlV3({ ...params, atributosMap });
if (v >= 2) return gerarOrcamentoHtmlV2({ ...params, atributosMap });
return gerarOrcamentoHtmlV1(params);
```

`Step3Revisao.persistirOrcamento()` sets `pdf_template_version: 3` only when `ambientes.some(a => a.luminarias.some(l => l.composicao?.length))`. Otherwise it stays 2. This means existing wizard flow is not touched.

---

## (c) Wizard Integration Points

### Option A: extend SistemaIluminacao
Adding a `modulosCompostos?: ItemComposicao[]` field to `SistemaIluminacao`. This would work for magnetic track that replaces the fita+perfil+driver trio, but it creates a conceptual mismatch: `SistemaIluminacao` models continuous tape, not discrete modules. Calcs like `calcularDemandaFita()` and `calcularRolosPorGrupo()` would need guard clauses everywhere.

### Option B: new item type in ItemLuminaria.composicao (recommended)

Composite/modular systems (trilho magnético + módulos + driver + conectores) enter as a **composite root `ItemLuminaria`** (the trilho/track itself) with child `composicao[]` items attached. The user experience is:

1. User adds a luminária as usual.
2. When the selected product has `sistema IN ('magneto_48v', 'tiny_magneto')` AND `tipo_produto = 'perfil'` (or similar track role), the UI detects it and offers "Adicionar componentes do sistema".
3. A `SistemaCompostoPanel` sub-component expands inline under the root item, showing slots for módulos, driver, and conector. Each slot is a `ProdutoAutocomplete` filtered appropriately.
4. Calc of the composite subtotal happens via a new function `calcularSubtotalComposicao(item: ItemLuminaria)`.

This keeps `sistemas[]` (fita+driver+perfil) untouched — composites live entirely in `luminarias[]`. The tab structure in `AmbienteCard` (Luminárias / Sistemas de Iluminação) is preserved.

### New components to build

| Component | Type | Parent | Purpose |
|-----------|------|--------|---------|
| `SistemaCompostoPanel` | new | `AmbienteCard` (inside luminária row) | Composite composition UI: add/remove sub-items per role |
| `useComposicaoSugestoes` | new hook | `SistemaCompostoPanel` | Fetches `produto_composicao` rows for a given `pai_codigo` |
| `ItemComposicao` type | extension | `src/types/orcamento.ts` | New interface (additive) |
| `calcularSubtotalComposicao` | new fn | `src/types/orcamento.ts` | Sum of `item.composicao[].precoUnitario * quantidade` |
| `calcularTotalAmbienteComposicao` | new fn | `src/types/orcamento.ts` | Includes composicao in ambiente total |

### Modified components (minimal changes)

| Component | Change | Risk |
|-----------|--------|------|
| `AmbienteCard.tsx` | Render `SistemaCompostoPanel` when `item.composicao` exists; detect composite root on product select | LOW — additive render path |
| `handleSelectProdutoLuminaria` | Detect track/trilho product, seed `item.composicao = []` | LOW — additive branch |
| `calcularTotalAmbienteSemFita` | Include `calcularSubtotalComposicao` for items with composicao | MEDIUM — change to global calc, must test |
| `violacoes` detection in `Step3Revisao` | Iterate `item.composicao` items for price violations | LOW — additive loop |
| `handleAjustarPreco` / `handleEditPrecoLuminaria` in `Step3Revisao` | Extend to handle `composicao` sub-items | LOW — new case in existing switch |
| `gerarOrcamentoHtml` router | Add `v >= 3` branch | LOW — follows existing pattern |
| `useProdutoSearch` `ProdutoFiltro` | Add `'modulo' | 'trilho' | 'conector_magnetico'` filtros | LOW — additive |

### Calculation layer changes (src/types/orcamento.ts)

The existing `calcularTotalAmbienteSemFita()` only sums `luminarias` subtotals and `sistemas` subtotals. It must include composite sub-items:

```typescript
export function calcularSubtotalComposicao(item: ItemLuminaria): number {
  if (!item.composicao?.length) return 0;
  return item.composicao.reduce((s, c) => s + c.precoUnitario * c.quantidade, 0);
}

// Modified (backward-compatible — if composicao undefined, returns 0):
export function calcularTotalAmbienteSemFita(amb: Ambiente): number {
  const totalLum = amb.luminarias.reduce(
    (s, i) => s + calcularSubtotalLuminaria(i) + calcularSubtotalComposicao(i), 0
  );
  const totalSistemas = amb.sistemas.reduce((s, sis) => s + calcularSubtotalSistemaSemFita(sis), 0);
  return totalLum + totalSistemas;
}
```

`analisarMagneto48V()` is already correct — it filters by `l.sistema === 'magneto_48v'` on root items. Composite sub-items (módulos) should also set `sistema = 'magneto_48v'` so the analysis still works. No change needed to this function.

`calcularDriversPorProjeto()` works on `amb.sistemas`. Magnetic track drivers are NOT in `sistemas` — they're in `luminarias[].composicao`. This is intentional: the existing global driver calc is for tape-LED drivers only. Magnetic track driver suggestions come from `analisarMagneto48V()` (already implemented) and the new `SistemaCompostoPanel`.

---

## (d) Build Order

### Phase 14: Data Categorization Fix (prerequisite, no UI changes)

1. Admin audits affected SKUs (LM3475, LM3291, WALL WASHER families, CANTONEIRA, Tiny Mag dica swap).
2. Write migration: `UPDATE product_variants SET tipo_produto = '...', sistema = '...' WHERE codigo IN (...)`.
3. Apply migration + verify products appear in correct selectors (can test immediately with existing search UI).
4. No frontend changes. Zero risk to existing wizard.

### Phase 15: Type Extensions + Calc Layer

1. Add `ItemComposicao` interface and `composicao?: ItemComposicao[]` to `ItemLuminaria` in `src/types/orcamento.ts`.
2. Add `calcularSubtotalComposicao()` function.
3. Modify `calcularTotalAmbienteSemFita()` to include composicao — backward-safe because `?.length` guard.
4. Add `produto_composicao` migration (table only, starts empty).
5. Add `ProdutoFiltro` variants (`'modulo'`, `'trilho_magnetico'`, `'conector_magnetico'`) to `useProdutoSearch`.
6. Write unit tests for `calcularSubtotalComposicao` and the updated `calcularTotalAmbienteSemFita`.

### Phase 16: Wizard UI — Composite Entry

1. Build `useComposicaoSugestoes(paiCodigo)` hook — queries `produto_composicao` table, returns grouped suggestions.
2. Build `SistemaCompostoPanel` component — expandable section under a luminária row showing roles (módulos, driver obrigatório, conector energia, acessórios opcionais) with ProdutoAutocomplete per slot.
3. Modify `handleSelectProdutoLuminaria` in `AmbienteCard`: when selected product is a composite root (detect via `sistema IN ('magneto_48v', 'tiny_magneto') AND tipo_produto = 'perfil'`), set `item.composicao = []` and auto-expand `SistemaCompostoPanel`.
4. Add composicao price-violation detection to `violacoes` in `Step3Revisao`.
5. Add composicao items to the revision table in `Step3Revisao`.

### Phase 17: PDF v3 Template

1. Build `src/lib/pdfTemplates/v3.ts` — extend v2 template with composite rendering (root item row + indented sub-item rows per `composicao`).
2. Add v3 branch to `gerarOrcamentoHtml` router.
3. Update `persistirOrcamento` in `Step3Revisao` to set `pdf_template_version: 3` when composites present.
4. Smoke test: orçamento sem compostos → v2 PDF unchanged; orçamento com compostos → v3 PDF renders sub-items.

---

## Component Boundaries Summary

```
src/types/orcamento.ts
  + ItemComposicao (new interface)
  + composicao?: ItemComposicao[]  on ItemLuminaria (additive)
  + calcularSubtotalComposicao()  (new function)
  ~ calcularTotalAmbienteSemFita() (modified, backward-safe)

src/hooks/useProdutoSearch.ts
  ~ ProdutoFiltro type (additive variants)
  + useComposicaoSugestoes() (new hook, separate file)

src/components/AmbienteCard.tsx
  ~ handleSelectProdutoLuminaria (additive branch for composite detection)
  + SistemaCompostoPanel (new sub-component, can be separate file)

src/components/Step3Revisao.tsx
  ~ violacoes useMemo (additive: iterate composicao)
  ~ revision table (additive: render composicao sub-rows)
  ~ handleAjustarPreco / edit handlers (additive: composicao sub-item case)
  ~ persistirOrcamento (additive: set version=3 when composicao present)

src/lib/gerarOrcamentoHtml.ts
  ~ router: + v >= 3 branch

src/lib/pdfTemplates/v3.ts  (new file)

supabase/migrations/
  + fix_tipo_produto_composites.sql   (Phase 14)
  + produto_composicao_table.sql       (Phase 15)
```

---

## Anti-Patterns to Avoid

### Composite as SistemaIluminacao extension

**What people do:** Add `modulosCompostos[]` to `SistemaIluminacao` and wire it into the fita+driver calc flow.

**Why wrong:** Composite/modular systems (discrete modules, magnetic track) don't have metragem or W/m concepts. `calcularDemandaFita`, `calcularConsumoW`, `calcularRolosPorGrupo` all become polluted with `if (isComposite) return 0` guards everywhere. PDF v2 template's `isSistemaVazio` check breaks. Old orçamentos that have `sistemas[]` don't have this field and forward-compat reads fail.

**Do instead:** Keep composites in `luminarias[]` via the `composicao` extension. `sistemas[]` stays clean for tape-LED only.

### Single global calc function change

**What people do:** Modify `calcularTotalGeral()` at the top level first.

**Why wrong:** `calcularTotalGeral` calls `calcularTotalAmbienteSemFita` which calls `calcularSubtotalLuminaria`. If you modify at the wrong level, you break the global fita + driver resumo calculations which depend on the same sub-tree.

**Do instead:** Add `calcularSubtotalComposicao()` as a leaf function, then modify only `calcularTotalAmbienteSemFita()` to include it. Leave `calcularTotalGeral()` and the fita/driver resumo functions untouched.

### Blocking on product_composicao data completeness

**What people do:** Wait until the table is populated with all compatibility relationships before building the UI.

**Why wrong:** The table starts empty and the UI still works — `useComposicaoSugestoes` returns [] and the user fills slots manually. Suggestions are an enhancement, not a gate.

**Do instead:** Build the UI with empty-table graceful fallback. Populate data incrementally.

### New snapshot field that breaks PDF v2

**What people do:** Add `composicao` to `SistemaIluminacao` and have `Step3Revisao` always set `pdf_template_version: 3`.

**Why wrong:** Every new orçamento would require the v3 template even when no composites are used. Orçamentos opened/re-saved from rascunho that were originally v2 would get version-bumped unintentionally.

**Do instead:** Set version 3 conditionally: `ambientes.some(a => a.luminarias.some(l => l.composicao?.length))`.

---

## Sources

- Direct code reading: `src/types/orcamento.ts`, `src/hooks/useProdutoSearch.ts`, `src/components/AmbienteCard.tsx`, `src/components/Step3Revisao.tsx`, `src/lib/gerarPdfHtml.ts`, `src/lib/pdfTemplates/v2.ts`
- Migrations: `20260319000001_campos_tecnicos_produtos.sql`, `20260501000001_products_and_variants.sql`
- Planning: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`
- Confidence: HIGH — all findings sourced from codebase, no external sources needed for integration decisions

---

*Architecture research for: AURA v1.2 composite systems integration*
*Researched: 2026-06-10*
