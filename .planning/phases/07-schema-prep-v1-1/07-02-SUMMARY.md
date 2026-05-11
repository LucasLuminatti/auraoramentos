---
phase: 07
plan: 02
subsystem: schema/migrations
tags: [schema, migration, clientes, aniversario, additive]
requires: []
provides: [clientes.data_nascimento, idx_clientes_data_nascimento]
affects: [supabase/migrations]
tech_stack_added: []
patterns: [additive_migration_pattern_v1.0, btree_index, column_comment_with_phase_ref]
key_files_created:
  - supabase/migrations/20260511000002_clientes_data_nascimento.sql
  - .planning/phases/07-schema-prep-v1-1/07-02-PLAN.md
  - .planning/phases/07-schema-prep-v1-1/07-02-SUMMARY.md
key_files_modified: []
decisions:
  - "DATE NULL sem default, sem backfill (D-07)"
  - "BTREE simples; index funcional MONTH/DAY adiado (D-08)"
  - "COMMENT cita Phase 7 AUTO-03 + Phase 12 (D-09)"
  - "Migration NÃO pushada nesta wave — push centralizado em plan 07-04"
metrics:
  duration_minutes: 5
  tasks_completed: 1
  files_created: 3
  files_modified: 0
  completed_date: "2026-05-11"
---

# Phase 7 Plan 02: clientes.data_nascimento + index — Summary

## One-Liner

Migration aditiva criando `clientes.data_nascimento DATE NULL` + index BTREE `idx_clientes_data_nascimento`, desbloqueando Phase 12 (cron de aniversário). Sem backfill, sem default, sem UI.

## What Was Built

### `supabase/migrations/20260511000002_clientes_data_nascimento.sql`

Migration aditiva pura em 3 blocos dentro de `BEGIN/COMMIT`:

1. **Bloco 1 — ADD COLUMN**: `ALTER TABLE public.clientes ADD COLUMN data_nascimento DATE` (nullable, sem default — D-07)
2. **Bloco 2 — Index BTREE**: `CREATE INDEX idx_clientes_data_nascimento ON public.clientes(data_nascimento)` (BTREE simples — D-08)
3. **Bloco 3 — COMMENT**: rastreabilidade da decisão referenciando Phase 7 AUTO-03 + consumo futuro em Phase 12

Sem pre-flight assert, sem backfill, sem `NOT NULL` — campo é genuinamente opcional. O admin preenche via FORM-02 (Phase 8).

## How It Works

- **Aditivo**: registros existentes em prod permanecem válidos com `data_nascimento = NULL`. Zero risco de regressão de queries existentes.
- **Index BTREE simples**: Phase 12 (cron de aniversário) vai rodar diariamente filtrando por mês/dia. Para o volume atual de clientes (centenas), BTREE simples basta. Se profiling indicar latência, Phase 12 pode trocar por index funcional `EXTRACT(MONTH FROM data_nascimento), EXTRACT(DAY FROM data_nascimento)`.
- **COMMENT no Postgres**: padrão v1.0 — toda coluna nova ganha COMMENT citando fase + decisão. Rastreabilidade direto no schema.

## Commits

| Commit    | Type | Message                                                    |
| --------- | ---- | ---------------------------------------------------------- |
| `bf4c928` | docs | scaffold plan for clientes.data_nascimento migration       |
| `eeea208` | feat | add clientes.data_nascimento DATE + BTREE index            |

## Verification Performed

- [x] Arquivo `supabase/migrations/20260511000002_clientes_data_nascimento.sql` criado
- [x] `grep -E "ADD COLUMN data_nascimento DATE"` retornou match
- [x] `grep -E "CREATE INDEX idx_clientes_data_nascimento"` retornou match
- [x] `grep -E "COMMENT ON COLUMN"` retornou match
- [x] Migration envolvida em `BEGIN/COMMIT` (atomicidade — padrão v1.0)
- [x] `supabase db push` **NÃO** rodado (reservado para plan 07-04 — push centralizado da wave)

## Deviations from Plan

Nenhuma. Plan executado exatamente como escrito.

## Deferred / Out of Scope

- **Push da migration em prod**: reservado para plan 07-04 (push centralizado das 3 migrations da phase com PUSH-LOG + smoke).
- **Tipo TypeScript em `Cliente`**: tabela `clientes` não tem tipo manual em `src/types/orcamento.ts`; types autogerados em `src/integrations/supabase/types.ts` serão regenerados pós-push (Phase 8 quando FORM-02 consumir o campo).
- **Index funcional MONTH/DAY**: descartado como premature optimization (D-08). Phase 12 revisita se profiling pedir.
- **FORM-02 (admin edita data_nascimento)**: Phase 8 entrega.
- **Edge function de aniversário + cron**: Phase 12 entrega.

## Threat Flags

Nenhum. Migration aditiva pura, sem mudança de RLS, sem nova superfície de auth/network.

## Known Stubs

Nenhum.

## Self-Check: PASSED

- [x] `supabase/migrations/20260511000002_clientes_data_nascimento.sql` FOUND
- [x] `.planning/phases/07-schema-prep-v1-1/07-02-PLAN.md` FOUND
- [x] Commit `bf4c928` FOUND in `git log --all`
- [x] Commit `eeea208` FOUND in `git log --all`
