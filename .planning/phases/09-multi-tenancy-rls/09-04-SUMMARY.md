---
phase: 09-multi-tenancy-rls
plan: 04
status: complete
date: 2026-05-14
---

# 09-04 SUMMARY — Apply RLS migration em produção

## Status

**SUCCESS** — Migration `20260514000001_arquitetos_clientes_rls.sql` aplicada em prod (`jkewlaezvrbuicmncqbj`, sa-east-1) via `mcp__plugin_supabase_supabase__apply_migration` em 2026-05-14T15:54Z.

## What built

- Apply atômico em produção (`{"success":true}` retornado pelo MCP)
- POST-PUSH snapshot capturado e diff PRE→POST documentado em `09-PUSH-LOG.md`
- Build sanity: `npm run build` exit 0
- Lenny aprovou explicitamente no chat antes do apply (Task 1 BLOCKING checkpoint)

## 8 policies criadas

### arquitetos (RLS-02)
- `Colabs read own arquitetos, admins read all` (SELECT)
- `Colabs insert own arquitetos` (INSERT, WITH CHECK strict)
- `Colabs update own arquitetos, admins update all` (UPDATE)
- `Colabs delete own arquitetos, admins delete all` (DELETE)

### clientes (RLS-01)
- `Colabs read own clientes, admins read all` (SELECT)
- `Colabs insert own clientes` (INSERT, WITH CHECK strict)
- `Colabs update own clientes, admins update all` (UPDATE)
- `Colabs delete own clientes, admins delete all` (DELETE)

## DEFAULT auth.uid() confirmado

| table | column_default |
|-------|----------------|
| arquitetos.user_id | `auth.uid()` |
| clientes.user_id | `auth.uid()` |

## 6 policies legadas dropadas (zero divergência com D-02)

- arquitetos: `Anyone can read arquitetos`, `Admins can manage arquitetos`
- clientes: `Anyone can read clientes`, `Authenticated users can {insert,update,delete} clientes`

## RLS state

`relrowsecurity = true` em ambas (já estava habilitado pré-Phase-9; Bloco 3 da migration foi idempotente como previsto em D-03).

## Notas

- **Lint:** 754 problemas pré-existentes na baseline (580 errors em `supabase/functions/import-produtos/index.ts` e `tailwind.config.ts`). Phase 9 não tocou em nenhum arquivo `.ts`/`.tsx` (`git diff --name-only c6b5067..HEAD` em paths de código = vazio). Lint baseline é problema separado, não regressão.
- **Build:** 16.93s, exit 0 — único warning é chunk size (também pré-existente).
- **Próximo gate:** 09-05 (Lenny cria 2 contas reais para smoke bilateral) + 09-06 (Playwright valida visibilidade).

## Key files

- `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql` (aplicada em prod)
- `.planning/phases/09-multi-tenancy-rls/09-PUSH-LOG.md` (PRE + POST snapshot + Apply Log + Diff)
