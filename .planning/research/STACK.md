# Technology Stack — v1.2 Composite/Modular Systems

**Project:** AURA — Luminatti budget wizard
**Researched:** 2026-06-10
**Milestone scope:** v1.2 — Sistemas compostos (modular profiles + magnetic tracks with modules, required drivers, connectors)
**Confidence:** HIGH — conclusions drawn entirely from reading the actual codebase; no speculation about external libraries needed.

---

## Verdict: No new libraries required.

Every capability needed for composite/modular system support already exists in the stack.
The work is purely **TypeScript type extensions + additive schema migrations + React component logic**.

---

## Existing Stack (do not re-research)

| Layer | Technology | Version |
|-------|-----------|---------|
| UI | React + Vite + TypeScript | 18.3.1 / 5.4.19 / 5.8.3 |
| Components | shadcn-ui (Radix UI) + Tailwind CSS | 1.x / 3.4.17 |
| Server state | TanStack React Query | 5.83.0 |
| Forms | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| Backend | Supabase (auth + Postgres + edge functions + storage) | JS SDK 2.95.3 |
| PDF | html2pdf.js | 0.14.0 |
| Domain logic | src/types/orcamento.ts (pure TypeScript functions) | — |

---

## What the New Capability Needs

### 1. Domain model extension (TypeScript only — no new lib)

**Current gap:** `SistemaIluminacao` only supports the `fita + perfil + driver` topology.
Modular profiles (e.g., SYSTEM MOLD diffuse modules) and magnetic tracks (MAGNETO 48V, TINY MAGNETO 24V) have a different assembly: `trilho/perfil + N módulos (ItemLuminaria[]) + 1 required driver + optional connectors/kits`.

**Solution:** Add a discriminated union to `SistemaIluminacao` in `src/types/orcamento.ts`.

```typescript
// Extend (do NOT replace) existing SistemaIluminacao
export type TipoSistema = 'padrao' | 'modular' | 'magneto';

export interface SistemaModular extends SistemaIluminacaoBase {
  tipo: 'modular';
  modulos: ItemLuminaria[];          // diffuse modules, spots, etc.
  driver: ItemDriver;                // required, sized by total wattage
  perfil: ItemPerfil;                // modular profile rail (required for this type)
  componentes?: ItemLuminaria[];     // connectors, fixing kits (optional)
  metragemManual: null;
  passadasManual: 1;
}

export interface SistemaMagneto extends SistemaIluminacaoBase {
  tipo: 'magneto';
  trilho: ItemLuminaria;             // the track itself (MAGNETO or TINY MAGNETO)
  modulos: ItemLuminaria[];          // spots/modules mounted on track
  driver: ItemDriver;                // sized by potenciaTotalW * MARGEM_SEGURANCA_DRIVER
  componentes?: ItemLuminaria[];     // connectors, energy clips, fixing kits
  voltagem: 48 | 24;                // 48 for MAGNETO, 24 for TINY MAGNETO
}
```

The existing `SistemaIluminacao` interface gets a `tipo: 'padrao'` discriminant to form the union.
`analisarMagneto48V()` in orcamento.ts is partially correct but reads from `amb.luminarias` as a flat list — it needs to move to read from `SistemaMagneto` once migration is done.
All existing calculation functions (`calcularConsumoW`, `calcularQtdDrivers`, `calcularRolosPorGrupo`) already use pure TypeScript and are extended in-place; no new lib is needed.

### 2. Schema additions (Supabase Postgres — additive only)

The `produtos` table already has all necessary columns from migration `20260319000001_campos_tecnicos_produtos.sql`:
- `tipo_produto` with CHECK constraint (fita/driver/perfil/spot/acessorio/conector/suporte)
- `sistema` with CHECK constraint (padrao/tiny_magneto/magneto_48v/s_mode/trilha)
- `potencia_watts` for module power
- `familia_perfil` for compatibility lookup
- `regras_compatibilidade_perfil` table for per-family constraints

**What is missing in schema (needs new migration):**
- A `tipo_produto` value of `'modulo'` is not in the CHECK constraint — modular diffuse modules need classification. Currently they would fall through to `luminaria` filter in `useProdutoSearch`. Options: add `'modulo'` to the CHECK, or reuse `subtipo` to distinguish modules from standalone spots. Recommend adding `'modulo'` to CHECK constraint (additive, backward-compatible).
- The `produtos` table bug mentioned in the v1.2 scope — several products have incorrect `tipo_produto` (LM3475, LM3291, WALL WASHER, CANTONEIRA family). This is a data fix, not a schema change.
- The orcamento snapshot (JSONB in `orcamentos` table) will need to handle the new `SistemaMagneto`/`SistemaModular` shapes. Since snapshots are JSONB and the PDF router is already versioned (`pdf_template_version`), add a `schema_version` field or extend the version field — no new table needed.

### 3. Search / query hook (`useProdutoSearch.ts`)

**Current gap:** The `filtro` union type is `'fita' | 'driver' | 'perfil' | 'luminaria' | 'todos'`. The modular assembly UI will need to search for:
- `'modulo'` — diffuse modules for SYSTEM MOLD
- `'trilho'` — magnetic track rails

