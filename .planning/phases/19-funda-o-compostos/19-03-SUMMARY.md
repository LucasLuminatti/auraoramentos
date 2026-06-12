---
phase: 19-funda-o-compostos
plan: "03"
subsystem: database + documentation
tags: [migration, rls, produto_composicao, documentation, cat-03]

dependency_graph:
  requires:
    - "19-01: ItemComposicao data model + calcularSubtotalComposicao"
    - "19-02: CAT-03 migration (tipo_produto connectors/kits)"
  provides:
    - "produto_composicao table (empty, RLS authenticated-read/admin-write)"
    - "CAT-03 applied live (connectors + kit_fixacao categorized)"
    - "D-01 architecture decision documented in PROJECT.md"
  affects:
    - ".planning/PROJECT.md (Key Decisions table)"
    - "supabase DB ao vivo (2 migrations applied)"

tech_stack:
  added: []
  patterns:
    - "RLS has_role(auth.uid(), 'admin'::app_role) — replicated from 20260515000001 pattern"
    - "Migration applied via service role + migration repair (db push inseguro neste projeto)"

key_files:
  created:
    - supabase/migrations/20260612000002_produto_composicao_table.sql
    - .planning/phases/19-funda-o-compostos/19-03-SUMMARY.md
  modified:
    - .planning/PROJECT.md

decisions:
  - "D-01 documented: compostos in luminarias[].composicao? (not sistemas[]) — conservative arch, 5 calc sites untouched"
  - "Migration applied via service role (not db push) + migration repair — standard for this project"
  - "CAT-03 connector list EXPANDED beyond seed: all magneto_48v + tiny_magneto connectors categorized (audit revealed additional NULL tipo_produto in same families)"

metrics:
  duration: "continuation from blocking checkpoint (Task 2 resolved by Lenny)"
  completed_date: "2026-06-12"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 2
---

# Phase 19 Plan 03: Tabela produto_composicao + D-01 Documentation Summary

**One-liner:** Tabela `produto_composicao` vazia com RLS admin/authenticated aplicada ao vivo via service role, CAT-03 expandido para todas as famílias de conectores magneto, e decisão D-01 registrada no PROJECT.md com os 5 calc sites de Fita Padrão confirmados intocados.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Escrever migration produto_composicao | 6bdde7c | supabase/migrations/20260612000002_produto_composicao_table.sql |
| 2 | [BLOCKING] Aplicar 2 migrations via service role + audit + repair | (manual — Lenny) | DB ao vivo |
| 3 | Documentar D-01 em PROJECT.md Key Decisions | ed4d8fb | .planning/PROJECT.md |

## Live Verification Results (Task 2 — Applied by Lenny via service role)

### D1 — Table + RLS

```
to_regclass('public.produto_composicao') = produto_composicao
relrowsecurity = true
```

### D2 — Policies (pg_policies)

```
"admin write composicao" | cmd=ALL    | roles={authenticated}
"read composicao"        | cmd=SELECT | roles={authenticated}
```

### D3 — SKU Categorization (product_variants.tipo_produto)

CAT-03 migration applied. The connector list was **expanded** beyond the original seed after the live audit revealed additional same-family connectors with `tipo_produto=NULL`:

```
LM2337, LM2338, LM2339, LM2340, LM2341, LM2342  →  'conector'  (magneto_48v energy/elbow connectors)
LM3166, LM3167, LM3168, LM3169                  →  'conector'  (tiny_magneto energy/driver connectors)
LM2987                                           →  'kit_fixacao' (magnetic embed track spring kit)
```

### D4 — Constraint check_tipo_produto (after CAT-03)

```sql
CHECK (tipo_produto IS NULL OR tipo_produto IN (
  'fita','driver','perfil','spot','lampada','acessorio',
  'conector','suporte','kit_fixacao'
))
```

### Migration History (reconciled)

Both versions inserted into `supabase_migrations.schema_migrations` via `migration repair --status applied`:
- `20260612000001` — CAT-03 tipo_produto connectors + kit_fixacao
- `20260612000002` — produto_composicao table + RLS

Note: `product_variants.codigo` has UNIQUE constraint (`produtos_codigo_key`) — the FK in `produto_composicao` is valid.

## Task 3 — 5 Calc Sites Verification

`git diff d5efe57 -- src/types/orcamento.ts src/lib/pdfTemplates/v2.ts` was run against the pre-phase baseline commit.

**Result: ALL 5 calc sites are byte-identical.** The diff shows only:
- New additions: `ItemComposicao` interface, `REGRAS_COMPOSICAO` constant, `calcularSubtotalComposicao` function
- Single modified line: the `reduce` in `calcularTotalAmbienteSemFita` (adds `+ calcularSubtotalComposicao(i)`)

None of the 5 protected functions appear as removed or changed lines:
- `calcularDemandaFita` — untouched
- `calcularConsumoW` — untouched
- `calcularQtdDrivers` — untouched
- `calcularSubtotalSistemaSemFita` — untouched
- `isSistemaVazio` (v2.ts) — untouched

## Decisions Made

1. **D-01 (architecture anchor):** Compostos vivem em `luminarias[].composicao?`, não em `sistemas[]`. Documentado em PROJECT.md Key Decisions com verificação git diff.

2. **CAT-03 list expansion:** A auditoria ao vivo revelou conectores adicionais das mesmas famílias (magneto_48v e tiny_magneto) com `tipo_produto=NULL`. A migration `20260612000001` foi expandida para incluir todos (LM2337-LM2342 magneto; LM3166-LM3169 tiny). O arquivo em disco já reflete a lista expandida.

3. **Service role apply pattern:** Confirmado como o único caminho seguro neste projeto (`supabase db push` inseguro por histórico divergente). Padrão: SQL direto + `migration repair --status applied`.

## Deviations from Plan

### Auto-expanded Issues (Task 2 — Lenny during manual apply)

**1. [Rule 1 - Bug] CAT-03 connector list expanded beyond original seed**
- **Found during:** Task 2 live audit
- **Issue:** Live audit revealed additional magneto_48v and tiny_magneto connectors (LM2337, LM2339, LM2340, LM2341, LM2342, LM3166, LM3167) with `tipo_produto=NULL` in the same product families as the seed SKUs
- **Fix:** Migration `20260612000001` expanded to categorize all same-family connectors as `'conector'`
- **Files modified:** `supabase/migrations/20260612000001_cat03_tipo_produto_conector_kit.sql`
- **Applied:** Live DB via service role

## Known Stubs

None. This plan delivers infrastructure (DB table + RLS) and documentation. No UI or data-wired components.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond what is covered in the plan's `<threat_model>`. The `produto_composicao` table introduces a write surface gated by `has_role(auth.uid(), 'admin'::app_role)` as required by T-19-06. Policies verified live (D2 above).

## Self-Check: PASSED

- `supabase/migrations/20260612000002_produto_composicao_table.sql` — exists (committed 6bdde7c)
- `.planning/PROJECT.md` — D-01 row at line 155, footer updated at line 175 (committed ed4d8fb)
- `git log --oneline | grep ed4d8fb` — commit exists
- Live DB: `to_regclass('public.produto_composicao')` = non-NULL, `relrowsecurity` = true, 2 policies confirmed
- 5 calc sites: `git diff d5efe57` confirms zero removed/changed lines in protected functions
