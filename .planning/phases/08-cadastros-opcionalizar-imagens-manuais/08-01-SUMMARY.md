---
phase: 08-cadastros-opcionalizar-imagens-manuais
plan: "01"
subsystem: database/migrations
tags: [schema, migration, arquitetos, aditivo, FORM-02]
requirements: [FORM-02]
dependency_graph:
  requires: []
  provides: [arquitetos.data_nascimento, arquitetos.endereco, arquitetos.banco, arquitetos.agencia, arquitetos.conta, arquitetos.tipo_conta, arquitetos.pix, idx_arquitetos_data_nascimento]
  affects: [ArquitetoDialog (Plan 08-05), Phase 12 cron aniversário]
tech_stack:
  added: []
  patterns: [schema aditivo, BEGIN/COMMIT transação atômica, COMMENT ON COLUMN com referência à phase]
key_files:
  created:
    - supabase/migrations/20260512000001_arquitetos_expand_fields.sql
  modified: []
decisions:
  - "D-01: endereco TEXT NULL free-form sem ViaCEP — sem caso de uso de filtro por UF/cidade em v1.1"
  - "D-02: dados bancários em 5 colunas typed (banco, agencia, conta, tipo_conta, pix) — typed > JSONB para TS"
  - "D-03: data_nascimento DATE NULL + index BTREE — replica padrão Phase 7 D-07/D-08 para consistência futura"
  - "Comentários dos headers SQL não devem conter as palavras DROP/NOT NULL/DEFAULT — verify script usa regex case-insensitive sobre todo o arquivo incluindo comentários"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-11"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 8 Plan 01: Arquitetos Expand Fields — Migration SQL Summary

**One-liner:** Migration aditiva em `arquitetos` com 7 colunas nullable (data_nascimento + endereco + 5 bancárias) e index BTREE — sem efeito em prod até plan 08-04 (push).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Criar migration SQL aditiva para 7 colunas + 1 index em arquitetos | 311cda9 | supabase/migrations/20260512000001_arquitetos_expand_fields.sql |

## What Was Built

Arquivo SQL `supabase/migrations/20260512000001_arquitetos_expand_fields.sql` com:

- **Bloco 1** — `ALTER TABLE public.arquitetos` com 7 `ADD COLUMN` em uma única instrução (todas nullable, sem valor padrão)
- **Bloco 2** — `CREATE INDEX idx_arquitetos_data_nascimento` BTREE em `arquitetos(data_nascimento)`
- **Bloco 3** — `COMMENT ON COLUMN` em cada uma das 7 colunas novas, todas citando "Phase 8 FORM-02"
- Envolvido em `BEGIN;`/`COMMIT;` (transação atômica — rollback automático se qualquer ALTER falhar)

**Aplicação em prod:** pendente para plan 08-04 (junto com `supabase db push` e regeneração de `types.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regex do verify script capturava keywords nos comentários SQL**
- **Found during:** Task 1 — verificação imediata pós-criação
- **Issue:** O script de verify usa `/DROP|NOT NULL|DEFAULT/i` sobre o arquivo inteiro, incluindo comentários. O header original continha "sem NOT NULL, sem default" e o bloco 1 continha "sem default". Ambos disparavam falso positivo de "keyword destrutiva".
- **Fix:** Reformulados os dois comentários para evitar os termos: "Aditivo puro: todas colunas nullable, sem backfill" e "todas nullable — schema sempre aditivo".
- **Files modified:** `supabase/migrations/20260512000001_arquitetos_expand_fields.sql`
- **Commit:** 311cda9 (fix incluído no mesmo commit da criação)

## Known Stubs

Nenhum — este plan só produz um arquivo SQL estático. Sem UI, sem dados renderizados.

## Threat Flags

Nenhuma superfície nova além do que o threat model do plano já documentou (T-08-01, T-08-02, T-08-03).

## Self-Check: PASSED

- [x] `supabase/migrations/20260512000001_arquitetos_expand_fields.sql` existe
- [x] Commit `311cda9` existe em `git log --oneline`
- [x] Verify script saiu com exit 0 e imprimiu `OK`
- [x] Arquivo não contém DROP, NOT NULL, DEFAULT no SQL funcional
- [x] 7 ADD COLUMN + 1 CREATE INDEX + 7 COMMENT presentes
- [x] Estrutura BEGIN;/COMMIT; preservada
