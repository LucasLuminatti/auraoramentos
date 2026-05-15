---
phase: 09-multi-tenancy-rls
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - supabase/migrations/20260514000001_arquitetos_clientes_rls.sql
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 1
**Status:** clean (audit pós-deploy — RLS já em prod desde 2026-05-14, smoke bilateral PASS 5/5)

## Summary

A migration `20260514000001_arquitetos_clientes_rls.sql` implementa multi-tenancy RLS em `arquitetos` e `clientes` replicando 1:1 o padrão Drive (Bloco 5/6 de `20260504000001_drive_rls_user_id.sql`). A revisão confirma que a migration está **correta, segura e consistente com o padrão estabelecido**. Não foram encontrados bugs nem vulnerabilidades. Os três achados abaixo são informativos (consistência de estilo e documentação de invariantes) — nenhum requer ação dado que o código já está em prod com smoke PASS.

Pontos verificados:
- **Cobertura de verbos:** SELECT/INSERT/UPDATE/DELETE presentes nas duas tabelas (8 policies no total).
- **WITH CHECK strict no INSERT** (D-06): admin não pode criar em nome de outro colab — intencional e alinhado com Drive.
- **UPDATE simétrico:** `USING` e `WITH CHECK` idênticos, impedindo "stealing" de linhas via UPDATE de `user_id`.
- **Função `has_role`:** assinatura `(_user_id uuid, _role app_role)` — o literal `'admin'` é coercido implicitamente para `app_role` pelo parser. Funciona idêntico a `'admin'::app_role`.
- **Pré-condições garantidas:** Phase 7 (`20260511000001_arquitetos_clientes_user_id.sql`) já fez backfill + `NOT NULL` em `user_id`, então não há risco de linha com `user_id NULL` ficar invisível após RLS habilitada.
- **FK `ON DELETE RESTRICT`** em `user_id → auth.users` (Phase 7 D-01): impede orfanização e cascade silencioso.
- **Service role bypass:** `service_role` tem `BYPASSRLS` por padrão no Postgres → edge functions (ex: `validar-sistema-orcamento`, `create-colaborador`) continuam operando sem mudança.
- **Idempotência:** todos os `DROP POLICY` usam `IF EXISTS`. `ENABLE ROW LEVEL SECURITY` é idempotente. Transação `BEGIN/COMMIT` atômica (D-07).

## Info

### IN-01: Inconsistência de cast em `has_role(..., 'admin')` vs `'admin'::app_role`

**File:** `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql:52,56,60,61,65,81,85,89,90,94`
**Issue:** Esta migration usa `public.has_role(auth.uid(), 'admin')` (cast implícito). Migrations posteriores adotaram o cast explícito `'admin'::app_role` (ver `20260514000002_orcamentos_status_rls.sql:41` e `20260515000001_aniversario_envios_table.sql:35`). Ambas as formas são funcionalmente equivalentes — o Postgres faz coerce do literal string para o enum `app_role` automaticamente porque a assinatura da função tem tipo fixo. **Não é bug** e está alinhado com o padrão Drive original (que também usa cast implícito). Apenas registro de inconsistência estilística no codebase.
**Fix:** Nenhuma ação necessária. Caso queira padronizar futuramente, escolher um estilo (preferência: cast explícito `'admin'::app_role`, mais defensivo em refactors) e aplicar em uma migration de cleanup. Não retroceder esta migration — ela já está aplicada em prod.

### IN-02: `CREATE POLICY` não suporta `IF NOT EXISTS` — re-run da migration falha

**File:** `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql:50-65,79-94`
**Issue:** Os blocos 4 e 5 usam `CREATE POLICY` sem `IF NOT EXISTS` (sintaxe que o Postgres não suporta para policies). Se a migration for re-executada (ex: rebuild de ambiente local), ela falha em "policy already exists". Isso é o **padrão aceito** do Supabase (migrations são run-once via tabela `schema_migrations`) e replica exatamente o comportamento do Drive Bloco 5/6. A idempotência alcançável foi de `DROP IF EXISTS` para nomes legados — para nomes novos, depende do tracking de migrations.
**Fix:** Nenhuma ação necessária para esta migration (já aplicada). Para resiliência futura, considerar o pattern:
```sql
DROP POLICY IF EXISTS "Colabs read own arquitetos, admins read all" ON public.arquitetos;
CREATE POLICY "Colabs read own arquitetos, admins read all" ...
```
Trade-off: rompe brevemente a proteção durante a transação se houver concorrência. Como está dentro de `BEGIN/COMMIT`, o impacto é nulo na prática.

### IN-03: Comentário PRE-PUSH cita arquivo de log do workflow GSD

**File:** `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql:12`
**Issue:** Linha de comentário `-- PRE-PUSH snapshot (09-02): 2 policies em arquitetos + 4 em clientes confirmadas via pg_policies 2026-05-14.` referencia artefato de workflow (`09-PUSH-LOG.md`) que pode não existir em ambientes onde só o repo de código é versionado (a pasta `.planning/` é específica do GSD). Não é problema funcional — comentários em SQL nunca são executados. Apenas registro de acoplamento documental.
**Fix:** Manter como está — o comentário é valioso para auditoria histórica e o `.planning/` está versionado no mesmo repo.

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
