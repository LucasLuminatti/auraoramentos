---
phase: 09-multi-tenancy-rls
plan: 03
subsystem: database
tags: [rls, postgres, supabase, migration, multi-tenancy, has_role]

# Dependency graph
requires:
  - phase: 04
    provides: "Drive RLS pattern (Blocos 5/6 de supabase/migrations/20260504000001_drive_rls_user_id.sql) — replicado 1:1"
  - phase: 07
    provides: "user_id NOT NULL + FK RESTRICT + index em arquitetos/clientes (migration 20260511000001)"
  - phase: 09
    provides: "09-02 PRE-PUSH snapshot (6 policies legadas confirmadas)"
provides:
  - "Migration SQL atômica (BEGIN/COMMIT) com 5 blocos: DEFAULT auth.uid + DROP legacy + ENABLE RLS + 4 policies arquitetos + 4 policies clientes"
  - "Pattern Drive replicado verbatim em arquitetos e clientes — base estrutural para multi-tenancy"
affects: [09-04, 09-05, 09-06, 10, 12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS via user_id direto + has_role(admin) — replicação verbatim do padrão Drive (D-01)"
    - "DEFAULT auth.uid() como cinto-e-suspensórios contra regressão em callers sem user_id explícito (D-04)"
    - "WITH CHECK strict no INSERT (user_id = auth.uid()) — admin NÃO pode criar em nome de outro colab (D-06)"

key-files:
  created:
    - "supabase/migrations/20260514000001_arquitetos_clientes_rls.sql"
  modified: []

key-decisions:
  - "Replicação literal do Drive (Blocos 5+6) ao invés de reimplementação — reduz risco de divergência sutil; pattern validado em prod desde Phase 4 (zero regressão em 14 dias)"
  - "Migration única atômica (BEGIN/COMMIT) — D-07: janela de DROP/CREATE não exposta a clients durante apply"
  - "Bloco ENABLE ROW LEVEL SECURITY mantido por idempotência mesmo já tendo sido aplicado em Phase 7 — D-03"
  - "DROP IF EXISTS suficiente (não DROP simples) — idempotência defensiva mesmo após PRE-PUSH confirmar exatamente os 6 nomes"

patterns-established:
  - "8 policies por tabela RLS-protected (SELECT/INSERT/UPDATE/DELETE × per-row + admin override)"
  - "COMMENT ON POLICY citando phase + requirement ID — auditável via `\\d+ tabela` ou query em pg_policies"

requirements-completed: [RLS-01, RLS-02]

# Metrics
duration: retroactive
completed: 2026-05-14
retroactive: true
---

# Phase 9 Plan 03: Migration SQL para RLS em arquitetos + clientes Summary

**Migration atômica (BEGIN/COMMIT) que adiciona DEFAULT `auth.uid()` em `user_id`, dropa 6 policies legadas e cria 8 policies novas (4 por tabela) replicando 1:1 o pattern Drive Blocos 5/6 — entrega RLS-01 (clientes) e RLS-02 (arquitetos).**

## Performance

- **Duration:** retroativa (commit original 2026-05-14T12:37:11-03:00 — sem timing de execução capturado)
- **Started:** 2026-05-14T15:30:00Z (ISO aproximado do commit)
- **Completed:** 2026-05-14T15:37:11Z (commit `31ef3bc`)
- **Tasks:** 1 (Escrever migration arquitetos+clientes RLS)
- **Files modified:** 1 (created)

## Accomplishments

- Migration SQL escrita com 5 blocos estruturais:
  1. **Bloco 1** — `ALTER COLUMN user_id SET DEFAULT auth.uid()` em ambas as tabelas (D-04)
  2. **Bloco 2** — 6 `DROP POLICY IF EXISTS` para policies legadas confirmadas em PRE-PUSH (D-02)
  3. **Bloco 3** — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` idempotente em ambas (D-03)
  4. **Bloco 4** — 4 `CREATE POLICY` em `arquitetos` (SELECT/INSERT/UPDATE/DELETE — RLS-02)
  5. **Bloco 5** — 4 `CREATE POLICY` em `clientes` (SELECT/INSERT/UPDATE/DELETE — RLS-01)
- 8 `COMMENT ON POLICY` — uma por policy, citando phase + requirement ID + referência ao padrão Drive D-02
- BEGIN/COMMIT atômico (D-07) — janela DROP/CREATE invisível para clients durante apply
- Pattern Drive replicado verbatim: nomes de policy (`Colabs read own X, admins read all`, `Colabs insert own X`, `Colabs update own X, admins update all`, `Colabs delete own X, admins delete all`), USING/WITH CHECK clauses idênticas

## Task Commits

1. **Task 1: Escrever migration arquitetos+clientes RLS** — `31ef3bc` (`feat(09-03): write RLS migration for arquitetos + clientes`)
   - Commit message documenta: BEGIN/COMMIT atomic (D-07), DEFAULT auth.uid (D-04), 6 DROP legacy (D-02), ENABLE RLS idempotent (D-03), 8 policies replicating Drive 1:1 (D-01), 8 COMMENT ON POLICY, threats T-09-C01..C03 mitigados

**Plan metadata (retroactive doc commit):** ver `git log` no commit `docs(09-03): SUMMARY for RLS migration`.

## Files Created/Modified

- `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql` (105 linhas) — migration completa Phase 9

## Migration Content Inventory

| Bloco | Action                                            | Count | Reference |
|-------|---------------------------------------------------|-------|-----------|
| 1     | `ALTER COLUMN user_id SET DEFAULT auth.uid()`     | 2     | D-04      |
| 2     | `DROP POLICY IF EXISTS`                           | 6     | D-02      |
| 3     | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`       | 2     | D-03      |
| 4     | `CREATE POLICY` em `arquitetos`                   | 4     | D-01 (Drive Bloco 5) |
| 5     | `CREATE POLICY` em `clientes`                     | 4     | D-01 (Drive Bloco 6) |
| 4+5   | `COMMENT ON POLICY`                               | 8     | RLS-01/RLS-02 traceability |

## Key Policy Pattern (replicado 1:1 do Drive)

Para cada tabela (`arquitetos`, `clientes`):

```sql
-- SELECT: dono OU admin
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))

-- INSERT: strict — admin NÃO pode criar em nome de outro (D-06)
WITH CHECK (user_id = auth.uid())

-- UPDATE: dono OU admin (com WITH CHECK simétrico)
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))

-- DELETE: dono OU admin
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
```

## Verification (post-facto, 2026-05-15)

Via MCP `mcp__plugin_supabase_supabase__execute_sql` em 2026-05-15:

- `pg_policies` mostra 4+4 = 8 policies novas com pattern acima — match exato com a prescrição da migration
- `pg_class.relrowsecurity = true` em ambas as tabelas
- `information_schema.columns.column_default = 'auth.uid()'` para `user_id` em ambas

Conclusão: o estado em prod hoje é exatamente o invariante prescrito pela migration. Implementação SQL validada estruturalmente.

## Decisions Made

- **Replicação literal vs. abstração.** Optou-se por replicar o pattern Drive verbatim (mesmas nomes de policy, mesmas clauses) ao invés de criar uma função/macro. Razão: pattern já validado em prod 14 dias; abstração adicionaria risco sem benefício (apenas 2 tabelas).
- **WITH CHECK strict no INSERT (D-06).** Admin NÃO consegue criar arquiteto/cliente em nome de outro colab. Transferência de propriedade só via UPDATE (que admin pode fazer). Trade-off: menos flexibilidade vs. menor superfície de ataque + paridade com Drive.
- **`has_role(auth.uid(), 'admin')` em SELECT/UPDATE/DELETE (não em INSERT).** Admin tem visão total, mas não pode criar registros como outro user. Replica Drive.

## Deviations from Plan

### Retroactive documentation gap

**1. [Retroactive] SUMMARY 09-03 não foi criado em 2026-05-14**
- **Found during:** Documentação retroativa 2026-05-15
- **Issue:** Migration foi commitada em `31ef3bc` (2026-05-14) com message detalhado, mas o `09-03-SUMMARY.md` formal nunca foi criado em `.planning/phases/09-multi-tenancy-rls/`.
- **Fix:** SUMMARY criado retroativamente em 2026-05-15 baseado no conteúdo verificável do SQL committed + verificação MCP do estado em prod.
- **Files modified:** `.planning/phases/09-multi-tenancy-rls/09-03-SUMMARY.md` (created retroactively)
- **Verification:** SQL inspecionado linha a linha; estado em prod confirma 100% do prescrito.
- **Committed in:** commit `docs(09-03): SUMMARY for RLS migration (already in repo + prod)`

---

**Total deviations:** 1 (gap de processo de documentação, retroativo — não afeta a migration em si).
**Impact on plan:** Nenhum impacto técnico. A migration SQL foi escrita conforme prescrito pelo plano e o estado em prod confirma o invariante alvo.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- 09-04 entregue (apply efetivo em 2026-05-14, documentado retroativamente)
- Próximo passo concreto: **09-05** (signup manual do segundo colaborador para preparar smoke RLS bilateral)

---
*Phase: 09-multi-tenancy-rls*
*Completed: 2026-05-14 (migration commitada) / 2026-05-15 (SUMMARY retroativo)*
