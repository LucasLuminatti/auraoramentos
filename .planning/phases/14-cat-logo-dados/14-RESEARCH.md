# Phase 14: Catálogo & Dados — Research

**Researched:** 2026-06-10
**Domain:** Supabase catalog data integrity + React toast/hint logic
**Confidence:** HIGH (all findings verified directly from source files in this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Varredura ampla com revisão prévia — corrigir toda a base de `tipo_produto` de forma definitiva, não apenas os 4 exemplos do UAT.
- **D-02:** Aprovação por grupos/regras, não SKU a SKU. Fluxo: (1) varredura ampla → agrupar por família/categoria/regra; (2) apresentar contagem de produtos afetados por grupo + `tipo_produto` alvo proposto; (3) Lenny aprova as regras por grupo; (4) migration final materializa lista explícita de SKUs/códigos com `UPDATE ... WHERE codigo IN (...)`.
- **D-02b:** WALL WASHER → `tipo_produto = 'perfil'` (o valor `'wall_washer'` não é aceito pelo CHECK; valores válidos: `fita, driver, perfil, spot, lampada, acessorio, conector, suporte`).
- **D-03:** Corrigir CAT-02 na causa raiz (dado OU código OU ambos) — sem workaround. Diagnosticar o produto MAGNETO real no banco antes de decidir onde corrigir.
- **D-04:** Antes/depois da migration, rodar `SELECT COUNT(*) GROUP BY tipo_produto` registrando quantos produtos mudaram.
- **D-05:** Validar (Playwright + manual) que WALL WASHER, CANTONEIRA, LM3475, LM3291 e MAGNETO aparecem na busca do seletor correto e que a dica do MAGNETO está certa.
- **D-06:** Confirmar que snapshots antigos permanecem intactos.
- **D-07:** Migration idempotente (guardas `WHERE`) e com nota de rollback documentada.

### Claude's Discretion

- Formato exato da query diagnóstica e do agrupamento (família/categoria/regra) apresentado para aprovação.
- Estrutura do arquivo de migration e nomenclatura (padrão `supabase/migrations/AAAAMMDD......sql`).
- Quais campos exibir na lista de revisão por grupo (sugestão: família, descrição-exemplo, `tipo_produto` atual → alvo, contagem).

### Deferred Ideas (OUT OF SCOPE)

- Montagem completa de sistemas compostos MAGNETO / TINY MAGNETO / MODULAR (seleção de módulos/conectores/drivers como um sistema) → v1.3 (SIST-01/02/03).
- PDF redesign.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Colaborador encontra na busca de perfil/driver TODOS os produtos da família (PERFIL CANTONEIRA, WALL WASHER, LM3475, LM3291), corrigindo `tipo_produto` errado/nulo via migration SQL aditiva | `useProdutoSearch.ts:27` confirms `.eq('tipo_produto', filtro)` — null/wrong value hides product. Fix is pure data: `UPDATE product_variants SET tipo_produto = 'perfil' WHERE ...` |
| CAT-02 | O aviso/dica exibido ao adicionar MAGNETO corresponde ao MAGNETO (não ao TINY MAGNETO) | `AmbienteCard.tsx:81-95` — branch order and regex patterns analyzed. Root cause: data column `sistema` on the MAGNETO product may be `'tiny_magneto'` instead of `'magneto_48v'`, OR the regex `/MAGNETO22/` at L81 fails to match a "MAGNETO" product whose description doesn't contain the string `"MAGNETO22"`. Both must be verified at execution time. |
</phase_requirements>

---

## Summary

Phase 14 has two tightly-scoped fixes: a catalog data repair (CAT-01) and a hint-text bug (CAT-02). Both are deterministic once the executor runs the diagnostic queries against the live Supabase project (`jkewlaezvrbuicmncqbj`).

**CAT-01** is entirely a data problem. `useProdutoSearch.ts` filters with `.eq('tipo_produto', filtro)` for `fita|driver|perfil`. Products with `tipo_produto = NULL` or an incorrect value (including the invalid `'wall_washer'` string) are silently excluded from those selectors. The fix is one idempotent SQL migration that UPDATEs `tipo_produto` (on `product_variants`, which the `produtos` view exposes) for all affected SKUs. No code changes required for CAT-01 if the data is correct.

**CAT-02** requires diagnosis first. The toast branch at `AmbienteCard.tsx:81` fires for MAGNETO 48V and at `AmbienteCard.tsx:89` fires for TINY MAGNETO. The field `produto.sistema_magnetico` is aliased from the DB column `sistema` (see `useProdutoSearch.ts:22`). If a MAGNETO 48V product has `sistema = 'tiny_magneto'` in the DB, the wrong branch fires regardless of the code. If the column is correct (`sistema = 'magneto_48v'`) but the regex fallback `/MAGNETO22/` doesn't match the real product description (e.g., description is "MAGNETO 48V" not "MAGNETO22"), the code branch at L81 evaluates the `sistema_magnetico` field first — so a correct DB value would still win. The exact failure mode must be confirmed by querying the live DB.

**Primary recommendation:** Run the diagnostic SQL block (provided below) before writing any migration. Use results to generate the group-approval list for D-02, then write a single `BEGIN/COMMIT` migration that is fully idempotent.

---

## Standard Stack

### Core (this phase)

| Component | Version | Purpose | Note |
|-----------|---------|---------|------|
| `product_variants` table | — | Real storage; `produtos` is a view over it | [VERIFIED: migrations/20260501000001_products_and_variants.sql] |
| `produtos` view | — | What `useProdutoSearch` queries; includes `ativo` filter via view rewrite | [VERIFIED: migrations/20260602000001_product_variants_ativo.sql] |
| `tipo_produto` column | `TEXT` + CHECK | Valid values: `fita, driver, perfil, spot, lampada, acessorio, conector, suporte` or NULL | [VERIFIED: migrations/20260319000001_campos_tecnicos_produtos.sql:66-68] |
| `sistema` column (aliased as `sistema_magnetico`) | `TEXT` + CHECK | Valid values: `padrao, tiny_magneto, magneto_48v, s_mode, trilha` or NULL | [VERIFIED: migrations/20260319000001_campos_tecnicos_produtos.sql:69-73] |

No new libraries needed. This phase is SQL + a targeted code fix (if data diagnosis confirms the code path is also wrong).

---

## Architecture Patterns

### How tipo_produto Filtering Works

`useProdutoSearch.ts:26-29` [VERIFIED]:

```typescript
if (filtro === 'fita' || filtro === 'driver' || filtro === 'perfil') {
  queryBuilder = queryBuilder.eq('tipo_produto', filtro);
} else if (filtro === 'luminaria') {
  queryBuilder = queryBuilder.or('tipo_produto.is.null,tipo_produto.in.(spot,lampada,acessorio,conector,suporte)');
}
```

**Consequence for CAT-01:** A product with `tipo_produto = NULL` or `tipo_produto = 'wall_washer'` (invalid — rejected by the CHECK constraint, so it cannot actually be stored) never appears in the perfil or driver selector. The selector does NOT do `ilike`-based family detection — it relies purely on the `tipo_produto` field value.

**Important:** `'wall_washer'` cannot actually be stored because of `check_tipo_produto`. So the real state is likely `tipo_produto = NULL` for these products, not the string `'wall_washer'`. The executor must verify with `SELECT tipo_produto FROM product_variants WHERE descricao ILIKE '%WALL WASHER%' LIMIT 5`.

### How the MAGNETO Hint Logic Works

`AmbienteCard.tsx:76-128` (function `handleSelectProdutoLuminaria`) [VERIFIED]:

```
L81: if (produto.sistema_magnetico === 'magneto_48v' || /MAGNETO22/.test(d))
       → shows MAGNETO 48V toast (correct)
L89: else if (produto.sistema_magnetico === 'tiny_magneto' || /TINY\s+MAG/.test(d))
       → shows TINY MAGNETO toast (wrong if product is actually MAGNETO 48V)
```

`produto.sistema_magnetico` is aliased in the SELECT query:
```typescript
// useProdutoSearch.ts:22
"sistema_magnetico:sistema, ..."
```

So `produto.sistema_magnetico` at runtime = the DB value in `product_variants.sistema`.

**Branch evaluation order matters:**
- If DB has `sistema = 'tiny_magneto'` on a MAGNETO 48V product → L81 is false (first condition), regex `/MAGNETO22/` tested against description. If description is "MAGNETO 48V TRILHO..." (not "MAGNETO22"), L81 is false entirely → falls through to L89 → TINY toast fires. **This is the most likely root cause.**
- If DB has `sistema = 'magneto_48v'` (correct) → L81 first condition is true → correct toast fires regardless of regex.
- If DB has `sistema = NULL` → both first conditions fail. Regex `/MAGNETO22/` tested. If product description doesn't contain "MAGNETO22" → no MAGNETO toast fires at all (silent miss).

**Code defect risk:** The regex `/MAGNETO22/` is likely too specific — it catches "MAGNETO22" literally but not a product described as "MAGNETO 48V" or "MAGNETO48V". However, since the first condition checks `sistema_magnetico` (the DB field), a correct DB value bypasses the regex entirely. Fix the DB `sistema` value first. If the DB value is already correct and the bug persists, then the regex at L81 must be broadened.

### Migration Idempotency Pattern

From `20260602000001_product_variants_ativo.sql` and others [VERIFIED]:

```sql
BEGIN;
-- Use IF NOT EXISTS for DDL; use WHERE guards for DML
UPDATE public.product_variants
  SET tipo_produto = 'perfil'
  WHERE codigo IN ('LM3475', 'LM3291', ...)     -- explicit list from approved groups
    AND (tipo_produto IS NULL OR tipo_produto != 'perfil');  -- idempotent guard
COMMIT;
```

**Rollback note pattern** (D-07): Every migration in this project includes a header comment block. The Phase 14 migration must include:
```sql
-- ROLLBACK: UPDATE public.product_variants SET tipo_produto = NULL WHERE codigo IN (...);
-- (or restore prior values if some SKUs had a non-null tipo_produto before this migration)
```

### Snapshot Isolation (D-06)

`orcamentos.ambientes` column is `jsonb NOT NULL DEFAULT '[]'::jsonb` [VERIFIED: migrations/20260416000001_orcamentos_ambientes_tipo.sql]:

```sql
COMMENT ON COLUMN public.orcamentos.ambientes IS 
  'Snapshot dos ambientes no momento da geração do PDF (Ambiente[] serializado).';
```

The jsonb snapshot stores the full `Ambiente[]` tree (including product descriptions, prices, codes) at save time. It has **no FK reference to `product_variants`** — it is a denormalized snapshot. Therefore, changing `tipo_produto` or `sistema` on a `product_variants` row has zero effect on any stored `orcamentos.ambientes` blob. Old orçamentos render from their own jsonb data. This is structural, not incidental. [VERIFIED from codebase]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent UPDATE | Custom dedup logic | `WHERE tipo_produto IS NULL OR tipo_produto != 'perfil'` guard | Re-runnable without side effects |
| Detecting valid tipo_produto values | Code-level enum | `check_tipo_produto` constraint (already in DB) | Enforced at DB level — invalid values rejected |
| Rollback of data changes | Manual steps | Rollback comment in migration header + pre-migration SELECT count | Auditable and scriptable |

---

## Diagnostic SQL (run before writing the migration)

The executor MUST run these queries against Supabase project `jkewlaezvrbuicmncqbj` before generating the migration. These are designed for D-01/D-02 (group-level approval) and D-03 (CAT-02 root cause).

### Query A — Count before (D-04 baseline)

```sql
SELECT tipo_produto, COUNT(*) AS total
FROM public.product_variants
GROUP BY tipo_produto
ORDER BY tipo_produto NULLS FIRST;
```

Save this output. Re-run after migration to compute delta.

### Query B — Catalog-wide null/suspect tipo_produto scan (D-01)

```sql
SELECT
  COALESCE(p.categoria, '(sem categoria)') AS categoria,
  COALESCE(pv.familia_perfil, '(sem familia)') AS familia_perfil,
  pv.tipo_produto AS tipo_atual,
  COUNT(*) AS qtd,
  MIN(pv.codigo) AS exemplo_codigo,
  MIN(pv.descricao) AS exemplo_descricao
FROM public.product_variants pv
LEFT JOIN public.products p ON pv.product_id = p.id
WHERE pv.tipo_produto IS NULL
   OR pv.tipo_produto NOT IN ('fita','driver','perfil','spot','lampada','acessorio','conector','suporte')
GROUP BY p.categoria, pv.familia_perfil, pv.tipo_produto
ORDER BY qtd DESC;
```

This groups by (categoria, familia_perfil, tipo_atual) and shows count + one example per group. The executor presents this table to Lenny with a proposed `tipo_produto` target per row. Lenny approves rules per group (D-02). Only then is the explicit SKU list materialized.

### Query C — Specific known families (confirm they're in the null scan)

```sql
SELECT codigo, descricao, tipo_produto, familia_perfil, sistema
FROM public.product_variants
WHERE descricao ILIKE ANY (ARRAY['%WALL WASHER%','%CANTONEIRA%','%LM3475%','%LM3291%'])
ORDER BY descricao;
```

### Query D — MAGNETO root cause (CAT-02, D-03)

```sql
SELECT codigo, descricao, tipo_produto, sistema, familia_perfil
FROM public.product_variants
WHERE descricao ILIKE '%MAGNETO%'
   OR sistema IN ('magneto_48v', 'tiny_magneto')
ORDER BY sistema, descricao;
```

**Decision rule from Query D results:**

| DB `sistema` on MAGNETO 48V product | Code L81 first condition | Result | Fix required |
|--------------------------------------|--------------------------|--------|--------------|
| `'tiny_magneto'` | false | TINY toast fires (bug) | Data: change `sistema` to `'magneto_48v'` |
| `'magneto_48v'` | true | Correct toast fires | No fix needed |
| `NULL` + description contains "MAGNETO22" | false (first) → true (regex) | Correct toast fires | No fix needed |
| `NULL` + description does NOT contain "MAGNETO22" | false (both) | No toast (silent miss) | Data + Code: set `sistema = 'magneto_48v'` AND consider broadening regex |

If the regex needs broadening, the safe replacement is: `/MAGNETO(?!\s*TINY)/i.test(d)` or check `sistema_magnetico === 'magneto_48v'` only (skip the regex entirely and rely on the DB field).

---

## Common Pitfalls

### Pitfall 1: Editing `produtos` view instead of `product_variants` table
**What goes wrong:** UPDATEs issued against the `produtos` view may fail or be silently ignored — PostgreSQL views are not directly updatable unless a rule/trigger exists.
**Why it happens:** The view `produtos` is defined over `product_variants`. Migrations that operated on `produtos` before Phase 3 now reference `product_variants`.
**How to avoid:** All DML (UPDATE/INSERT) in migrations MUST target `public.product_variants`, not `public.produtos`. [VERIFIED: view is defined in 20260602000001_product_variants_ativo.sql as SELECT-only]

### Pitfall 2: Assuming 'wall_washer' is stored in DB
**What goes wrong:** The CHECK constraint `check_tipo_produto` rejects any value not in `('fita','driver','perfil','spot','lampada','acessorio','conector','suporte')`. The string `'wall_washer'` cannot be stored. Searching for products with `tipo_produto = 'wall_washer'` returns zero rows.
**Why it happens:** The UAT report + CONTEXT.md use 'wall_washer' as a conceptual label for the family, not the actual DB value.
**How to avoid:** Query C above will show the real `tipo_produto` (expected: `NULL`) for WALL WASHER products. Target value must be `'perfil'` (D-02b).

### Pitfall 3: Migration targets `produtos` view for DDL
**What goes wrong:** `ALTER TABLE public.produtos ...` fails because `produtos` is a view.
**Why it happens:** Name confusion — the view is what the app queries, but DDL must target the underlying table.
**How to avoid:** Always use `public.product_variants` in migration DDL and DML. [VERIFIED: 20260602000001 modifies `product_variants` then recreates the view]

### Pitfall 4: Missing `BEGIN/COMMIT` transaction wrapper
**What goes wrong:** A partial migration applies some UPDATEs and fails mid-way, leaving the DB in an inconsistent state.
**Why it happens:** Forgetting the transaction block.
**How to avoid:** Wrap all DML in `BEGIN; ... COMMIT;`. [VERIFIED pattern: 20260602000001_product_variants_ativo.sql uses BEGIN/COMMIT]

### Pitfall 5: Hardcoded SKU list without a prior diagnostic run
**What goes wrong:** The migration hardcodes SKUs "WALL WASHER, LM3475, LM3291, CANTONEIRA" but misses the other 20+ products with null tipo_produto — phase is "completed" but catalog is still broken for those.
**Why it happens:** Skipping the broad diagnostic scan (D-01).
**How to avoid:** Query B is mandatory. Presents all null/suspect groups; executor shows to Lenny for group approval before materializing SKU list.

### Pitfall 6: CAT-02 code fix that masks a data problem
**What goes wrong:** Changing the regex in `AmbienteCard.tsx` to catch "MAGNETO" broadly, while leaving `sistema = 'tiny_magneto'` in the DB. The toast now shows correctly, but the persisted `ItemLuminaria.sistema` field (set at L124: `sistema: produto.sistema_magnetico ?? null`) still stores `'tiny_magneto'`, which may cause downstream issues (e.g., in `useValidarSistemas`).
**Why it happens:** Treating the symptom (wrong toast text) instead of the cause (wrong `sistema` value in DB).
**How to avoid:** Fix the DB `sistema` column first (migration). Adjust code only if the DB is correct and the bug persists. (D-03)

---

## Code Examples

### Idempotent migration structure (follow this pattern)

```sql
-- Migration: corrigir tipo_produto de perfis sem categoria + sistema de MAGNETO 48V
-- Phase 14 / Plan NN
-- ROLLBACK:
--   UPDATE public.product_variants SET tipo_produto = NULL
--     WHERE codigo IN (...approved list...);
--   UPDATE public.product_variants SET sistema = 'tiny_magneto'
--     WHERE codigo IN (...if any had that value before...);

BEGIN;

-- CAT-01: corrigir tipo_produto de perfis (grupos aprovados por Lenny)
UPDATE public.product_variants
  SET tipo_produto = 'perfil'
  WHERE codigo IN (
    -- list materialized from approved groups (Query B results)
    'LM3475', 'LM3291', ...
  )
  AND (tipo_produto IS NULL OR tipo_produto != 'perfil');

-- CAT-01: WALL WASHER family → 'perfil'
UPDATE public.product_variants
  SET tipo_produto = 'perfil'
  WHERE descricao ILIKE '%WALL WASHER%'
    AND (tipo_produto IS NULL OR tipo_produto != 'perfil');

-- CAT-01: driver families (if any null drivers found in Query B)
UPDATE public.product_variants
  SET tipo_produto = 'driver'
  WHERE codigo IN (...driver list...)
    AND (tipo_produto IS NULL OR tipo_produto != 'driver');

-- CAT-02: fix sistema column for MAGNETO 48V products (only if Query D shows 'tiny_magneto')
UPDATE public.product_variants
  SET sistema = 'magneto_48v'
  WHERE codigo IN (
    -- list from Query D results where sistema is wrong
    ...
  )
  AND sistema IS DISTINCT FROM 'magneto_48v';

COMMIT;
```

**Note on WALL WASHER UPDATE:** Using `ILIKE '%WALL WASHER%'` is acceptable if Query C confirms these products are identifiable by description. If other families are identified in Query B only by `codigo` (not description pattern), use the explicit `IN (...)` form for auditability (D-02 requires explicit SKU list).

### Diagnostic to verify post-migration (D-04)

```sql
-- Run this AFTER the migration; compare with Query A baseline
SELECT tipo_produto, COUNT(*) AS total
FROM public.product_variants
GROUP BY tipo_produto
ORDER BY tipo_produto NULLS FIRST;
```

### Code fix for CAT-02 (only if DB value is already correct after migration)

If after setting `sistema = 'magneto_48v'` on all MAGNETO 48V products the bug still manifests (meaning the `sistema_magnetico` field reaches the component as NULL or wrong), the regex at L81 should be broadened:

```typescript
// AmbienteCard.tsx L81 — current (brittle):
if (produto.sistema_magnetico === 'magneto_48v' || /MAGNETO22/.test(d)) {

// Replacement (matches 'MAGNETO' not preceded by 'TINY'):
if (produto.sistema_magnetico === 'magneto_48v' || (/MAGNETO/.test(d) && !/TINY/.test(d))) {
```

This is a secondary fallback. The primary fix is the data migration.

---

## Snapshot Isolation Confirmation (D-06)

**Claim:** Recategorizing a `product_variants` row does NOT affect saved orçamentos. [VERIFIED]

**Mechanism:**
1. `orcamentos.ambientes` is a `jsonb` column storing `Ambiente[]` serialized at save time. [VERIFIED: 20260416000001_orcamentos_ambientes_tipo.sql]
2. The jsonb blob contains full product descriptions, prices, and codes as plain values — not UUIDs or foreign keys pointing back to `product_variants`.
3. There is no trigger or view that re-joins `orcamentos.ambientes` against `product_variants` at read time.
4. PDF generation reads `orcamentos.ambientes` directly from the jsonb — it does not re-query the product catalog.

Therefore, after the migration: (a) new selectors will show corrected products; (b) existing orçamentos render unchanged from their stored jsonb.

---

## Migration File Naming

Following project conventions [VERIFIED: supabase/migrations/ directory listing]:
- Human-named migrations use pattern: `YYYYMMDDNNNNNN_slug.sql`
- Last migration: `20260602000001_product_variants_ativo.sql`
- Phase 14 migration should be: `20260610000001_tipo_produto_correcao_catalogos.sql` (or next available date)

If two tasks (CAT-01 data fix + CAT-02 data fix) can be applied in the same transaction, they go in one file. If CAT-02 requires a code change only (no data fix), it is a separate plan task, not a migration.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is data/code changes only. The Supabase project is already in production and accessible. Diagnostic queries must be run via Supabase SQL editor or `supabase db` CLI against project `jkewlaezvrbuicmncqbj`. No new environment dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| E2E | Playwright in `e2e/` — `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| CAT-01 | WALL WASHER/LM3475/LM3291/CANTONEIRA appear in perfil/driver selector after data fix | E2E (Playwright) | `npm run test:e2e` — existing selector test or new | Selector behavior depends on live DB; unit test of hook is insufficient |
| CAT-01 | tipo_produto count increases by N after migration | SQL verification | Manual SQL (Query A delta) | Not automatable as unit test |
| CAT-02 | Adding MAGNETO 48V product shows MAGNETO toast, not TINY | E2E (Playwright) | `npm run test:e2e` | Requires DB row with correct `sistema` |

### Sampling Rate

- **Per task commit:** `npm run test` (Vitest unit suite)
- **Per wave merge:** `npm run test:e2e` (Playwright against PROD or staging)
- **Phase gate:** Playwright test confirming all 4 product families appear in selectors + MAGNETO toast is correct

### Wave 0 Gaps

- [ ] `e2e/` — add or extend test: search "WALL WASHER" in perfil selector → assert result visible
- [ ] `e2e/` — add or extend test: add MAGNETO product → assert toast text contains "48V" / "Trilho magnético 48V", not "Tiny Mag"

*(If existing e2e tests already cover product selector search, extend those rather than creating new files.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS on `product_variants` — admin-only write; authenticated read. Migration runs as DB owner (Supabase migrations). |
| V5 Input Validation | yes | `check_tipo_produto` constraint enforces valid enum values at DB level |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| UPDATE without WHERE guard re-runs and corrupts data | Tampering | Idempotent `AND tipo_produto IS DISTINCT FROM 'perfil'` guard (D-07) |
| Admin privileges required for data migration | Elevation of privilege | Supabase migrations run as `postgres` role — outside RLS. RLS policies on `product_variants` are irrelevant here. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WALL WASHER products have `tipo_produto = NULL` (not `'wall_washer'`) in the live DB — since the CHECK constraint rejects `'wall_washer'` | Pitfall 2 | If somehow `'wall_washer'` exists (pre-constraint rows), Query C will surface it and the guard `AND tipo_produto IS DISTINCT FROM 'perfil'` handles it correctly regardless |
| A2 | The `produtos` view is not an updatable view — DML must target `product_variants` | Pitfall 1 | If Supabase auto-creates an INSTEAD OF trigger on the view, DML would work; but this is not the project pattern. Risk: LOW — confirmed view definition has no RULE or TRIGGER |
| A3 | MAGNETO 48V product description does not contain the string "MAGNETO22" — making the regex fallback at L81 ineffective | CAT-02 code analysis | Query D will confirm. If description IS "MAGNETO22...", code is fine and only data needs fixing. Either way, data fix is correct first step. |

**All critical claims were verified directly from source files in this session. The three ASSUMED entries above are about live DB row values that require Query D/C to resolve at execution time.**

---

## Open Questions (RESOLVED — deferred to execution; Plano 14-01 roda Queries B/D)

Ambas as perguntas abaixo são incógnitas do banco ao vivo que não podem ser resolvidas só a partir do código-fonte. Por design, o Plano 14-01 (diagnóstico) as resolve em runtime antes de qualquer DML: Query B materializa a lista de SKUs (pergunta 1) e Query D revela o valor de `sistema` do MAGNETO 48V (pergunta 2). Resolução estrutural, não pendência de planejamento.

1. **(RESOLVED via 14-01 Query B) Exact list of SKUs with null tipo_produto (CAT-01 scope)**
   - What we know: WALL WASHER, CANTONEIRA, LM3475, LM3291 are confirmed broken from UAT; D-01 requires a broad scan first
   - What's unclear: how many other families have null tipo_produto; which should become `perfil` vs `driver` vs other types
   - Recommendation: Executor runs Query B, presents group table to Lenny for approval before materializing the migration SKU list

2. **(RESOLVED via 14-01 Query D) MAGNETO 48V product's actual `sistema` column value (CAT-02 cause)**
   - What we know: code evaluates `sistema_magnetico` (= DB `sistema`) first at L81, then falls to the `'tiny_magneto'` branch at L89
   - What's unclear: is the DB value `'tiny_magneto'`, `NULL`, or `'magneto_48v'`?
   - Recommendation: Executor runs Query D first. Decision table in "Diagnostic SQL" section maps each outcome to the required fix.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: `src/hooks/useProdutoSearch.ts`] — filter mechanism, `sistema_magnetico` alias from `sistema` column
- [VERIFIED: `src/components/AmbienteCard.tsx:76-128`] — branch order, regex patterns, `sistema_magnetico` field usage
- [VERIFIED: `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql`] — `tipo_produto` column definition, `check_tipo_produto` constraint, valid values
- [VERIFIED: `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql`] — `sistema` column definition, `check_sistema` constraint, valid values
- [VERIFIED: `supabase/migrations/20260602000001_product_variants_ativo.sql`] — idempotent migration pattern (BEGIN/COMMIT, IF NOT EXISTS), `product_variants` is the real table
- [VERIFIED: `supabase/migrations/20260416000001_orcamentos_ambientes_tipo.sql`] — `orcamentos.ambientes` is denormalized jsonb snapshot, no FK to catalog
- [VERIFIED: `supabase/migrations/20260501000001_products_and_variants.sql`] — `produtos` was renamed to `product_variants`; `produtos` is now a view

### Secondary (MEDIUM confidence)
- None needed — all relevant claims verified from source files

### Tertiary (LOW confidence — needs live DB verification)
- The actual `tipo_produto` and `sistema` values for the specific broken products (WALL WASHER, MAGNETO 48V) — must be confirmed by running diagnostic queries at execution time

---

## Metadata

**Confidence breakdown:**
- Filter mechanism (how products are hidden): HIGH — read directly from source
- Hint/toast branch logic: HIGH — read directly from source
- Snapshot isolation claim: HIGH — verified from migration schema
- Actual DB row values for broken products: requires live query (not verifiable from code)
- Migration idempotency pattern: HIGH — confirmed from previous migration files

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable — only changes if schema or filter logic is modified)
