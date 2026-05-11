---
phase: 07-schema-prep-v1-1
plan: 03
subsystem: schema/migrations
tags: [migration, sql, schema, status-enum, check-constraint, AUTO-03, WIZ-04-unblock]
requirements: [AUTO-03]
dependency_graph:
  requires:
    - "supabase/migrations/20260213150619_c40f8f90-794b-4d08-90b8-635ef7968cc9.sql (definição original orcamentos.status TEXT NOT NULL DEFAULT 'rascunho')"
  provides:
    - "orcamentos.status enum {rascunho,aprovado,perdido,pendente} via CHECK constraint"
    - "Migração in-place fechado→aprovado preservando histórico"
  affects:
    - "Phase 10 / WIZ-04 (status badges em Pedidos) — terreno SQL pronto"
    - "src/types/orcamento.ts:109 — intencionalmente desatualizado; sync na Phase 10"
tech_stack:
  added: []
  patterns:
    - "Pre-flight assert via DO $$ ... RAISE EXCEPTION ... END $$ (padrão Drive D-02 errata v1.0)"
    - "ADD CHECK constraint sem ALTER COLUMN (schema continua aditivo, só dado muda)"
    - "BEGIN/COMMIT atomicidade por domínio (D-20)"
key_files:
  created:
    - "supabase/migrations/20260511000003_orcamentos_status_enum.sql"
  modified: []
decisions:
  - "D-10: UPDATE 'fechado'→'aprovado' in-place ANTES da CHECK (única mutação destrutiva de DADO; schema continua aditivo)"
  - "D-11: ADD CHECK constraint após o UPDATE — trava regressão futura (hoje status é TEXT livre)"
  - "D-12: Manter DEFAULT 'rascunho' (no-op intencional — zero mudança no wizard)"
  - "D-13: src/types/orcamento.ts:109 fica desatualizado de propósito; sync TS + regen supabase/types.ts é Phase 10 (WIZ-04)"
  - "D-14: Pre-flight assert RAISE EXCEPTION se aparecer status fora do enum — defesa contra dados inesperados em prod"
metrics:
  duration: "~5min"
  completed: "2026-05-11"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  commits: 1
---

# Phase 7 Plan 03: Orcamentos Status Enum Summary

**One-liner:** Migration aditiva que normaliza `orcamentos.status` para enum `{rascunho|aprovado|perdido|pendente}` via UPDATE in-place `fechado→aprovado` + pre-flight assert + CHECK constraint, preservando DEFAULT e sem alterar tipos TS (Phase 10 sincroniza).

## What Was Built

Criada 1 migration SQL pronta para `supabase db push` no Plan 07-04:

- **`supabase/migrations/20260511000003_orcamentos_status_enum.sql`** (54 linhas, BEGIN/COMMIT)
  - **Bloco 1 (D-10):** `UPDATE public.orcamentos SET status = 'aprovado' WHERE status = 'fechado'`
  - **Bloco 2 (D-14):** Pre-flight assert via `DO $$ ... RAISE EXCEPTION ... END $$` — aborta a transação se qualquer linha tiver status fora do enum
  - **Bloco 3 (D-11):** `ALTER TABLE ... ADD CONSTRAINT orcamentos_status_check CHECK (status IN ('rascunho','aprovado','perdido','pendente'))`
  - **Bloco 4 (D-12):** No-op explícito documentando que DEFAULT `'rascunho'` permanece intacto
  - **COMMENT** na coluna citando Phase 7 / AUTO-03 corolário / referência à Phase 10 (WIZ-04)

A ordem `UPDATE → ASSERT → ADD CHECK` é deliberada: se a CHECK fosse aplicada antes do UPDATE, falharia para todas as linhas com `'fechado'` legado. Se o ASSERT viesse antes do UPDATE, falharia também (porque `'fechado'` não está no enum). Ordem correta + atomicidade BEGIN/COMMIT garante que qualquer falha (assert RAISE, CHECK violation, etc) faz rollback completo.

## Tasks Executed

