# Phase 21: SYSTEM MOLD + Validação & Reuso — Research

**Researched:** 2026-06-16
**Domain:** SYSTEM MOLD modular flow (catalog detection, fita derivation, advisory extension, composite duplication)
**Confidence:** HIGH — all three open questions resolved with live DB queries against `jkewlaezvrbuicmncqbj`

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Deriva metragem + botão "Adicionar fita". Metragem = `Σ(comprimento × qtd)` dos difusos. Busca de fita abre seletor (SKU decidido pelo vendedor — nunca auto-escolhido). Fita entra na composição com metragem pré-preenchida. Dispara recomendação advisory de driver (`buscarDriverSugerido`). Rejeitado: só mostrar metragem; auto-criar fita+driver.
- **D-02:** Estende o advisory existente no `Step2Ambientes.handleNext` (não cria fluxo novo). Permanece não-bloqueante.
- **D-03:** Condições de aviso: (1) composto magnético sem `papel==='driver_recomendado'`; (2) conector obrigatório da família ausente (`REGRAS_COMPOSICAO[sistema].conectoresObrigatorios`); (3) SYSTEM MOLD sem fita adicionada (metragem derivada > 0, mas sem `papel==='fita_modular'` ou similar na composicao).
- **D-04:** Botão "duplicar" no header do ComposicaoCard (ao lado de Trash2).
- **D-05:** Destino = ambiente escolhido. Abre seletor de ambientes. Se só existe 1, vai pro mesmo.
- **D-06:** Clone com `crypto.randomUUID()` em TODA a árvore — `ItemLuminaria` raiz + cada `ItemComposicao` filho.

### Claude's Discretion

- Layout/copy exatos do painel de fita derivada e do seletor de ambiente destino (dropdown vs Dialog).
- Texto dos novos `AdvisoryItem` gerados pelos 3 tipos de composto.
- `papel` exato da fita na composição modular (`fita_modular` novo ou reaproveitar existente).

### Deferred Ideas (OUT OF SCOPE)

- Módulos concentrados (spots) integrados ao card modular.
- Checklist de obrigatórios para o modular (`REGRAS_COMPOSICAO['s_mode']`).
- PDF v3 / seção de compostos (PDF-03) — Phase 22.
- Mover (não duplicar) composto entre ambientes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIST-03 | Colaborador monta sistema modular SYSTEM MOLD (perfil modular + módulos difusos), com demanda de fita derivada automaticamente de `Σ(comprimento × qtd)` dos módulos. | Q1 (detection migration), Q2 (metragem helper + buscarDriverSugerido reuse), ComposicaoCard extension |
| VAL-01 | Ao avançar Step 2 → Step 3, sistema avisa (não-bloqueante) quando composto incompleto. | Step2Ambientes.handleNext extension — 3 new AdvisoryItem types |
| DUP-01 | Colaborador duplica sistema composto inteiro em outro ambiente, com novos UUIDs em toda a árvore. | Q3 (clonarAmbiente gap + new clonarCompostoParaAmbiente helper) |
</phase_requirements>

---

## Summary

Phase 21 builds three features on top of the Phase 19/20 foundation (`luminarias[].composicao?`, `ComposicaoCard`, `detectarTipoAncora`). The research resolved all three open technical questions with live Supabase queries.

**Critical finding:** `detectarTipoAncora` reads `produto.sistema_magnetico` which is aliased from the `sistema` column in `product_variants`. Currently ALL 87 SYSTEM MOLD products have `sistema = NULL`, so every SYSTEM MOLD anchor falls through to the `luminaria` fallback — confirming the detection is broken. The fix requires a targeted migration marking 12 true perfil anchors (`sistema = 's_mode'`) plus 15 difuso modules. The migration follows the exact CAT-03 pattern from Phase 19 (`20260612000001_cat03_tipo_produto_conector_kit.sql`).

**Secondary finding:** The `filtroSistema` path in `useProdutoSearch` uses `.is('tipo_produto', null)`, which excludes difusos (whose `tipo_produto = 'acessorio'`). The busca de módulos difusos within ComposicaoCard therefore needs a dedicated filter value (`'modulo_difuso'` → `.eq('tipo_produto', 'acessorio').eq('sistema', 's_mode')`), not the existing `filtroSistema` path.

**Third finding:** `clonarAmbiente` (orcamento.ts:614) does NOT deep-clone `composicao[]` — it spreads each `ItemLuminaria` with a new root `id` but the `composicao` array objects retain their original IDs. A new helper `clonarCompostoParaAmbiente(item: ItemLuminaria): ItemLuminaria` is needed for D-06.

**Primary recommendation:** Migration-first for detection (route A). Write one migration (`20260616000001_sistema_s_mode_system_mold.sql`), extend `useProdutoSearch` with `filtro='modulo_difuso'`, then implement the three UI flows.

---

## Standard Stack

No new libraries needed. [VERIFIED: codebase grep]

