---
phase: 09-multi-tenancy-rls
plan: 03
subsystem: database/rls
tags: [rls, migration, sql, arquitetos, clientes, user_id, has_role]
dependency_graph:
  requires: [09-01 (callsite audit), 09-02 (PRE-PUSH snapshot)]
  provides: [supabase/migrations/20260514000001_arquitetos_clientes_rls.sql]
  affects: [09-04 (apply migration), 09-05 (smoke)]
tech_stack:
  added: []
  patterns: [Drive RLS pattern Blocos 5+6 replicado 1:1, BEGIN/COMMIT atomico, DEFAULT auth.uid() defesa em camadas]
key_files:
  created:
    - supabase/migrations/20260514000001_arquitetos_clientes_rls.sql
  modified: []
decisions:
  - "6 DROPs exatos usados (sem variantes defensivas extras) — PUSH-LOG 09-02 confirmou zero divergencias com D-02"
  - "Comentarios de bloco em ASCII puro (sem acentos) para evitar encoding issues em alguns clientes SQL"
  - "ENABLE ROW LEVEL SECURITY mantido idempotente mesmo ja estando true (defesa explicita)"
metrics:
  duration_minutes: 8
  completed_date: 2026-05-14
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 9 Plan 3: Write RLS Migration (arquitetos + clientes) Summary

**One-liner:** Migration SQL atomica com DEFAULT auth.uid(), 6 DROPs de policies legadas confirmados e 8 policies novas replicando Drive Blocos 5+6 1:1 — pronta para apply em 09-04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Escrever migration arquitetos+clientes RLS | 31ef3bc | supabase/migrations/20260514000001_arquitetos_clientes_rls.sql |

## Migration Structure

### Filename
`supabase/migrations/20260514000001_arquitetos_clientes_rls.sql`

### Blocos (BEGIN/COMMIT atomico)

| Bloco | Descricao | Statements |
|-------|-----------|------------|
| 1 | DEFAULT auth.uid() em user_id | 2x ALTER COLUMN SET DEFAULT |
| 2 | DROP policies legadas | 6x DROP POLICY IF EXISTS |
| 3 | ENABLE ROW LEVEL SECURITY idempotente | 2x ALTER TABLE ENABLE RLS |
| 4 | Policies em arquitetos (RLS-02) | 4x CREATE POLICY + 4x COMMENT ON POLICY |
| 5 | Policies em clientes (RLS-01) | 4x CREATE POLICY + 4x COMMENT ON POLICY |

### Contagem de policies criadas

| Tabela | Policies | Requirement |
|--------|----------|-------------|
| public.arquitetos | 4 (SELECT + INSERT + UPDATE + DELETE) | RLS-02 |
| public.clientes | 4 (SELECT + INSERT + UPDATE + DELETE) | RLS-01 |
| **Total** | **8** | |

### DROP IF EXISTS (DROPs confirmados)

| Policy | Tabela | Fonte |
|--------|--------|-------|
| Anyone can read arquitetos | arquitetos | 09-PUSH-LOG PRE-PUSH snapshot |
| Admins can manage arquitetos | arquitetos | 09-PUSH-LOG PRE-PUSH snapshot |
| Anyone can read clientes | clientes | 09-PUSH-LOG PRE-PUSH snapshot |
| Authenticated users can insert clientes | clientes | 09-PUSH-LOG PRE-PUSH snapshot |
| Authenticated users can update clientes | clientes | 09-PUSH-LOG PRE-PUSH snapshot |
| Authenticated users can delete clientes | clientes | 09-PUSH-LOG PRE-PUSH snapshot |

**Divergencia com D-02 absorvida:** Nao — zero divergencias confirmadas por 09-02. 6 DROPs exatos, sem adicionar variantes extras.

## Acceptance Criteria

| Criterio | Status |
|----------|--------|
| File exists | PASS |
| BEGIN; / COMMIT; presentes | PASS |
| ALTER arquitetos DEFAULT auth.uid() | PASS |
| ALTER clientes DEFAULT auth.uid() | PASS |
| 8x CREATE POLICY | PASS |
| 2x ALTER TABLE ENABLE ROW LEVEL SECURITY (statements) | PASS |
| 2x WITH CHECK (user_id = auth.uid()) strict no INSERT | PASS |
| 8x public.has_role(auth.uid(), 'admin') (6+ em SELECT+UPDATE+DELETE) | PASS (8) |
| 6x DROP POLICY IF EXISTS | PASS |
| 8x COMMENT ON POLICY | PASS |
| Sem SET NOT NULL | PASS |
| Sem ADD COLUMN user_id | PASS |

## Threat Coverage

| Threat | Mitigacao na migration |
|--------|----------------------|
| T-09-C01 (Elevation: INSERT user_id arbitrario) | WITH CHECK strict `user_id = auth.uid()` em INSERT de ambas as tabelas |
| T-09-C02 (Info disclosure: janela DROP/CREATE) | BEGIN/COMMIT atomico — DROP e CREATE na mesma transacao |
| T-09-C03 (Tampering: DEFAULT em contexto anon) | Sem policy TO anon; RLS bloqueia INSERT anon por default |
| T-09-C04 (Repudiation: admin cross-user) | Aceito (D-06 rejeita; admin transere via UPDATE com updated_at audit trail) |
| T-09-C05 (Bypass via SD function) | Aceito (has_role e a unica SD function, validada em prod desde Phase 4) |

## Deviations from Plan

Nenhuma — plano executado exatamente como especificado. PUSH-LOG 09-02 confirmou zero divergencias com D-02, portanto os 6 DROPs do template foram usados sem modificacao.

## Known Stubs

Nenhum — arquivo SQL puro, sem valores hardcoded ou placeholders.

## Self-Check

**File exists:**
- [x] `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql` — FOUND

**Commit exists:**
- [x] `31ef3bc` — FOUND (feat(09-03): write RLS migration for arquitetos + clientes)

## Self-Check: PASSED
