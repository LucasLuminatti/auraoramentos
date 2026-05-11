# Phase 7 — Push Log

**Project:** AURA (Supabase prod `jkewlaezvrbuicmncqbj`, region sa-east-1)
**Push command:** `supabase db push`
**Date:** 2026-05-11 (BRT)
**Operator:** Lenny Wajcberg
**Push order (D-21):** user_id → data_nascimento → status

## Migration push order

| # | Migration | Domain | Risk | Outcome |
|---|-----------|--------|------|---------|
| 1 | 20260511000001_arquitetos_clientes_user_id.sql | RLS-03 (user_id em arquitetos+clientes) | Alta (pre-flight + backfill) | **OK** |
| 2 | 20260511000002_clientes_data_nascimento.sql | AUTO-03 (data_nascimento) | Baixa (aditivo trivial) | **OK** |
| 3 | 20260511000003_orcamentos_status_enum.sql | AUTO-03 corolário (CHECK enum) | Média (UPDATE in-place + assert) | **OK** |

**Output `supabase db push`:**
```
Initialising login role...
Connecting to remote database...
Applying migration 20260511000001_arquitetos_clientes_user_id.sql...
Applying migration 20260511000002_clientes_data_nascimento.sql...
Applying migration 20260511000003_orcamentos_status_enum.sql...
Finished supabase db push.
```

## Snapshot counts (pré-push vs pós-push)

| Tabela | Pré-push | Pós-push | Diff | OK? |
|--------|----------|----------|------|-----|
| clientes | 4 | 4 | 0 | **YES** |
| arquitetos | 0 | 0 | 0 | **YES** |
| orcamentos | 4 | 4 | 0 | **YES** |
| product_variants | 4975 | 4975 | 0 | **YES** |

## Status distribution (orcamentos)

| Status | Pré-push | Pós-push | Notas |
|--------|----------|----------|-------|
| rascunho | 4 | 4 | mantém |
| fechado | 0 | 0 | UPDATE → aprovado (D-10) foi no-op (nenhuma linha tinha 'fechado') |
| aprovado | 0 | 0 | enum permite, ainda não usado |
| perdido | 0 | 0 | enum permite, ainda não usado |
| pendente | 0 | 0 | enum permite, ainda não usado |

## Schema confirmation (information_schema)

| Coluna | Esperado | Confirmado |
|--------|----------|------------|
| `arquitetos.user_id` | UUID, NOT NULL | ✓ uuid / NO |
| `clientes.user_id` | UUID, NOT NULL | ✓ uuid / NO |
| `clientes.data_nascimento` | DATE, NULLABLE | ✓ date / YES |
| `orcamentos_status_check` | CHECK (status IN (...)) | ✓ `CHECK ((status = ANY (ARRAY['rascunho'::text, 'aprovado'::text, 'perdido'::text, 'pendente'::text])))` |

## Indexes criados

| Index | Confirmado |
|-------|------------|
| `idx_arquitetos_user_id` BTREE | ✓ (1 entry em pg_indexes) |
| `idx_clientes_user_id` BTREE | ✓ |
| `idx_clientes_data_nascimento` BTREE | ✓ |

## Pre-flight asserts (executados dentro das migrations)

- `arquitetos`/`clientes` user_id: pre-flight verifica `EXISTS (SELECT 1 FROM user_roles WHERE role='admin')` antes do backfill — 2 admins em prod ✓
- `orcamentos` status: pre-flight verifica que nenhum status fora do enum-alvo permanece após o UPDATE — 0 linhas fora ✓

## Comments (rastreabilidade)

Aplicados via `COMMENT ON COLUMN` dentro de cada migration:
- `arquitetos.user_id`: cita "Phase 7 RLS-03 / pattern Drive D-02 errata"
- `clientes.user_id`: idem
- `clientes.data_nascimento`: cita "Phase 7 AUTO-03 / cron Phase 12"
- `orcamentos.status`: cita enum + UPDATE fechado→aprovado + Phase 10 sync TS (D-13)

## Issues encontrados

(nenhum) — 3 migrations aplicaram cleanly, zero diff em counts, schema confirmado, pre-flight passou.

## Foot notes

- `arquitetos` está vazia em prod (0 linhas) — ADD COLUMN NOT NULL sem backfill issue
- `orcamentos.status='fechado'` em prod era 0 antes do push → UPDATE in-place foi no-op (esperado para v1.0 + v1.1 sem deals fechados ainda)
- Migration 1 também foi a única que tinha backfill ativo (sobre `clientes` 4 linhas); todas receberam o admin mais antigo como `user_id`

---
*PUSH-LOG gerado pós-execução interativa do Plan 07-04 Task 2. Push em prod realizado por Lenny Wajcberg; validações executadas via Supabase MCP `execute_sql`.*