| Task | Name                                            | Status | Commit  | Files                                                                |
| ---- | ----------------------------------------------- | ------ | ------- | -------------------------------------------------------------------- |
| 1    | Criar migration orcamentos.status enum (D-10..D-14) | done   | c06c96d | `supabase/migrations/20260511000003_orcamentos_status_enum.sql` |

## Verification Results

**Automated (do plan `<verify>`):**
- `test -f supabase/migrations/20260511000003_orcamentos_status_enum.sql` → OK
- `grep "UPDATE public.orcamentos"` → 1 match
- `grep "ADD CONSTRAINT orcamentos_status_check"` → 1 match

**Acceptance criteria (all 13 satisfied):**
- Arquivo existe; contém UPDATE/SET aprovado/WHERE fechado; contém RAISE EXCEPTION + pre-flight assert; contém ADD CHECK constraint exato; contém COMMENT ON COLUMN; começa com `BEGIN;` (linha 10) e termina com `COMMIT;` (linha 54)
- **Negativos confirmados:** NÃO contém `ALTER COLUMN status`, `DROP DEFAULT`, `SET DEFAULT` — schema permanece aditivo, DEFAULT preservado
- **TS intocado:** `src/types/orcamento.ts` não foi modificado (D-13: Phase 10 cuida do sync)

**Push status:** Migration NÃO foi aplicada à produção. Plan 07-04 fará o `supabase db push` (terceiro/último na ordem D-21).

## Deviations from Plan

None — plan executado exatamente como escrito. SQL fornecido no `<action>` do plano foi gravado palavra por palavra.

## Decisions Made

| ID    | Decision                                                                                          | Rationale                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| D-10  | UPDATE in-place `'fechado'→'aprovado'`                                                            | Renomear o status legado preservando o histórico; única mutação destrutiva de DADO, schema continua aditivo |
| D-11  | ADD CHECK constraint após o UPDATE                                                                | Trava regressão futura; hoje a coluna é TEXT livre sem CHECK                                                |
| D-12  | Manter DEFAULT `'rascunho'`                                                                       | Zero mudança no wizard (Step3Revisao.tsx:224 continua gravando `'rascunho'` explícito)                      |
| D-13  | TS em `src/types/orcamento.ts:109` fica desatualizado de propósito                                | Phase 10 (WIZ-04) sincroniza tipo TS + regenera `supabase/types.ts` — fora do escopo desta migration aditiva |
| D-14  | Pre-flight assert ANTES da CHECK                                                                  | Defesa contra valores inesperados em prod (typos, status manual antigo); aborta a transação com mensagem clara |

## Phase 10 Sync Note

`src/types/orcamento.ts:109` continua como:

```ts
export type StatusOrcamento = 'rascunho' | 'fechado' | 'perdido';
```

Após `supabase db push` desta migration (Plan 07-04), o tipo TS estará temporariamente fora de sincronia com o DB (DB enforce `{rascunho,aprovado,perdido,pendente}`; TS reflete o estado antigo). Phase 10 (WIZ-04) deve:
1. Atualizar o union para `'rascunho' | 'aprovado' | 'perdido' | 'pendente'`
2. Re-gerar `src/integrations/supabase/types.ts` via `supabase gen types`
3. Tratar UI dos novos badges de status

Risco operacional durante o gap: zero — Step3Revisao.tsx:224 só grava `'rascunho'` (sempre válido); as queries de leitura usam `select('*')` e não restringem por valor literal de status.

## Threat Flags

Nenhuma surface de segurança nova introduzida — migration toca apenas integridade de dado interna (CHECK constraint) sem mexer em RLS, auth, endpoints ou storage policies.

## Self-Check: PASSED

- Arquivo `supabase/migrations/20260511000003_orcamentos_status_enum.sql` → FOUND
- Commit `c06c96d` → registrado neste worktree (verificado via `git rev-parse --short HEAD` após commit)
- Plano 07-03 verificações automatizadas + 13/13 critérios de aceitação satisfeitos
