# Phase 18: UX Transversal - Research

**Researched:** 2026-06-12
**Domain:** React component UX — wizard additive improvements (redirect, microcopy, duplication, checklist)
**Confidence:** HIGH (all findings verified from live source code in this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01/D-02/D-03:** Redirect empty-state when luminária search returns nothing but code is `perfil`/`fita`/`driver`: show "Este produto é um {tipo} — adicione em Sistemas de Iluminação" + button "Ir para Sistemas de Iluminação". Do NOT auto-add the item.
- **D-04:** Detection requires a fallback Supabase query without the `tipo_produto` filter.
- **D-05:** Duplicate system: new UUID for all sub-items (`fita.id`, `driver.id`, `perfil?.id`, `sistema.id`), append `" (cópia)"` to `local` field. Button inside `AmbienteCard` sistema header.
- **D-06:** Duplicate ambiente: deep-clone entire `Ambiente` tree with new UUIDs everywhere, append `" (cópia)"` to `nome`. Button in `Step2Ambientes` (owner of ambientes array), passed via `onDuplicate` prop to `AmbienteCard`.
- **D-07:** No destination dialog — duplicate in-place immediately after original.
- **D-08:** ALL UUIDs in cloned tree must be regenerated — no reuse from original.
- **D-09:** Checklist always visible at top of Step 3 (not hidden dialog).
- **D-10:** Two levels — 🔴 error (blocks): fita 0m (CALC-01 gate). 🟡 warning (non-blocking): sem driver, sem lâmpada, voltagem divergente.
- **D-11:** Each checklist item has a "corrigir" link navigating back to Step 2.
- **D-12:** "Gerar PDF" disabled when any 🔴 error present; warnings do not block.
- **D-13/D-14:** Microcopy always visible (not tooltip), `text-xs text-muted-foreground`, single line.

### Claude's Discretion

- Exact focus/open behavior of sistema search after redirect tab switch (tab switch alone satisfies D-02).
- Internal structure of the clone helper (utility in `orcamento.ts` vs inline in component).
- Exact shadcn component composition for checklist panel (Card + list, Alert, etc.).
- Text/icon for duplicate buttons (lucide `Copy` or `CopyPlus`).

### Deferred Ideas (OUT OF SCOPE)

- Sistemas compostos montagem (MAGNETO/TINY/MODULAR) — v1.3.
- Auto-fill compatible driver (UX-02) — already delivered in Phase 15.
- PDF redesign, PDF v3.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Redirect from luminária search when code is perfil/fita/driver | Fallback query pattern, `useProdutoSearch` filter logic, `ProdutoAutocomplete` empty-state, `AmbienteCard` Tabs controlled-state upgrade |
| UX-03 | Microcopy inline under Luminárias and Sistemas tabs | Insertion points in `AmbienteCard.tsx` lines 352, 398 confirmed |
| RES-04 | Duplicate system inside same ambiente | `uid()` helper in `AmbienteCard`, `updateSistema` immutable pattern, UUID tree strategy |
| UX-04 | Duplicate ambiente (entire tree with new UUIDs) | `Step2Ambientes` array mutation pattern, deep-clone strategy, `addAmbiente` as reference |
| UX-05 | Pre-PDF checklist panel in Step 3 (always visible, blocking/non-blocking) | Phase 17 `AdvisoryItem` detectors, `handlePDF` button at line 838, `onPrev` at line 835 |
</phase_requirements>

---

## Summary

Phase 18 is entirely client-side additive UX on five existing components. No schema changes, no new edge functions, no new tables. All five features are incremental overlays on code that was audited live in this session — every finding below is verified from the actual source files.

The most architecturally interesting item is **UX-01**: the luminária search is pre-filtered by `tipo_produto` before products reach `ProdutoAutocomplete`, so a perfil/fita/driver code produces zero results without the component ever seeing the product. The fix requires a second fallback Supabase query (without the filter) triggered when the filtered search returns empty. The query shape is simple and read-only against `produtos`.

**UX-05** is the other integration-heavy item: the four advisory detectors from Phase 17 live inside `Step2Ambientes.tsx` as closures inside `handleNext`. They need to be extracted into pure functions (or imported from `orcamento.ts`) so `Step3Revisao` can run the same logic continuously as derived state. The checklist panel replaces the `toast.error` path for fita-0m (now a disabled PDF button) and supplements the existing advisory dialog.

**Primary recommendation:** Implement in dependency order — UX-03 (trivial, no risk) → RES-04 + UX-04 (UUID cloning, isolated) → UX-01 (fallback hook) → UX-05 (checklist, touches Step 3 PDF gate).

---

## Standard Stack

All libraries already installed — no `npm install` required for this phase.

### Core (already in project)
| Library | Version | Purpose | Role in Phase 18 |
|---------|---------|---------|-----------------|
| React 18 | 18.3.1 | UI framework | `useState`, `useMemo`, component state |
| Supabase JS SDK | 2.95.3 | Database queries | Fallback query for UX-01 |
| shadcn-ui (Radix) | 1.x | Component library | Card, Button, Badge, Tabs (controlled) |
| lucide-react | 0.462.0 | Icons | `Copy`, `CheckCircle2`, `AlertTriangle`, `ArrowRight` |
| Tailwind CSS | 3.4.17 | Styling | Color tokens, spacing |

[VERIFIED: live package.json + CLAUDE.md tech stack section]

### No New Dependencies
All shadcn components needed (`Card`, `CardHeader`, `CardContent`, `CardTitle`, `Button`, `Tabs`, `Badge`) are already installed in `@/components/ui/`. Confirmed by checking `AmbienteCard.tsx` imports and `18-UI-SPEC.md § Registry Safety`.

[VERIFIED: AmbienteCard.tsx imports, 18-UI-SPEC.md]

---

## Architecture Patterns

### Pattern 1: Pre-filtered search + fallback query (UX-01)

**Current behavior (verified):**

`useProdutoSearch` (line 26-29) applies an `.eq('tipo_produto', filtro)` for `filtro === 'fita' | 'driver' | 'perfil'`, and for `filtro === 'luminaria'` it uses `.or('tipo_produto.is.null,tipo_produto.in.(spot,lampada,acessorio,conector,suporte)')`.

Because the filter runs on the Supabase side, a code like `LM1370` (a `perfil`) typed into the luminária autocomplete returns 0 results — the product is filtered out before Supabase returns data. `ProdutoAutocomplete` sees `results.length === 0` and renders the empty-state at line 52.

**Fallback query approach (D-04):**

When the filtered query (`filtro=luminaria`) returns 0 results AND `query.trim().length >= 2`, issue a second query WITHOUT any `tipo_produto` filter to detect if the code actually exists under a different type:

```typescript
// Inside useProdutoSearch (or a new useProdutoFallback hook)
const { data } = await supabase
  .from('produtos')
  .select('codigo, tipo_produto')
  .or(`codigo.ilike.%${query}%,descricao.ilike.%${query}%`)
  .in('tipo_produto', ['perfil', 'fita', 'driver'])
  .limit(1);
// Returns the "real tipo" if found, or null if it's genuinely missing
```

**Three implementation options (D-04 asked to resolve):**

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Second fallback query in `useProdutoSearch` | Add `fallbackTipo` return when results=0 and query≥2 | **Recommended** — cleanest, minimal surface area, no hook consumer API breaks |
| B: Relax the filter, tag out-of-scope results | Return all results including perfil/driver, mark non-luminaria ones | More complex, changes result rendering for normal case |
| C: New separate `useProdutoFallback` hook | Separate hook that `ProdutoAutocomplete` calls when results=0 | Also valid; slightly more props threading |

**Option A implementation shape:**

`useProdutoSearch` returns `{ results, loading, redirectTipo }`. `redirectTipo` is `string | null`. When `filtro === 'luminaria'` and `results.length === 0` and not loading, the hook runs a debounced fallback query and sets `redirectTipo` to the found `tipo_produto` value (`'perfil'` | `'fita'` | `'driver'`) or `null`.

[VERIFIED: useProdutoSearch.ts full source]

**`ProdutoAutocomplete` prop addition:**

Add `onRedirectToSistemas?: () => void`. When `redirectTipo !== null`, render the redirect block (per 18-UI-SPEC.md) instead of the plain "Nenhum produto encontrado" text. The button calls `onRedirectToSistemas()` and `setOpen(false)`.

[VERIFIED: ProdutoAutocomplete.tsx full source — line 51-53 is the empty-state target]

**`AmbienteCard` Tabs upgrade (controlled state):**

Current `AmbienteCard.tsx` line 345: `<Tabs defaultValue="luminarias">` — **uncontrolled**.

Must upgrade to controlled:
```typescript
const [activeTab, setActiveTab] = useState<'luminarias' | 'sistemas'>('luminarias');
// ...
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'luminarias' | 'sistemas')}>
```

Then pass `onRedirectToSistemas={() => setActiveTab('sistemas')}` to the `ProdutoAutocomplete` rendered inside the `luminarias` TabsContent (line 366). No prop addition to `AmbienteCard` itself — this is all internal state.

[VERIFIED: AmbienteCard.tsx lines 345-349]

### Pattern 2: UUID generation (RES-04 + UX-04)

**Current pattern (verified):**

`AmbienteCard.tsx` line 47: `const uid = () => crypto.randomUUID();`

Every `addSistema()` (line 69-74) and `addLuminaria()` (line 57-59) calls `uid()` inline. `Step2Ambientes.tsx` line 59: `id: crypto.randomUUID()` for new ambientes.

**Deep clone strategy for `duplicarSistema` (RES-04):**

```typescript
function clonarSistema(sis: SistemaIluminacao): SistemaIluminacao {
  return {
    ...sis,
    id: crypto.randomUUID(),
    local: sis.local ? `${sis.local} (cópia)` : '(cópia)',
    fita: { ...sis.fita, id: crypto.randomUUID() },
    driver: { ...sis.driver, id: crypto.randomUUID() },
    perfil: sis.perfil ? { ...sis.perfil, id: crypto.randomUUID() } : null,
  };
}
```

Implementation: internal handler inside `AmbienteCard`, calls `onChange` with cloned sistema inserted at `si + 1`:
```typescript
const duplicarSistema = (si: number) => {
  const clone = clonarSistema(ambiente.sistemas[si]);
  const arr = [...ambiente.sistemas];
  arr.splice(si + 1, 0, clone);
  onChange({ ...ambiente, sistemas: arr });
};
```

**Deep clone strategy for `duplicarAmbiente` (UX-04):**

```typescript
function clonarAmbiente(amb: Ambiente): Ambiente {
  return {
    ...amb,
    id: crypto.randomUUID(),
    nome: `${amb.nome} (cópia)`,
    luminarias: amb.luminarias.map(l => ({ ...l, id: crypto.randomUUID() })),
    sistemas: amb.sistemas.map(sis => clonarSistema(sis)),
    // Note: clonarSistema already handles the " (cópia)" suffix for local
    // but for ambiente duplication, the local names should be preserved unchanged
  };
}
```

**IMPORTANT — local field for ambiente clone:** When duplicating an ambiente (UX-04), the `local` field of each sistema should be preserved unchanged (the sistema is a copy inside a new ambiente, not a copy within the same ambiente). The `" (cópia)"` suffix belongs on the AMBIENTE name only. `clonarSistema` appends to `local` — for ambiente duplication, use a variant that preserves `local` as-is:

```typescript
// In Step2Ambientes — duplicarAmbiente:
const clonarSistemaParaAmbiente = (sis: SistemaIluminacao): SistemaIluminacao => ({
  ...sis,
  id: crypto.randomUUID(),
  // local preserved (not "(cópia)" — the ambiente name already differentiates)
  fita: { ...sis.fita, id: crypto.randomUUID() },
  driver: { ...sis.driver, id: crypto.randomUUID() },
  perfil: sis.perfil ? { ...sis.perfil, id: crypto.randomUUID() } : null,
});
```

**Where clone helpers should live:**

Option A: Export `clonarSistema` and `clonarAmbiente` from `src/types/orcamento.ts` (alongside other domain utilities). Preferred — aligns with project convention of domain functions in that file, and enables unit testing without component mounting.

Option B: Inline in components. Simpler but untestable without mounting.

**Decision for planner:** Use Option A (orcamento.ts exports) given existing test infrastructure (`orcamento.test.ts`, `Step2Gate.test.ts` pattern).

[VERIFIED: AmbienteCard.tsx lines 47, 57-74; Step2Ambientes.tsx lines 57-65]

**Immutable update pattern used for ambientes array:**

`Step2Ambientes.tsx` line 67-70:
```typescript
const updateAmbiente = (index: number, amb: Ambiente) => {
  const arr = [...ambientes]; arr[index] = amb;
  onChange(arr);
};
```

`duplicarAmbiente` follows the same pattern — uses `splice(i + 1, 0, clone)` and calls `onChange`.

### Pattern 3: Detector extraction for UX-05

**Phase 17 detector locations (verified):**

All four advisory detectors live as inline logic inside `handleNext` in `Step2Ambientes.tsx` (lines 127-146). They are NOT exported functions — they're imperative for-loop checks. Additionally, `luminariaPrecisaLampada` (line 26-31) and `ambienteTemLampada` (lines 33-37) are standalone module-level functions in `Step2Ambientes.tsx`.

**Extraction approach for shared checklist:**

Extract the four detector patterns into pure functions exportable from `src/types/orcamento.ts` or a new `src/lib/checklistDetectors.ts`. The detectors take `Ambiente[]` and return a typed issues array:

```typescript
// Proposed signature (to live in orcamento.ts or checklistDetectors.ts)
export interface ChecklistIssue {
  id: string;           // unique key for React rendering
  level: 'error' | 'warning';
  ambienteNome: string;
  mensagem: string;
}

export function detectarChecklistIssues(ambientes: Ambiente[]): ChecklistIssue[];
```

**Six detectors (from 18-UI-SPEC.md + 18-CONTEXT.md D-10, verified against current code):**

| # | Level | Trigger | Mensagem |
|---|-------|---------|---------|
| 1 | error | `sis.fita.codigo && (!sis.metragemManual \|\| sis.metragemManual <= 0) && !sis.perfil` | `"[AmbienteNome] — Fita sem metragem (0m): o orçamento ficará R$ 0,00"` |
| 2 | warning | `sis.fita.codigo && !sis.driver.codigo` | `"[AmbienteNome] — Sistema sem driver"` |
| 3 | warning | `sis.driver.codigo && !sis.fita.codigo` | `"[AmbienteNome] — Driver sem fita LED"` |
| 4 | warning | `sis.perfil && !sis.fita.codigo` | `"[AmbienteNome] — Perfil sem fita LED"` |
| 5 | warning | voltagem divergente (see below) | `"[AmbienteNome] — Voltagem divergente: fita {X}V × driver {Y}V"` |
| 6 | warning | `luminariaPrecisaLampada(lum.descricao) && !ambienteTemLampada(amb)` | `"[AmbienteNome] — Peça sem lâmpada: {lum.descricao}"` |

Detectors 2, 3, 4, 6 are identical to the four Phase 17 advisory triggers. Detector 1 (fita 0m error) is the CALC-01 gate from Phase 16 (same predicate: `sis.fita.codigo && !sis.perfil && (!sis.metragemManual || sis.metragemManual <= 0)`). Detector 5 (voltagem divergente) is new for Phase 18 — see section below.

[VERIFIED: Step2Ambientes.tsx lines 19-51, 126-146]

### Pattern 4: Voltagem divergente detector (UX-05 new item)

**How voltage is modeled (verified from source):**

- `ItemFitaLED.voltagem?: 12 | 24 | 48` — optional field on the fita interface (`orcamento.ts` line 60)
- `ItemDriver.voltagem: 12 | 24 | 48` — required field on driver (`orcamento.ts` line 74)

Fita voltagem is optional because old snapshots may not have it. Driver voltagem defaults to `24` when a new sistema is created (`AmbienteCard.tsx` line 71).

**Existing inline divergence check (verified):**

`AmbienteCard.tsx` lines 411-417 already detect and badge divergent voltage:
```typescript
const fv = sis.fita.voltagem, dv = sis.driver.voltagem;
const temDivergencia = !!sis.fita.codigo && !!sis.driver.codigo && fv !== undefined && dv !== undefined && fv !== dv;
```

This is the exact predicate to reuse in the checklist detector.

**Toast warning also exists** at `handleSelectProdutoSistema` (line 161-175) — orientative, not blocking.

**TENS-01/TENS-02 relationship:** Phase 15 implemented voltage inference (UX-02) and grouped drivers by `(codigo + voltagem)`. The voltage data is already on both `ItemFitaLED` and `ItemDriver` at runtime. The checklist detector uses this data directly.

**Detector 5 precise predicate:**
```typescript
const fitaVolt = sis.fita.voltagem;
const driverVolt = sis.driver.voltagem;
const divergente = !!sis.fita.codigo && !!sis.driver.codigo
  && fitaVolt !== undefined && fitaVolt !== null
  && fitaVolt !== driverVolt;
if (divergente) issues.push({
  id: `${amb.id}-${sis.id}-voltagem`,
  level: 'warning',
  ambienteNome: amb.nome,
  mensagem: `${amb.nome} — Voltagem divergente: fita ${fitaVolt}V × driver ${driverVolt}V`,
});
```

[VERIFIED: AmbienteCard.tsx lines 411-417, orcamento.ts lines 55-78]

### Pattern 5: PDF button gate (UX-05 + existing gating)

**Current button (verified at line 838):**
```typescript
<Button
  onClick={handlePDF}
  className="gap-2 print:hidden"
  disabled={hasUnresolved || savingOrcamento}
  title={hasUnresolved ? "Resolva as violações de preço antes de gerar o PDF" : ""}
>
  <FileDown className="h-4 w-4" /> {savingOrcamento ? "Salvando..." : "Gerar PDF"}
</Button>
```

**Phase 18 modification:** Add `temErroBloqueante` as an additional `disabled` condition:
```typescript
const temErroBloqueante = checklistIssues.some(i => i.level === 'error');
// ...
disabled={hasUnresolved || savingOrcamento || temErroBloqueante}
```

The existing `hasUnresolved` gate (price violations) is preserved. The new `temErroBloqueante` gate (fita 0m) is additive.

**`onPrev` prop (verified at line 835):**
```typescript
<Button variant="outline" onClick={onPrev} className="gap-2 print:hidden">
  <ArrowLeft className="h-4 w-4" /> Voltar
</Button>
```

`onPrev` is already in `Step3Props` (line 28) and wired up. The checklist "corrigir" button calls `onPrev()` — no new prop needed.

[VERIFIED: Step3Revisao.tsx lines 26-36, 834-841]

### Pattern 6: Checklist as derived state

**Location:** `Step3Revisao.tsx` — computed via `useMemo` from `ambientes`:

```typescript
const checklistIssues = useMemo(
  () => detectarChecklistIssues(ambientes),
  [ambientes]
);
const temErroBloqueante = checklistIssues.some(i => i.level === 'error');
```

`detectarChecklistIssues` is a pure function — no async, no Supabase calls. It reads the same `ambientes` array already in scope in Step3.

**Checklist panel placement (verified):**

Line 517-521 of Step3Revisao:
```typescript
return (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Revisão do Orçamento</h2>
```

Checklist Card inserts after the opening `<div className="space-y-6">` and before the existing `<div>` containing the heading — as the **first visual element** in the step.

[VERIFIED: Step3Revisao.tsx lines 516-522]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random id | `crypto.randomUUID()` | Already used in project (AmbienteCard line 47, Step2Ambientes line 59) — guaranteed collision-free |
| Tabs controlled state | Custom tab state with conditional rendering | shadcn `<Tabs value={} onValueChange={}>` | Already in project, simply upgrade from `defaultValue` to controlled |
| Checklist state management | useState + imperative updates | `useMemo` derived from `ambientes` | Pure function of existing state — no extra state needed |
| Deep object clone | JSON.parse/JSON.stringify | Spread + new UUID pattern | Type-safe, no serialization overhead, works with `undefined` fields |

---

## Common Pitfalls

### Pitfall 1: Cloning with shared UUID → collisions in re-renders and PDF

**What goes wrong:** If `clonarSistema` only spreads the sistema without regenerating sub-item IDs, then the cloned `fita.id`, `driver.id`, `perfil.id` are identical to the originals. React's `key={item.id}` in maps causes wrong reconciliation; PDF snapshot diffs fail.

**How to avoid:** `clonarSistema` must regenerate `id` at every level of the tree: sistema, fita, driver, and perfil (if present). See Pattern 2 above.

**Warning sign:** After cloning, editing the clone's driver price also updates the original's driver row.

[VERIFIED: confirmed by auditing all `.id` fields in `SistemaIluminacao` and `Ambiente` interfaces]

### Pitfall 2: Tabs upgrade from uncontrolled to controlled — losing tab sync with parent state

**What goes wrong:** `AmbienteCard` currently uses `<Tabs defaultValue="luminarias">` (uncontrolled, line 345). If you add `value={activeTab}` without also adding `onValueChange`, clicking the Sistemas tab manually will stop working.

**How to avoid:** Always pair controlled `value` with `onValueChange`. Pattern:
```typescript
const [activeTab, setActiveTab] = useState<'luminarias' | 'sistemas'>('luminarias');
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'luminarias' | 'sistemas')}>
```

[VERIFIED: AmbienteCard.tsx line 345]

### Pitfall 3: Fallback query running on every keystroke

**What goes wrong:** If the fallback query in `useProdutoSearch` is not debounced or not gated on `results.length === 0 && !loading`, it fires on every character change, even while the main query is still in flight.

**How to avoid:** Gate the fallback: only run it inside the same debounce timer, after the primary query resolves, and only if `filtro === 'luminaria'`, `results.length === 0`, and `query.trim().length >= 2`. The existing `useEffect` with `setTimeout` in `useProdutoSearch` is the right place.

[VERIFIED: useProdutoSearch.ts lines 10-52]

### Pitfall 4: `local` field gets `" (cópia)"` appended in ambiente duplication

**What goes wrong:** Using `clonarSistema` (which appends `" (cópia)"` to `local`) when duplicating an ambiente means every sistema's `local` field gets the suffix — e.g. `"Sanca"` becomes `"Sanca (cópia)"` inside a clone of "Cozinha". The "(cópia)" is only meaningful as a sistema identifier when duplicating within the SAME ambiente.

**How to avoid:** Use two separate clone helpers: `clonarSistema` (for RES-04, appends to `local`) and `clonarSistemaParaAmbiente` (for UX-04 inside `clonarAmbiente`, preserves `local` unchanged). See Pattern 2.

### Pitfall 5: Checklist 0m error blocks PDF even for systems without fita

**What goes wrong:** A naive "metragem 0m" predicate like `sis.metragemManual <= 0` fires on systems where `fita.codigo === ''` (empty system). This would permanently block PDF generation on orçamentos with empty or driver-only systems.

**How to avoid:** Guard on `sis.fita.codigo` being non-empty first: `sis.fita.codigo && !sis.perfil && (!sis.metragemManual || sis.metragemManual <= 0)`. This is the same predicate as CALC-01 in `Step2Ambientes.tsx` (line 89-92).

[VERIFIED: Step2Ambientes.tsx lines 87-92]

### Pitfall 6: `redirectTipo` persists after user types a new query

**What goes wrong:** If `redirectTipo` is stored in a separate `useState`, clearing the query or typing a new one may not reset it if the fallback query is async and arrives after the new main query starts.

**How to avoid:** Tie `redirectTipo` to the same `useEffect` lifecycle as `results`. Reset to `null` at the start of each effect run before the queries fire. Or return it from the hook so it's always computed fresh from the same render cycle.

### Pitfall 7: `tipo_produto` CHECK values — `'spot'` is not the same as `'luminaria'`

**What goes wrong:** The database CHECK constraint uses `'spot', 'lampada', 'acessorio', 'conector', 'suporte'` (not `'luminaria'`). The `ProdutoFiltro` type uses `'luminaria'` as a UI alias. If the fallback query filters by `tipo_produto = 'luminaria'` it will return 0 results.

**How to avoid:** The fallback query should filter by `tipo_produto IN ('perfil', 'fita', 'driver')` only (looking for redirect targets), not by `'luminaria'`. The redirect message is only shown when the searched code IS a `perfil`/`fita`/`driver`, not for genuinely missing products.

[VERIFIED: migrations/20260319000001_campos_tecnicos_produtos.sql lines 66-68, useProdutoSearch.ts line 29]

---

## Code Examples

### UUID generation pattern (project standard)

```typescript
// Source: AmbienteCard.tsx line 47 + Step2Ambientes.tsx line 59
const uid = () => crypto.randomUUID();
// or inline:
id: crypto.randomUUID()
```

### Immutable array splice pattern (Step2 convention)

```typescript
// Source: Step2Ambientes.tsx addAmbiente + updateAmbiente pattern
const duplicarAmbiente = (index: number) => {
  const clone = clonarAmbiente(ambientes[index]);
  const arr = [...ambientes];
  arr.splice(index + 1, 0, clone);
  onChange(arr);
};
```

### Tabs controlled upgrade

```typescript
// Source: AmbienteCard.tsx line 345 (current uncontrolled — must upgrade)
// Before:
<Tabs defaultValue="luminarias">
// After:
const [activeTab, setActiveTab] = useState<'luminarias' | 'sistemas'>('luminarias');
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'luminarias' | 'sistemas')}>
```

### Phase 17 luminariaPrecisaLampada (reusable)

```typescript
// Source: Step2Ambientes.tsx lines 26-31
function luminariaPrecisaLampada(descricao: string): boolean {
  const d = (descricao ?? '').toUpperCase();
  const temBaseLampada = /\b(GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO)\b/.test(d);
  const temLedIntegrado = /LED\s+INTEGRADO|COM\s+LED/.test(d);
  return temBaseLampada && !temLedIntegrado;
}
```

### Existing PDF gate pattern

```typescript
// Source: Step3Revisao.tsx line 838
<Button
  onClick={handlePDF}
  className="gap-2 print:hidden"
  disabled={hasUnresolved || savingOrcamento}
>
```

---

## `tipo_produto` CHECK Values

**Verified from migration `20260319000001_campos_tecnicos_produtos.sql` lines 66-68:**

```
'fita', 'driver', 'perfil', 'spot', 'lampada', 'acessorio', 'conector', 'suporte'
```

`NULL` is also valid. There is no `'luminaria'` value — that is a UI-only alias in `ProdutoFiltro`.

**Redirect targets** (D-01): `'perfil'`, `'fita'`, `'driver'` — these are the types a luminária search might accidentally match.

**Display names for redirect message (from 18-UI-SPEC.md):**
- `'perfil'` → "perfil"
- `'fita'` → "fita LED"
- `'driver'` → "driver"

---

## Component State Summary

### AmbienteCard changes

| Change | What | Current State | After |
|--------|------|---------------|-------|
| Tabs upgrade | `defaultValue` → `value` + `onValueChange` | Uncontrolled (line 345) | Controlled with `useState<'luminarias' \| 'sistemas'>` |
| New prop | `onDuplicate?: () => void` | Absent | Optional prop, renders duplicate button in header |
| New internal handler | `duplicarSistema(si)` | Absent | Calls `clonarSistema()`, inserts at `si+1` via `onChange` |
| UX-03 microcopy | Two `<p>` elements | Absent | After TabsContent open tags (lines 352, 398) |
| UX-01 redirect | `onRedirectToSistemas` prop on luminária `ProdutoAutocomplete` | Absent | Passes `() => setActiveTab('sistemas')` |

### Step2Ambientes changes

| Change | What | Current State | After |
|--------|------|---------------|-------|
| New handler | `duplicarAmbiente(index)` | Absent | `clonarAmbiente()` + `splice(i+1,0,clone)` + `onChange` |
| Prop pass | `onDuplicate` to `AmbienteCard` | Absent | `onDuplicate={() => duplicarAmbiente(i)}` |

### ProdutoAutocomplete changes

| Change | What | Current State | After |
|--------|------|---------------|-------|
| New prop | `onRedirectToSistemas?: () => void` | Absent | Optional callback |
| Empty-state branch | Shows `redirectTipo` block when detected | Shows plain "Nenhum produto encontrado" | Conditional: redirect block OR plain text |

### useProdutoSearch changes

| Change | What | Current State | After |
|--------|------|---------------|-------|
| New return value | `redirectTipo: string \| null` | Returns `{ results, loading }` | Returns `{ results, loading, redirectTipo }` |
| Fallback query | Second Supabase query when primary returns 0 | Absent | Fires within same debounce, gated on `filtro === 'luminaria'` |

### Step3Revisao changes

| Change | What | Current State | After |
|--------|------|---------------|-------|
| Checklist panel | New Card component | Absent | First element inside `<div className="space-y-6">` (after line 517) |
| `checklistIssues` | `useMemo` derived from `ambientes` | Absent | `const checklistIssues = useMemo(() => detectarChecklistIssues(ambientes), [ambientes])` |
| PDF gate | `disabled` condition | `hasUnresolved \|\| savingOrcamento` | `hasUnresolved \|\| savingOrcamento \|\| temErroBloqueante` |

---

## Testing

`nyquist_validation` is explicitly `false` in `.planning/config.json` — the Validation Architecture section is omitted per protocol.

**Existing test patterns (verified):**

- `src/components/__tests__/Step2Gate.test.ts` — mirror-predicates pattern: copies pure logic from component, tests it standalone with Vitest `describe/it/expect`. No component mounting.
- `src/types/orcamento.test.ts` — tests exported functions from `orcamento.ts` directly.
- `src/types/__tests__/sufixoMetragem.test.ts` — tests `aplicarSufixoMetragem` exported from `orcamento.ts`.

**New tests to write (planner should include in Wave 0 or per-plan):**

| Test file | What to test |
|-----------|-------------|
| `src/types/__tests__/clonarSistema.test.ts` | `clonarSistema`: all IDs different from original, `local` gets suffix; `clonarSistemaParaAmbiente`: IDs different, `local` unchanged |
| `src/types/__tests__/clonarAmbiente.test.ts` | `clonarAmbiente`: ambiente ID different, nome gets suffix, all nested IDs different, no shared ID with original |
| `src/types/__tests__/checklistDetectors.test.ts` | `detectarChecklistIssues`: fita 0m → error; sem driver → warning; voltagem divergente → warning; peça sem lâmpada → warning; clean sistema → no issues; multiple ambientes → all issues collected |

Pattern: same as `Step2Gate.test.ts` — pure function tests, no component mounting, no Supabase mocking needed.

---

## Security Domain

This phase is client-side UX only.

**New write paths:** None. Duplication operates entirely on in-memory React state — no Supabase writes triggered by duplicate actions.

**New read paths:** One new read-only Supabase SELECT on `produtos` (fallback query for UX-01). This query:
- Is authenticated (session required by existing RLS on `produtos`)
- Reads only `codigo, tipo_produto` (no PII)
- Uses the same table and same authentication context as the existing `useProdutoSearch` query
- No new RLS surface introduced

**Threat model:** Minimal. No new attack surface. The fallback query is a subset of the existing catalog search — an attacker who can read the catalog already can with the existing query.

**ASVS V5 Input Validation:** The `query` string passed to the fallback uses the same `.ilike.%${query}%` pattern as the existing search. No new injection vectors.

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely client-side React state changes. The only external dependency (Supabase) is the same instance already used throughout the app. No new tools, services, or runtimes required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `clonarSistema` appending `" (cópia)"` to `local` is the right behavior for RES-04 (duplicate within same ambiente) | Pattern 2 | Low — if the copy should not append, remove the local modification and add to the sistema's `local` field only via user edit. D-05 says "sufixo no local", confirming the behavior. |

**All other claims in this research were verified directly from source files in this session.** No training-data-only assumptions.

---

## Open Questions

1. **`redirectTipo` when multiple products match**
   - What we know: the fallback query uses `.limit(1)` and `.in('tipo_produto', ['perfil', 'fita', 'driver'])` — returns only the first match.
   - What's unclear: if a query like "LM" matches both a perfil and a fita, the message will say "Este produto é um perfil" for whichever comes first by `.order('codigo')`.
   - Recommendation: acceptable for v1.2. The redirect message gives the right type for the first result; planner should document this limitation in the plan.

2. **`luminariaPrecisaLampada` and `ambienteTemLampada` current location**
   - What we know: these are module-level private functions in `Step2Ambientes.tsx` (lines 26-37), not exported.
   - What's unclear: whether to duplicate them in `orcamento.ts` or move them (breaking the existing advisory usage in Step2Ambientes).
   - Recommendation: extract to `orcamento.ts` as exported functions, update the `Step2Ambientes` import. Or: keep them in `Step2Ambientes` and also export them from there — component exports are unusual but viable. Planner decision.

---

## Sources

### Primary (HIGH confidence — verified from live source files this session)
- `src/hooks/useProdutoSearch.ts` — filter logic, return shape, debounce pattern
- `src/components/ProdutoAutocomplete.tsx` — empty-state target (line 51-53), prop interface
- `src/components/AmbienteCard.tsx` — Tabs (line 345), sistema header (lines 407-431), uid() (line 47), add/update/remove patterns
- `src/components/Step2Ambientes.tsx` — advisory detectors (lines 126-146), `luminariaPrecisaLampada`, `ambienteTemLampada`, `addAmbiente` pattern
- `src/components/Step3Revisao.tsx` — `handlePDF` (line 434), PDF button (line 838), `onPrev` (line 835), return structure (line 517)
- `src/types/orcamento.ts` — `SistemaIluminacao`, `Ambiente`, `ItemFitaLED.voltagem`, `ItemDriver.voltagem` field definitions
- `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql` — CHECK constraint values for `tipo_produto`
- `src/components/__tests__/Step2Gate.test.ts` — test pattern reference
- `src/types/orcamento.test.ts` — test pattern reference
- `.planning/phases/18-ux-transversal/18-CONTEXT.md` — all locked decisions D-01..D-14
- `.planning/phases/18-ux-transversal/18-UI-SPEC.md` — component composition, copy contract, registry safety
- `.planning/config.json` — `nyquist_validation: false` confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from project files
- Architecture patterns: HIGH — all verified from live source code
- Pitfalls: HIGH — derived from actual code paths audited in this session
- Test patterns: HIGH — verified from existing test files

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable codebase, no fast-moving deps)