| Component | File | Role in Phase 21 |
|-----------|------|-----------------|
| `src/types/orcamento.ts` | Domain types + calc | New `calcularMetragemModulosDifusos`, new `clonarCompostoParaAmbiente`, extend `AdvisoryItem` |
| `src/hooks/useProdutoSearch.ts` | Product search | New `filtro='modulo_difuso'` branch |
| `src/components/ComposicaoCard.tsx` | Composite card | Modular panel (fita derivada + "Adicionar fita" + driver reuse) + duplicate button |
| `src/components/AmbienteCard.tsx` | Ambiente card | `handleSelectProdutoGlobal` `'modular'` route (initiates `composicao: []`), orchestrates duplication destination |
| `src/components/Step2Ambientes.tsx` | Step 2 | Extend `handleNext` with 3 new AdvisoryItem types |
| `supabase/migrations/` | DB schema | 1 new migration: `sistema='s_mode'` for 12 anchors + 15 difusos |

---

## Open Question 1: SYSTEM MOLD Detection (CRITICAL)

### Verified Catalog State [VERIFIED: Supabase MCP — jkewlaezvrbuicmncqbj]

| Category | Count | tipo_produto | sistema | Notes |
|----------|-------|-------------|---------|-------|
| PERFIL NOFRAME MODULAR (LM1998–LM2003) | 6 | NULL | NULL | True anchors (1m/2m/3m × branco/preto) |
| PERFIL DE EMBUTIR MODULAR (LM2109–LM2114) | 6 | NULL | NULL | True anchors (1m/2m/3m × branco/preto) |
| MODULO DIFUSO PARA FITA LED | 15 | `acessorio` | NULL | Comprimento in desc (132MM/264MM/396MM/528MM/660MM/1MT/2MT) |
| MODULO SPOT concentrado (GU10/E27, fora de escopo) | 32 | NULL | NULL | potencia_watts=8; escopo Phase 21 deferred |
| TAMPA CEGA / TAMPA C/FURO | 16 | NULL | NULL | NOT anchors; filtered by migration |
| KIT MODULAR (EMBUTIR/SOBREPOR/NO FRAME) | 6 | NULL | NULL | Acessórios opcionais |
| **Total** | **87** | — | — | |

No `sistema = 's_mode'` value exists anywhere in the DB today. [VERIFIED]

### How `detectarTipoAncora` reads columns [VERIFIED: orcamento.ts:173–179, useProdutoSearch.ts:24]

```typescript
// orcamento.ts:173
export function detectarTipoAncora(produto: Produto): TipoAncora {
  if (produto.tipo_produto === 'fita') return 'fita';
  if (produto.sistema_magnetico === 'magneto_48v') return 'magneto_48v';
  if (produto.sistema_magnetico === 'tiny_magneto') return 'tiny_magneto';
  if (produto.sistema_magnetico === 's_mode') return 'modular';   // <-- target
  return 'luminaria'; // fallback
}
```

`produto.sistema_magnetico` is populated from `product_variants.sistema` aliased in the SELECT at `useProdutoSearch.ts:24`:
```
sistema_magnetico:sistema,
```
Currently `sistema = NULL` for all SYSTEM MOLD → always falls through to `return 'luminaria'`.

### Recommended Route: Migration-Aditiva (Route A) [VERIFIED: CAT-03 precedent in 20260612000001_cat03_tipo_produto_conector_kit.sql]

**Why Route A over Route B (descrição detection):**
- `detectarTipoAncora` was designed to read `sistema` column — description regex would be a workaround that diverges from established pattern.
- CAT-03 (Phase 19) set the exact precedent: `UPDATE product_variants SET tipo_produto = 'conector' WHERE codigo IN (...)`. This phase does the same for `sistema`.
- `filtroSistema='s_mode'` in `useProdutoSearch` also relies on the `sistema` column — migration unlocks it for free.
- Description regex is brittle to spacing/encoding variations in product names.

**Exact Migration SQL:**

```sql
-- Migration: 20260616000001_sistema_s_mode_system_mold.sql
-- Marks SYSTEM MOLD perfil anchors and difusos with sistema='s_mode'
-- CAT-03 pattern (Phase 19). Applied via MCP apply_migration + migration repair (NOT supabase db push).
-- Table: product_variants (view 'produtos' is an alias)

BEGIN;

-- 1. True PERFIL MODULAR anchors (NOFRAME + EMBUTIR)
--    Scope: "SYSTEM MOLD 22 PERFIL NOFRAME MODULAR ..." + "SYSTEM MOLD 22 PERFIL DE EMBUTIR MODULAR ..."
--    Excludes: TAMPA (has "TAMPA" in desc), DIFUSO, MODULO SPOT
--    Expected: 12 rows (LM1998–LM2003 NOFRAME + LM2109–LM2114 EMBUTIR)
UPDATE public.product_variants
SET sistema = 's_mode'
WHERE descricao ILIKE '%SYSTEM MOLD%'
  AND (
    descricao ILIKE '%PERFIL NOFRAME MODULAR%'
    OR descricao ILIKE '%PERFIL DE EMBUTIR MODULAR%'
  )
  AND sistema IS DISTINCT FROM 's_mode';

-- 2. Módulos difusos (PARA FITA LED) — scope trigger for fita derivation
--    tipo_produto='acessorio' is the reliable discriminator; DIFUSO narrows further
--    Expected: 15 rows (LM2026, LM2107–LM2108, LM2270–LM2275, LM2490–LM2495)
UPDATE public.product_variants
SET sistema = 's_mode'
WHERE descricao ILIKE '%SYSTEM MOLD%'
  AND descricao ILIKE '%DIFUSO%'
  AND tipo_produto = 'acessorio'
  AND sistema IS DISTINCT FROM 's_mode';

COMMIT;
```

