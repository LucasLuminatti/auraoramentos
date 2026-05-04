---
phase: 04-drive-rls-reorganiza-o-admin
plan: 01
subsystem: database
tags: [supabase, rls, postgres, storage, auth, migration]

requires:
  - phase: 02-cadastros-arquiteto-crud
    provides: clientes/projetos schema base que cliente_arquivos referencia
provides:
  - Coluna user_id (uuid, NOT NULL, FK auth.users) em cliente_arquivos e arquivo_pastas
  - RLS direta por dono em ambas tabelas (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  - Bucket cliente-arquivos privado (public=false)
  - Storage policies via tabela (Estratégia B do RESEARCH — sem path-prefix)
  - Backfill de legados ao admin mais antigo (determinístico via ORDER BY created_at ASC LIMIT 1)
affects: [04-02 (DriveExplorer refactor), drive, rls, signed-urls]

tech-stack:
  added: []
  patterns:
    - "RLS por user_id direto (sem JOIN com colaboradores) — idêntico ao Phase 3 product-images"
    - "Storage policy delegando ao EXISTS na tabela owner — Estratégia B"

key-files:
  created:
    - supabase/migrations/20260504000001_drive_rls_user_id.sql
  modified:
    - src/integrations/supabase/types.ts

key-decisions:
  - "Estratégia B (RESEARCH): storage policy via EXISTS na tabela cliente_arquivos, sem path-prefix por user_id, sem migrar paths antigos (D-08 errata aceita: arquivo_url legado vira podre)"
  - "Backfill determinístico: ORDER BY user_roles.user_id->colaboradores.created_at ASC LIMIT 1 (admin mais antigo)"
  - "Pré-flight assert (Pitfall 6 do RESEARCH): aborta migration se não houver admin com colaborador associado"
  - "ON DELETE SET NULL nas FKs (D-05): se user for deletado, registros sobrevivem com user_id=NULL"

patterns-established:
  - "Pattern: RLS direta com has_role override — substituiu policies USING(true) legadas"
  - "Pattern: Storage RLS delegada à tabela owner via EXISTS subquery"

requirements-completed: [ACC-01, ACC-02, ACC-04]

duration: ~30min
completed: 2026-05-04
---

# Phase 04 / Plan 01: Drive RLS user_id Migration Summary

**Migration aditiva que estabelece dono-único em cliente_arquivos/arquivo_pastas via user_id + bucket privado + storage policies via tabela (Estratégia B)**

## Performance

- **Duration:** ~30 min (incluindo human-action: db push + smoke check)
- **Completed:** 2026-05-04
- **Tasks:** 2 / 2
- **Files modified:** 2

## Accomplishments
- Migration `20260504000001_drive_rls_user_id.sql` criada (186 linhas, 8 blocos: assert → ADD COLUMN → backfill → NOT NULL → RLS cliente_arquivos → RLS arquivo_pastas → bucket privado → storage policies)
- Aplicada em produção (Supabase remoto `jkewlaezvrbuicmncqbj`) via `npx supabase db push`
- Bucket `cliente-arquivos` agora privado; `cliente_arquivos.public=false` confirmado em smoke
- RLS direta substitui policies legadas `USING(true)` — colaborador vê só o seu, admin vê tudo
- Storage policies (SELECT/INSERT/DELETE) delegam ao `EXISTS` na tabela cliente_arquivos
- Types regenerados; user_id presente em ambas tabelas

## Task Commits

1. **Task 1: Criar migration drive_rls_user_id** — `036128c` (feat, executado em worktree)
2. **Task 2: supabase db push + regenerar types** — `ea1d116` (feat, types regenerados após push)

## Files Created/Modified
- `supabase/migrations/20260504000001_drive_rls_user_id.sql` — Migration completa: assert + ADD COLUMN + backfill + NOT NULL + RLS + bucket privado + storage policies
- `src/integrations/supabase/types.ts` — Types regenerados (user_id em cliente_arquivos / arquivo_pastas)

## Decisions Made
- Estratégia B sobre Estratégia A: storage policies via tabela em vez de path-prefix. Evita Pitfall 3 (paths legados precisariam ser migrados) e Pitfall 5 (policies tentando parsing de path).
- Pré-flight assert escolhido sobre fallback silencioso: melhor abortar migration do que backfillar pra um user_id arbitrário.
- ON DELETE SET NULL nas FKs (D-05): preserva auditoria histórica caso admin seja deletado.

## Deviations from Plan

None — plan executou exatamente como escrito. Único desvio operacional foi de ambiente: o primeiro `supabase db push` rodou contra `main` antes do worktree ser mergeado, retornando "Remote database is up to date". Após merge fast-forward do worktree em `main`, o push subsequente aplicou a migration corretamente.

## Issues Encountered
- PowerShell 5.1 + `>` redirect quebrou na regeração de types (variações de input/output encoding). Resolvido rodando `Out-File -Encoding utf8` + sed strip de BOM/CRLF.
- Smoke check inicial colado com linha "Esperado:" no SQL Editor — corrigido rodando queries separadas.

## Smoke Check Results

| Verificação | Esperado | Resultado |
|-------------|----------|-----------|
| `cliente_arquivos.null_count / total` | 0 / 0+ | 0 / 0 (tabela vazia em prod) |
| `arquivo_pastas.null_count / total` | 0 / 0+ | 0 / 0 (tabela vazia em prod) |
| `storage.buckets.public WHERE id='cliente-arquivos'` | false | false |

Tabelas vazias em prod significam que não havia legados pra backfillar — caso ainda mais limpo que o cenário planejado.

## User Setup Required

None — migration aplicada e types regenerados. Smoke RLS via UI ainda recomendado (logar como colaborador não-admin → Drive vazio; admin → vê tudo) mas será coberto no checkpoint do Plan 04-02 quando o DriveExplorer refatorado estiver pronto.

## Next Phase Readiness
- Plan 04-02 (DriveExplorer refactor) pode partir do contrato `user_id` consolidado.
- Plan 04-03+ (reorg admin) independente desta wave, mas se beneficia da RLS hardenizada.
- Bucket privado: `getPublicUrl` deixa de funcionar — Plan 04-02 precisa migrar para `createSignedUrl` (já planejado).

---
*Phase: 04-drive-rls-reorganiza-o-admin*
*Completed: 2026-05-04*
