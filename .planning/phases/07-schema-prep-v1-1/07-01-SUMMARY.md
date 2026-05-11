---
phase: 07-schema-prep-v1-1
plan: 01
subsystem: schema-migration
tags: [migration, rls-prep, multi-tenancy, user_id, arquitetos, clientes]
requirements: [RLS-03]
dependency_graph:
  requires:
    - "auth.users(id) — Supabase Auth"
    - "public.user_roles (role='admin')"
    - "public.colaboradores (user_id, created_at)"
    - "public.arquitetos (table existente, sem user_id)"
    - "public.clientes (table existente, sem user_id)"
  provides:
    - "public.arquitetos.user_id UUID NOT NULL (após push)"
    - "public.clientes.user_id UUID NOT NULL (após push)"
    - "idx_arquitetos_user_id (BTREE)"
    - "idx_clientes_user_id (BTREE)"
  affects:
    - "Phase 9 RLS-01/RLS-02 (consome user_id em policies)"
    - "Phase 7 Plan 04 (executa supabase db push em prod)"
tech-stack:
  added: []
  patterns:
    - "Drive D-02 errata template (Blocos 1-4): pre-flight assert + ADD COLUMN + backfill admin mais antigo + SET NOT NULL"
    - "Schema aditivo: coluna nova com NOT NULL aplicado só depois do backfill"
    - "Atomicidade por domínio: BEGIN/COMMIT envolvendo toda a migration"
key-files:
  created:
    - "supabase/migrations/20260511000001_arquitetos_clientes_user_id.sql"
  modified: []
decisions:
  - "D-01 implementado: FK ON DELETE RESTRICT (não SET NULL como Drive) — bloqueia delete de auth.user até admin reassignar"
  - "D-02 implementado: backfill admin mais antigo via ORDER BY colaboradores.created_at ASC LIMIT 1 (determinístico)"
  - "D-03 implementado: SET NOT NULL aplicado no Bloco 4, depois do backfill"
  - "D-04 implementado: 2 indexes BTREE (idx_arquitetos_user_id + idx_clientes_user_id)"
  - "D-05 implementado: COMMENT em ambas colunas citando Phase 7 RLS-03 + pattern Drive D-02 errata"
  - "D-06 implementado: ZERO RLS policies criadas/dropadas — fica para Phase 9 (RLS-01/RLS-02)"
  - "D-20 implementado: BEGIN/COMMIT garante atomicidade (rollback completo se qualquer bloco falhar)"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-11"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 7 Plan 01: Schema Prep — arquitetos+clientes user_id Summary

Migration aditiva pronta para push que adiciona `user_id UUID NOT NULL` em `arquitetos` e `clientes`, replicando o pattern Drive D-02 errata (Blocos 1-4 apenas), sem mexer em RLS policies (essas ficam para Phase 9).

## What Was Built

**Arquivo criado:** `supabase/migrations/20260511000001_arquitetos_clientes_user_id.sql` (86 linhas)

Conteúdo organizado em 4 blocos, espelhando o template Drive `20260504000001_drive_rls_user_id.sql`:

| Bloco | Função | Conteúdo |
|-------|--------|----------|
| 1 | Pre-flight assert | `DO $$ ... RAISE EXCEPTION` aborta se `admin_count = 0` em `user_roles INNER JOIN colaboradores WHERE role='admin'` |
| 2 | ADD COLUMN + indexes + comments | `user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT` (arquitetos + clientes), `CREATE INDEX idx_*_user_id`, `COMMENT ON COLUMN` |
| 3 | Backfill | 2x CTE `admin_user` com `ORDER BY colaboradores.created_at ASC LIMIT 1` + UPDATE legados |
| 4 | SET NOT NULL | 2x `ALTER COLUMN user_id SET NOT NULL` (arquitetos + clientes) |

Toda a migration encapsulada em `BEGIN; ... COMMIT;` para atomicidade (rollback total se qualquer bloco falhar — Drive D-20).

## Drive Template Adherence

**Blocos REPLICADOS** do `20260504000001_drive_rls_user_id.sql`:
- Bloco 1 (pre-flight) — pattern idêntico, só trocou comentário pra "Drive Pitfall 6"
- Bloco 2 (ADD COLUMN + indexes + comments) — só trocou nomes das tabelas e FK action (RESTRICT vs SET NULL)
- Bloco 3 (backfill admin mais antigo) — pattern CTE idêntico
- Bloco 4 (SET NOT NULL) — pattern idêntico