**Rollback:**
```sql
BEGIN;
UPDATE public.product_variants SET sistema = NULL
  WHERE descricao ILIKE '%SYSTEM MOLD%'
    AND (
      descricao ILIKE '%PERFIL NOFRAME MODULAR%'
      OR descricao ILIKE '%PERFIL DE EMBUTIR MODULAR%'
    )
    AND sistema = 's_mode';
UPDATE public.product_variants SET sistema = NULL
  WHERE descricao ILIKE '%SYSTEM MOLD%'
    AND descricao ILIKE '%DIFUSO%'
    AND tipo_produto = 'acessorio'
    AND sistema = 's_mode';
COMMIT;
```

**Migration process:** Apply via MCP `apply_migration` (project `jkewlaezvrbuicmncqbj`) + `migration repair` to reconcile history. `supabase db push` is UNSAFE for this project (migration history diverges from local). [VERIFIED: project_aura_migration_divergence memory entry]

### After Migration: `filtroSistema` gap for difusos

Post-migration, `useProdutoSearch` with `filtroSistema='s_mode'` hits:
```typescript
queryBuilder = queryBuilder
  .eq('sistema', filtroSistema)       // → sistema='s_mode' ✓
  .is('tipo_produto', null)           // → difusos have tipo_produto='acessorio' — EXCLUDED!
  .not('descricao', 'ilike', '%TRILHO DE %')
  .not('descricao', 'ilike', '%TRILHO PENDENTE%')
```

Difusos have `tipo_produto='acessorio'` (not null), so the existing `filtroSistema` path **will not return them**.

**Fix:** Add `filtro='modulo_difuso'` to `ProdutoFiltro` union and handle it in `useProdutoSearch`:
```typescript
// useProdutoSearch.ts — new branch in the filtro switch
} else if (filtro === 'modulo_difuso') {
  queryBuilder = queryBuilder
    .eq('tipo_produto', 'acessorio')
    .eq('sistema', 's_mode');
}
```
ComposicaoCard then uses `<ProdutoAutocomplete filtro="modulo_difuso" />` for its "Adicionar módulo difuso" busca.

---

## Open Question 2: Metragem Derivada + Reuso de buscarDriverSugerido (D-01)

### `calcularMetragemModulosDifusos` — new helper [VERIFIED: ItemComposicao.comprimento field at orcamento.ts:54]

```typescript
// New helper — orcamento.ts (NOT touching the 5 protected calc sites)
/** Metragem total de fita derivada dos módulos difusos de um SYSTEM MOLD.
 *  = Σ(comprimento × quantidade) dos itens com comprimento definido.
 *  Returns 0 if no difuso modules present. Phase 21 / D-01. */
export function calcularMetragemModulosDifusos(composicao: ItemComposicao[] | undefined): number {
  if (!composicao?.length) return 0;
  return composicao
    .filter(c => c.papel === 'modulo' && c.comprimento != null)
    .reduce((s, c) => s + (c.comprimento ?? 0) * c.quantidade, 0);
}
```

`ItemComposicao.comprimento?: number` already exists at orcamento.ts:54 (forward-complete from Phase 19/D-02). No type changes needed.

### Comprimento parse from description [VERIFIED: live DB query — all 15 difusos analyzed]

All 15 difuso SKUs follow one of two patterns:
- `NNN MM` → convert to meters: `132MM → 0.132m`, `264MM → 0.264m`, `396MM → 0.396m`, `528MM → 0.528m`, `660MM → 0.66m`
- `NMT` → already meters: `1MT → 1.0m`, `2MT → 2.0m`

```typescript
// Parse at add-time (snapshot, never re-parsed from DB) — inside ComposicaoCard or helper
function parsearComprimentoModulo(descricao: string): number | undefined {
  // Try MM first (most common)
  const mmMatch = descricao.match(/FITA LED\s+(\d+(?:[,.]\d+)?)\s*MM/i);
  if (mmMatch) return parseFloat(mmMatch[1].replace(',', '.')) / 1000;
  // Try MT (meters)
  const mtMatch = descricao.match(/FITA LED\s+(\d+(?:[,.]\d+)?)\s*MT/i);
  if (mtMatch) return parseFloat(mtMatch[1].replace(',', '.'));
  return undefined;
}
```

The `comprimento` is set as snapshot in `ItemComposicao.comprimento` when the difuso module is added, exactly as `potenciaW` is set for magneto modules (D-03 of Phase 19).

### Reuso de `buscarDriverSugerido` [VERIFIED: AmbienteCard.tsx:147–160]