**Solution:** Extend `ProdutoFiltro` type and add corresponding `.eq('tipo_produto', 'modulo')` / `.eq('sistema', 'magneto_48v')` branches. No new hook, no new library — it is a one-line extension per filtro value.

### 4. Component logic (React — no new lib)

**Current state:** `AmbienteCard.tsx` already renders two tabs: "Luminárias" and "Sistemas". The magnetic track warnings in `handleSelectProdutoLuminaria` (lines ~81–95) already fire toasts for MAGNETO and TINY MAGNETO — but the user still adds components as flat `ItemLuminaria`, not as a structured `SistemaMagneto`.

**v1.2 change:** Add a third sub-type inside the Sistemas tab — or an additional wizard step inside `addSistema` — that lets the user choose `tipo: 'padrao' | 'modular' | 'magneto'` and renders the appropriate assembly form. All shadcn primitives needed (Select, Dialog, Input, Badge, Tabs) are already installed and used extensively.

The `ValidacaoPanel` + `useValidarSistemas` hook pair already calls the `validar-sistema-orcamento` edge function. That edge function will need updating to understand the new types — but this is Deno/TypeScript, no new runtime needed.

---

## Do NOT Add

| Library | Why not |
|---------|---------|
| Any state management lib (Zustand, Redux, Jotai) | useState + prop drilling handles wizard state adequately; composite system adds complexity but not a fundamentally new state surface |
| React DnD / drag-and-drop | Module ordering within a track is not a v1.2 requirement; avoid premature DX investment |
| Any form builder beyond React Hook Form + Zod | The assembly form is a finite set of selects + numeric inputs; existing RHF patterns suffice |
| Any diagram / visual layout library | Track/module arrangement is textual in v1.2 |
| Any new Supabase edge function for composite assembly | Calculation stays client-side in orcamento.ts; only `validar-sistema-orcamento` needs extension, not replacement |
| Any new database tables for assembly templates | JSONB snapshot in `orcamentos` is sufficient; template reuse ("duplicar sistema") is a clone operation on the in-memory state |
| GraphQL / REST abstraction layer | Direct Supabase SDK calls are the established pattern; do not introduce a new data access layer |
| lodash / ramda / fp utilities | Pure TypeScript functions in orcamento.ts have no complex data pipeline needs; all grouping/reduction is done with Map + Array.reduce |

---

## Integration Points with Existing Stack

| Existing artifact | v1.2 change | Nature |
|-------------------|-------------|--------|
| `src/types/orcamento.ts` | Add `SistemaModular`, `SistemaMagneto` interfaces + discriminated union; extend `calcularConsumoW` / `calcularQtdDrivers` overloads | TypeScript extension |
| `src/hooks/useProdutoSearch.ts` | Extend `ProdutoFiltro` with `'modulo'` and `'trilho'`; add query branches | Trivial additive |
| `src/components/AmbienteCard.tsx` | Assembly UI for modular/magneto tipo; currently flat `ItemLuminaria` for these | Component logic only |
| `supabase/migrations/` | Add `'modulo'` to `check_tipo_produto` constraint; data-fix script for mis-classified products | One migration |
| `supabase/functions/validar-sistema-orcamento/` | Handle `SistemaModular` and `SistemaMagneto` shapes in validation | Deno/TypeScript extension |
| `src/lib/gerarPdfHtml.ts` | Render composite system summary in PDF (modulos list, driver, components) | Pure TypeScript |
| `analisarMagneto48V()` in orcamento.ts | Currently reads `amb.luminarias` flat; should read from `SistemaMagneto` after migration | Refactor in orcamento.ts |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| No new libraries needed | HIGH | Read all relevant source files; every needed primitive exists |
| Schema gap (`'modulo'` tipo) | HIGH | Read migration 20260319000001; CHECK constraint listed; `'modulo'` absent |
| `useProdutoSearch` extension is trivial | HIGH | Hook is 49 lines; adding a filtro branch is mechanical |
| Edge function needs updating | HIGH | `validar-sistema-orcamento` validates system shapes; new shapes break validation |
| Discriminated union approach is correct | HIGH | `SistemaIluminacao` is already an interface with optional `perfil: null` — it has natural extension seams |
| Snapshot backwards-compat is safe | HIGH | JSONB + pdf_template_version pattern already handles v1/v2; adding v3 shape is established |

---

## Sources

- `src/types/orcamento.ts` — domain model + calculation functions (read in full)
- `src/hooks/useProdutoSearch.ts` — Supabase query + filtro logic (read in full)
- `src/components/AmbienteCard.tsx` — wizard assembly UI (read lines 1–100)
- `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql` — produtos column/constraint definitions
- `supabase/migrations/20260319000002_regras_compatibilidade_perfil.sql` — compatibility rules table
- `.planning/PROJECT.md` — v1.2 scope, constraints, existing decisions
- `.planning/notes/motor-calculo-led-spec.md` — calculation engine spec (Marco 3; out of scope for v1.2 but informs what NOT to change in orcamento.ts)
- `.planning/codebase/ARCHITECTURE.md` — layer map