**Blocos IGNORADOS** do template Drive (D-06):
- Bloco 5 (RLS em cliente_arquivos) — Phase 9 RLS-01
- Bloco 6 (RLS em arquivo_pastas) — Phase 9 (não aplica direto, mas pattern de policies fica pra lá)
- Bloco 7 (bucket privado) — não aplica
- Bloco 8 (storage policies) — não aplica

## Divergência Consciente vs Drive

| Aspecto | Drive (20260504000001) | Phase 7 (20260511000001) | Razão |
|---------|------------------------|--------------------------|-------|
| FK ON DELETE | `SET NULL` | `RESTRICT` | Cliente/arquiteto carrega histórico de orçamentos — bloquear delete do auth.user até admin reassignar manualmente (D-01) |
| Policies criadas | Sim (Blocos 5-8) | Não | Phase 7 só prepara schema; policies de arquitetos/clientes ficam para Phase 9 (D-06) |

## Decisions Implemented

Todas as 6 decisões do CONTEXT (D-01 a D-06) foram implementadas conforme spec, e D-20 (atomicidade BEGIN/COMMIT) também:

- **D-01** ✅ `ON DELETE RESTRICT` em ambas FKs
- **D-02** ✅ Backfill com `ORDER BY c.created_at ASC LIMIT 1` (determinístico mesmo com múltiplos admins)
- **D-03** ✅ `SET NOT NULL` no Bloco 4, depois do backfill
- **D-04** ✅ 2 indexes BTREE com naming `idx_<tabela>_<coluna>`
- **D-05** ✅ COMMENT em ambas colunas citando "Phase 7 RLS-03 / pattern Drive D-02 errata"
- **D-06** ✅ ZERO policies criadas/dropadas (verificado com grep)
- **D-20** ✅ Atomicidade `BEGIN; ... COMMIT;`

## Verification Results

Critérios de aceitação do PLAN (todos via grep no arquivo gerado):

| Critério | Esperado | Obtido | Status |
|----------|----------|--------|--------|
| `RAISE EXCEPTION 'Migration aborted: no admin user found` | 1 | 1 | ✅ |
| `ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT` | 2 | 2 | ✅ |
| `CREATE INDEX idx_arquitetos_user_id` | 1 | 1 | ✅ |
| `CREATE INDEX idx_clientes_user_id` | 1 | 1 | ✅ |
| `ALTER COLUMN user_id SET NOT NULL` | 2 | 2 | ✅ |
| `COMMENT ON COLUMN public.arquitetos.user_id` | 1 | 1 | ✅ |
| `COMMENT ON COLUMN public.clientes.user_id` | 1 | 1 | ✅ |
| `BEGIN;` + `COMMIT;` | 2 | 2 | ✅ |
| `CREATE POLICY` (deve ser 0) | 0 | 0 | ✅ |
| `DROP POLICY` (deve ser 0) | 0 | 0 | ✅ |
| `ENABLE ROW LEVEL SECURITY` (deve ser 0) | 0 | 0 | ✅ |
| `ALTER TABLE public.arquitetos` | ≥2 | 2 | ✅ |
| `ALTER TABLE public.clientes` | ≥2 | 2 | ✅ |

Sintaxe SQL real só é validada no `supabase db push` (Plan 07-04).

## Deviations from Plan

None — plan executed exactly as written. Conteúdo SQL é literal do bloco `<action>` do PLAN.

## Push Note

**IMPORTANTE:** Esta plan NÃO executa `supabase db push`. O push em prod acontece no **Plan 07-04** (autonomous: false, Lenny executa manualmente após review da migration + snapshot pré-push). Esta plan só deixa o arquivo SQL pronto.

Ordem de push planejada para Plan 07-04 (do CONTEXT D-21):
1. `20260511000001_arquitetos_clientes_user_id.sql` ← este arquivo (mais delicado — pre-flight pode falhar primeiro)
2. `20260511000002_clientes_data_nascimento.sql` (Plan 07-02)
3. `20260511000003_orcamentos_status_enum.sql` (Plan 07-03)

## Commits

- `985751b` — feat(07-01): add migration arquitetos+clientes user_id (RLS-03)

## Self-Check: PASSED

- File exists: `supabase/migrations/20260511000001_arquitetos_clientes_user_id.sql` ✅
- Commit `985751b` in git log ✅
- All acceptance criteria pass (grep counts above) ✅