`buscarDriverSugerido` lives in `AmbienteCard.tsx` as a local `async` function:
```typescript
// AmbienteCard.tsx:147
const buscarDriverSugerido = async (voltagem: number, wm: number, metragemReal: number): Promise<Produto | null> => {
  const metragem = metragemReal > 0 ? metragemReal : 5;
  const consumoEstimado = wm * metragem * MARGEM_SEGURANCA_DRIVER;
  const { data } = await supabase.from('produtos')
    .select('id, codigo, descricao, preco_tabela, preco_minimo, voltagem:tensao, driver_potencia_w:potencia_watts, driver_tipo:subtipo')
    .eq('tipo_produto', 'driver')
    .eq('tensao', voltagem)
    .gte('potencia_watts', consumoEstimado)
    .not('descricao', 'ilike', '%DESCONTINUAR%')
    .order('potencia_watts', { ascending: true })
    .limit(1);
  return (data?.[0] as Produto) ?? null;
};
```

**Cannot be called from `ComposicaoCard`** (it's a local closure in `AmbienteCard`). Two options:
1. **Extract to a shared util** in `src/lib/` or `src/hooks/` so both `AmbienteCard` and `ComposicaoCard` can import it.
2. **Replicate the Supabase query inside `ComposicaoCard`** (same pattern as 24V driver search already in ComposicaoCard:116–154).

**Recommendation:** Replicate within ComposicaoCard modular section (same pattern as existing 24V search). `ComposicaoCard` already does its own `supabase` queries (aplicarDriver24V, adicionarComponentePorSku). Keeps components self-contained. The `buscarDriverSugerido` logic is 8 lines — minimal duplication.

**Trigger:** After the user clicks "Adicionar fita" and selects a fita SKU, ComposicaoCard:
1. Sets `fita_modular` item in `composicao` with `metragem = calcularMetragemModulosDifusos(composicao)` pre-filled.
2. Immediately calls `buscarDriverSugerido(fita.voltagem, fita.wm, metragem)` → if result, shows advisory driver panel (same pattern as 24V panel).

The driver advisory remains non-blocking and overridable — same `driverAplicado` / "Alterar" pattern as magneto flows.

---

## Open Question 3: Clone de Composto entre Ambientes (DUP-01/D-06)

### Gap in `clonarAmbiente` [VERIFIED: orcamento.ts:614–622]

```typescript
// orcamento.ts:614 — CURRENT (does NOT deep-clone composicao[])
export function clonarAmbiente(amb: Ambiente): Ambiente {
  return {
    ...amb,
    id: crypto.randomUUID(),
    nome: `${amb.nome} (cópia)`,
    luminarias: amb.luminarias.map((l) => ({ ...l, id: crypto.randomUUID() })),
    //                                     ^^^^^ only root id renewed; composicao[] shared
    sistemas: amb.sistemas.map((sis) => clonarSistemaParaAmbiente(sis)),
  };
}
```

`{ ...l, id: crypto.randomUUID() }` spreads the `ItemLuminaria` but does **not** clone `composicao[]` — so cloned luminarias share the same `ItemComposicao` array references (same `id` values). This would cause React key collisions and incorrect subtotal aggregation (D-06: "clones com randomUUID em toda a árvore").

**This is a pre-existing bug that Phase 21 must fix as part of DUP-01.** Fixing `clonarAmbiente` also fixes ambient duplication for compostos.

### New helper: `clonarItemLuminaria` [VERIFIED: pattern from clonarSistema at orcamento.ts:591]

```typescript
// New helper — orcamento.ts
/** Clona um ItemLuminaria com novos UUIDs em toda a árvore (raiz + composicao[]).
 *  composicao[] ausente → clona como item simples (backward-compat).
 *  Phase 21 / D-06. */
export function clonarItemLuminaria(item: ItemLuminaria): ItemLuminaria {
  return {
    ...item,
    id: crypto.randomUUID(),
    composicao: item.composicao?.map(c => ({ ...c, id: crypto.randomUUID() })),
  };
}
```

### Fix `clonarAmbiente` to use the new helper

```typescript
// orcamento.ts:614 — UPDATED
export function clonarAmbiente(amb: Ambiente): Ambiente {
  return {
    ...amb,
    id: crypto.randomUUID(),
    nome: `${amb.nome} (cópia)`,
    luminarias: amb.luminarias.map(clonarItemLuminaria),  // was: (l) => ({ ...l, id: ... })
    sistemas: amb.sistemas.map((sis) => clonarSistemaParaAmbiente(sis)),
  };
}
```

**This change is backward-compatible:** `clonarItemLuminaria` calls `composicao?.map(...)` — if `composicao` is `undefined` (old snapshots), it stays `undefined`. [VERIFIED: optional chaining pattern used throughout]

### DUP-01 orchestration in `Step2Ambientes`

`Step2Ambientes` is the owner of `ambientes[]` (D-05: destination = chosen environment). The `ComposicaoCard` does not know the ambient list. Flow:

1. **ComposicaoCard** receives a new prop `onDuplicate?: () => void` and renders the Trash2-adjacent duplicate button (D-04).
2. Clicking "duplicar" calls `onDuplicate()` — which is wired in `AmbienteCard` → passed up to `Step2Ambientes`.
3. **Step2Ambientes** opens a selector (environment list); user picks destination.
4. `Step2Ambientes` clones the `ItemLuminaria` via `clonarItemLuminaria(item)` and appends to the target `Ambiente.luminarias[]`.

**Selector logic:** If there is only 1 ambiente, no selector — insert into current. If multiple, show a simple `<Select>` or modal with environment names.

**Wire-up in AmbienteCard:** `AmbienteCard` needs to receive `ambientes` (all environments) and an `onDuplicarCompostoParaAmbiente(itemId: string, destinoAmbienteId: string): void` callback from `Step2Ambientes`. Alternatively (simpler): `AmbienteCard` fires `onDuplicarComposto(item: ItemLuminaria)` and `Step2Ambientes` handles destination selection.

**Recommended pattern:** `AmbienteCard` passes `onDuplicarComposto(item: ItemLuminaria)` upward. `Step2Ambientes` intercepts, shows selector if `ambientes.length > 1`, then inserts `clonarItemLuminaria(item)` into chosen ambiente. This is the minimal change to existing props surface.

---

## Existing Code Map (cite file:line)

### `Step2Ambientes.handleNext` — advisory loop [VERIFIED: Step2Ambientes.tsx:70–148]

```typescript
// Step2Ambientes.tsx:20–24 — CURRENT AdvisoryItem types
interface AdvisoryItem {
  ambienteNome: string;
  tipo: 'fita-sem-driver' | 'driver-sem-fita' | 'perfil-sem-fita' | 'peca-sem-lampada';
  descricao: string;
}
```

```typescript
// Step2Ambientes.tsx:120–139 — advisory loop (RES-05 / D-12..D-16)
const itensIncompletos: AdvisoryItem[] = [];
for (const amb of ambientesLimpos) {
  for (const sis of amb.sistemas) {   // only iterates sistemas[] — no composicao check
    if (sis.fita.codigo && !sis.driver.codigo) { ... }
    // ...
  }
  if (!ambienteTemLampada(amb)) {
    for (const lum of amb.luminarias) {
      if (luminariaPrecisaLampada(lum.descricao)) { ... }
    }
  }
}
```

**Extension for VAL-01 (D-02/D-03):** Add 3 new types to `AdvisoryItem.tipo` and a new loop after the existing `for (const sis of amb.sistemas)`:

```typescript
// New types to add:
tipo: '...' | 'composto-sem-driver' | 'composto-sem-conector' | 'modular-sem-fita'

// New loop after existing sistema loop — add at Step2Ambientes.tsx:~140
for (const lum of amb.luminarias) {
  if (!lum.composicao?.length) continue;
  const comp = lum.composicao;
  const sistema = lum.sistema ?? '';

  // D-03.1: composto magnético sem driver aplicado
  if ((sistema === 'magneto_48v' || sistema === 'tiny_magneto') &&
      !comp.some(c => c.papel === 'driver_recomendado')) {
    itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'composto-sem-driver', descricao: lum.descricao });
  }

  // D-03.2: conector obrigatório ausente
  const regras = REGRAS_COMPOSICAO[sistema];
  if (regras && !regras.conectoresObrigatorios.some(sku => comp.some(c => c.codigo === sku))) {
    itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'composto-sem-conector', descricao: lum.descricao });
  }

  // D-03.3: SYSTEM MOLD sem fita
  if (sistema === 's_mode') {
    const metragem = calcularMetragemModulosDifusos(comp);
    const temFita = comp.some(c => c.papel === 'fita_modular');
    if (metragem > 0 && !temFita) {
      itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'modular-sem-fita', descricao: lum.descricao });
    }
  }
}
```

Note: `REGRAS_COMPOSICAO` and `calcularMetragemModulosDifusos` need to be imported in `Step2Ambientes.tsx`.

### `ComposicaoCard.tsx` — where to insert modular panel [VERIFIED: ComposicaoCard.tsx:1–831]

Current structure:
- **Header** (line 582–619): badges MAGNETO 48V / TINY 24V + Sistema N + Carga badge + Trash2 button.
- **Body** (line 621–827): trilho âncora section, módulos list, "Adicionar módulo" button, driver panel, checklist.

For SYSTEM MOLD (`item.sistema === 's_mode'`):
- **Header** (line 586–618): Add new Badge `MODULAR` + add Duplicate button next to Trash2 (D-04).
- **Após módulos list** (new, after line 714): painel de fita derivada:
  - Shows `metragem = calcularMetragemModulosDifusos(composicao)` if > 0.
  - Shows existing fita (if `comp.find(c => c.papel === 'fita_modular')`).
  - Shows "Adicionar fita" button → opens `ProdutoAutocomplete filtro="fita"`.
  - On fita select: adds `ItemComposicao` with `papel='fita_modular'`, `comprimento=metragem`, then triggers driver busca.
- **Driver panel**: `renderPainelDriverModular()` — same pattern as 24V (`buscarDriverSugerido` replicated locally, scoped to `fita.voltagem`).
- **No checklist** for s_mode in this phase (Deferred: `REGRAS_COMPOSICAO['s_mode']`).

Current `is48V` / `is24V` pattern:
```typescript
// ComposicaoCard.tsx:69–71 — extend with:
const isModular = item.sistema === 's_mode';
```

### `AmbienteCard.handleSelectProdutoGlobal` — `'modular'` route [VERIFIED: AmbienteCard.tsx:324–446]

```typescript
// AmbienteCard.tsx:419–420 — CURRENT comment
// 'modular' (Phase 21), 'luminaria' e fallback (D-03): item simples, SEM composicao.
```

Change this to start a composição like the `magneto_48v`/`tiny_magneto` routes at line 391:
```typescript
if (tipo === 'modular') {
  const novaRaiz: ItemLuminaria = {
    id: uid(),
    codigo: produto.codigo, descricao: produto.descricao, quantidade: 1,
    precoUnitario: preco, precoMinimo: precoMin, imagemUrl: imgUrl,
    sistema: 's_mode',              // <-- key difference from magneto
    potencia_watts: null,           // modular has no potencia_watts
    tensao: produto.voltagem ?? null,
    composicao: [],                 // activates ComposicaoCard
  };
  onChange({ ...ambiente, luminarias: [...ambiente.luminarias, novaRaiz] });
  return;
}
```

`detectarTipoAncora` already returns `'modular'` when `produto.sistema_magnetico === 's_mode'` (orcamento.ts:177). After the migration, anchors (LM1998 etc.) will have `sistema='s_mode'` → `detectarTipoAncora` returns `'modular'` → this route fires.

### `useProdutoSearch` + `ProdutoAutocomplete` — busca de fita [VERIFIED: useProdutoSearch.ts:1–87]

```typescript
// useProdutoSearch.ts:5 — extend ProdutoFiltro
export type ProdutoFiltro = 'fita' | 'driver' | 'perfil' | 'conector' | 'kit_fixacao' | 'luminaria' | 'todos' | 'modulo_difuso';

// useProdutoSearch.ts:28–31 — add new branch
if (filtro === 'modulo_difuso') {
  queryBuilder = queryBuilder
    .eq('tipo_produto', 'acessorio')
    .eq('sistema', 's_mode');  // uses the 'sistema' column directly (not the alias)
}
```

Busca de fita no contexto modular: usa `filtro="fita"` (standard), not `filtro='modulo_difuso'`. The fita busca is the same as Fita Padrão — the user picks any fita SKU.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Comprimento parse from DB | Custom DB column | Parse description at add-time; snapshot in `ItemComposicao.comprimento` (already designed) |
| Driver suggestion for modular | New algorithm | Replicate `buscarDriverSugerido` query inline in ComposicaoCard (same 8-line Supabase query) |
| New UUID generation | Manual ID counters | `crypto.randomUUID()` — already used everywhere |
| Advisory dialog | New component | Extend existing `AlertDialog` in `Step2Ambientes.tsx` (already fully functional) |

---

## Common Pitfalls

### Pitfall 1: `filtroSistema='s_mode'` excludes difusos
**What goes wrong:** After migration, difusos have `sistema='s_mode'` AND `tipo_produto='acessorio'`. The `filtroSistema` path in `useProdutoSearch` includes `.is('tipo_produto', null)` — difusos are excluded.
**How to avoid:** Use `filtro='modulo_difuso'` (new value) for the difuso busca. Do NOT use `filtroSistema='s_mode'` for the "Adicionar módulo difuso" search.

### Pitfall 2: `clonarAmbiente` shares `composicao[]` references
**What goes wrong:** `clonarAmbiente` spreads each `ItemLuminaria` with a new root `id` but does NOT deep-clone `composicao[]`. The cloned luminaria shares the same `ItemComposicao` objects (same IDs). Mutations in one affect the other; React key collisions possible.
**How to avoid:** Use `clonarItemLuminaria` (new helper) inside `clonarAmbiente`. Also apply to `clonarAmbiente` so existing duplicate-ambiente feature works correctly for compostos.

### Pitfall 3: Tampas e KIT MODULAR caught by naive migration filter
**What goes wrong:** A migration `WHERE descricao ILIKE '%SYSTEM MOLD%' AND descricao ILIKE '%PERFIL%'` catches 50 rows including TAMPA CEGA SISTEMA PERFIL MODULAR (LM2004, LM2005, etc.) and spots PARA USO NO PERFIL MODULAR.
**How to avoid:** Use the precise filter from this research:
```sql
WHERE (descricao ILIKE '%PERFIL NOFRAME MODULAR%' OR descricao ILIKE '%PERFIL DE EMBUTIR MODULAR%')
```
This captures exactly 12 rows (verified).

### Pitfall 4: `papel` value for fita modular not in existing union
**What goes wrong:** `ItemComposicao.papel` is `'modulo' | 'driver_recomendado' | 'driver_obrigatorio' | 'conector_energia' | 'kit_fixacao' | 'acessorio_opcional'` (orcamento.ts:51). A new `'fita_modular'` value would require updating the CHECK constraint in `produto_composicao` table AND the TypeScript union.
**How to avoid:** Either (a) use `'acessorio_opcional'` as the papel for fita (no constraint change) and detect fita presence by `tipo_produto === 'fita'` in the snapshot, or (b) add `'fita_modular'` to both the TS union and the DB CHECK constraint. Option (b) is cleaner for the advisory check (D-03.3) and the PDF (Phase 22). **Recommendation:** Add `'fita_modular'` to the union (TS only — the `produto_composicao` CHECK constraint only applies to seeded suggestions, not to snapshot composicao items in `orcamentos.ambientes` jsonb).

### Pitfall 5: Stale closure in ComposicaoCard async fita+driver flow
**What goes wrong:** Adding fita triggers an async driver busca. If user interacts with the card during the await, `itemRef.current` may have diverged.
**How to avoid:** Same pattern used throughout `ComposicaoCard` — use `itemRef.current` (not `item`) inside async callbacks, and use the existing `cancelled` flag from the `useEffect` driver pattern.

### Pitfall 6: `s_mode` value not constrained by DB CHECK
**What goes wrong:** The `sistema` column has no CHECK constraint (verified: only `magneto_48v` and `tiny_magneto` exist as values; no constraint blocks new values). So `'s_mode'` inserts freely — this is actually the expected behavior (same as how `magneto_48v` was added without a constraint change).
**How to avoid:** Nothing to do — no constraint change needed for the migration.

---

## Architecture Patterns

### Pattern 1: SYSTEM MOLD Detection After Migration

```
User types "SYSTEM MOLD PERFIL NOFRAME MODULAR 1M BRANCO" in global search
  → useProdutoSearch returns LM1998 (now has sistema='s_mode')
  → produto.sistema_magnetico === 's_mode' (aliased)
  → detectarTipoAncora returns 'modular'
  → AmbienteCard.handleSelectProdutoGlobal routes to 'modular' branch
  → ItemLuminaria created with sistema='s_mode', composicao: []
  → AmbienteCard renders ComposicaoCard (item.composicao !== undefined)
  → ComposicaoCard detects isModular = item.sistema === 's_mode'
  → Shows modular panel (difuso busca, fita derivada, driver advisory)
```

### Pattern 2: Modular Busca for Difusos

```
ComposicaoCard: user clicks "+ Adicionar módulo difuso"
  → ProdutoAutocomplete filtro="modulo_difuso"
  → useProdutoSearch: .eq('tipo_produto', 'acessorio').eq('sistema', 's_mode')
  → Returns: LM2026, LM2107, LM2108, LM2270–LM2275, LM2490–LM2495
  → User selects LM2270 (264MM)
  → handleSelecionarModuloDifuso:
      const comprimento = parsearComprimentoModulo(produto.descricao)  // → 0.264m
      const novo: ItemComposicao = {
        ...,
        papel: 'modulo',
        obrigatorio: false,
        comprimento,          // snapshot: 0.264
        potenciaW: undefined, // difusos have no potencia_watts
      }
  → composicao updated
  → calcularMetragemModulosDifusos(composicao) recalculates → shows "Fita necessária: Xm"
```

### Pattern 3: Clone Composto entre Ambientes (DUP-01)

```
Step2Ambientes renders AmbienteCard with onDuplicarComposto={(item) => ...}
  → User clicks duplicate button in ComposicaoCard header
  → ComposicaoCard calls onDuplicate() → AmbienteCard calls props.onDuplicarComposto(item)
  → Step2Ambientes: if ambientes.length === 1 → insert into current
                    else → show ambiente selector (shadcn Select/Dialog)
  → User picks destination ambiente
  → Step2Ambientes: const clone = clonarItemLuminaria(item)
  → target ambiente.luminarias = [...target.luminarias, clone]
  → onChange(newAmbientes)
```

---

## Code Examples

### calcularMetragemModulosDifusos (new — orcamento.ts)

```typescript
// Source: design — follows calcularCargaComposicao pattern at orcamento.ts:183
export function calcularMetragemModulosDifusos(composicao: ItemComposicao[] | undefined): number {
  if (!composicao?.length) return 0;
  return composicao
    .filter(c => c.papel === 'modulo' && c.comprimento != null)
    .reduce((s, c) => s + (c.comprimento ?? 0) * c.quantidade, 0);
}
```

### clonarItemLuminaria (new — orcamento.ts)

```typescript
// Source: design — follows clonarSistema pattern at orcamento.ts:591
export function clonarItemLuminaria(item: ItemLuminaria): ItemLuminaria {
  return {
    ...item,
    id: crypto.randomUUID(),
    composicao: item.composicao?.map(c => ({ ...c, id: crypto.randomUUID() })),
  };
}
```

### parsearComprimentoModulo (local helper, ComposicaoCard or orcamento.ts)

```typescript
// Source: verified against all 15 difuso descriptions in live DB
function parsearComprimentoModulo(descricao: string): number | undefined {
  const mmMatch = descricao.match(/FITA LED\s+(\d+(?:[,.]\d+)?)\s*MM/i);
  if (mmMatch) return parseFloat(mmMatch[1].replace(',', '.')) / 1000;
  const mtMatch = descricao.match(/FITA LED\s+(\d+(?:[,.]\d+)?)\s*MT/i);
  if (mtMatch) return parseFloat(mtMatch[1].replace(',', '.'));
  return undefined;
}
```

Verified correct for all 15 difusos: `132MM→0.132`, `264MM→0.264`, `396MM→0.396`, `528MM→0.528`, `660MM→0.66`, `1MT→1.0`, `2MT→2.0`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| `'modular'` route in `handleSelectProdutoGlobal` falls through to item simples (AmbienteCard.tsx:420) | New: initiates `composicao: []` → activates ComposicaoCard | Enables SIST-03 |
| `clonarAmbiente` shallow-copies `luminarias[]` (root UUID only) | New: uses `clonarItemLuminaria` (deep-clones `composicao[]`) | Fixes pre-existing gap for DUP-01 + ambient duplication |
| No `'modulo_difuso'` filtro in `useProdutoSearch` | New: `filtro='modulo_difuso'` → `.eq('tipo_produto', 'acessorio').eq('sistema', 's_mode')` | Enables scoped difuso busca |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIST-03 | `calcularMetragemModulosDifusos` sums `comprimento × qtd` | unit | `npm run test -- --run --reporter=verbose -t "calcularMetragemModulosDifusos"` | ❌ Wave 0 |
| SIST-03 | `parsearComprimentoModulo` parses 132MM, 1MT correctly | unit | same file | ❌ Wave 0 |
| DUP-01 | `clonarItemLuminaria` generates new UUIDs for root + all composicao items | unit | `npm run test -- --run -t "clonarItemLuminaria"` | ❌ Wave 0 |
| DUP-01 | `clonarAmbiente` deep-clones composicao[] (regression guard) | unit | same file | ❌ Wave 0 |
| VAL-01 | Advisory loop detects composto-sem-driver, composto-sem-conector, modular-sem-fita | unit | `npm run test -- --run -t "advisory composto"` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `src/types/orcamento.test.ts` (or similar) — add tests for new helpers
- [ ] `tests/advisory-compostos.test.ts` — cover D-03 conditions

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — pure TypeScript + existing Supabase SDK)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sistema` column in `product_variants` has no CHECK constraint blocking `'s_mode'` | Migration SQL | If constrained: ALTER TABLE needed before UPDATE (same pattern as `kit_fixacao` in CAT-03 migration) |
| A2 | `papel='fita_modular'` can be added to TS union without DB constraint change (orcamentos.ambientes is jsonb, not FK-constrained) | Pitfall 4 | If DB CHECK applies to snapshots too: need ALTER TABLE produto_composicao — unlikely |
| A3 | `buscarDriverSugerido` replication in ComposicaoCard (8-line query) returns correct 24V driver for SYSTEM MOLD (fita is typically 24V) | D-01 | If SYSTEM MOLD requires different voltagem logic: adjust voltagem param |

---

## Sources

### Primary (HIGH confidence)
- Live Supabase DB queries via service role — product_variants table, jkewlaezvrbuicmncqbj — SYSTEM MOLD product breakdown, column values, sistema values [VERIFIED]
- `src/types/orcamento.ts` — `detectarTipoAncora` (line 173), `ItemComposicao` (line 43), `clonarAmbiente` (line 614), all calc functions [VERIFIED]
- `src/components/Step2Ambientes.tsx` — `AdvisoryItem` (line 20), `handleNext` (line 70), advisory loop (line 119–139) [VERIFIED]
- `src/components/ComposicaoCard.tsx` — full structure, `is48V`/`is24V`, driver panels, checklist [VERIFIED]
- `src/components/AmbienteCard.tsx` — `handleSelectProdutoGlobal` (line 324), `buscarDriverSugerido` (line 147) [VERIFIED]
- `src/hooks/useProdutoSearch.ts` — `ProdutoFiltro` (line 5), `filtroSistema` path (line 45–51) [VERIFIED]
- `supabase/migrations/20260612000001_cat03_tipo_produto_conector_kit.sql` — CAT-03 migration template [VERIFIED]

### Secondary (MEDIUM confidence)
- `.planning/phases/19-funda-o-compostos/19-CONTEXT.md` — D-02 (comprimento? field), D-03 (snapshot), D-07 (REGRAS_COMPOSICAO in code) [CITED]
- `.planning/phases/20-fluxos-magn-ticos/20-CONTEXT.md` — D-02 (detection routing), D-12 (voltage lock) [CITED]
- `.planning/STATE.md` — "Postgres NULL NOT IN = NULL (falsy)" lesson from Phase 20 verification [CITED]

---

## Metadata

**Confidence breakdown:**
- Detection / Migration: HIGH — verified against live DB (87 products analyzed, 12 anchors + 15 difusos confirmed)
- Metragem derivation: HIGH — `ItemComposicao.comprimento?` exists, parse verified against all 15 descriptions
- Clone gap: HIGH — `clonarAmbiente` source verified at line 614
- Advisory extension: HIGH — `handleNext` source verified at line 70, `AdvisoryItem` at line 20

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (stable — catalog data changes rarely; code is pinned to current commit)
