# 09-CLEANUP-LOG — Smoke data cleanup (Plan 09-07)

**Executed:** 2026-05-14T16:10:00Z
**Phase:** 09-multi-tenancy-rls

## Deleted

| Table | Rows deleted | Method |
|-------|--------------|--------|
| `public.arquitetos` (Smoke %) | 2 | MCP `execute_sql` DELETE WHERE nome LIKE |
| `public.clientes` (Smoke %) | 2 | MCP `execute_sql` DELETE WHERE nome LIKE |
| `public.colaboradores` (smoke user_ids) | 2 | MCP `execute_sql` DELETE WHERE user_id IN |
| `public.allowed_users` (smoke emails) | 2 | MCP `execute_sql` DELETE WHERE email IN |
| `auth.identities` (smoke user_ids) | 2 | MCP `execute_sql` (owner token tem permissão) |
| `auth.users` (smoke ids) | 2 | MCP `execute_sql` (owner token tem permissão) |

## Pending cleanup

Nenhum. MCP owner token conseguiu apagar `auth.users` + `auth.identities` direto, então não ficou pending cleanup (atualização ao [[project_aura_pending_cleanup]] memory: nota anterior sobre auth.users pending fica obsoleta para este caso).

## Verification (zero rows remaining)

```sql
SELECT
  (SELECT count(*) FROM public.arquitetos    WHERE nome LIKE 'Smoke %')                    AS arq_remaining,    -- 0
  (SELECT count(*) FROM public.clientes      WHERE nome LIKE 'Smoke %')                    AS cli_remaining,    -- 0
  (SELECT count(*) FROM public.colaboradores WHERE nome LIKE 'Smoke %')                    AS colab_remaining,  -- 0
  (SELECT count(*) FROM public.allowed_users WHERE email LIKE 'smoke-%@aura-smoke.local')  AS allowed_remaining,-- 0
  (SELECT count(*) FROM auth.users           WHERE email LIKE 'smoke-%@aura-smoke.local')  AS auth_remaining,   -- 0
  (SELECT count(*) FROM auth.identities      WHERE provider_id LIKE 'smoke-%@aura-smoke.local') AS idents_remaining; -- 0
```

All zeros confirmed.

## Phase 9 closure status

- ✅ RLS-01 (clientes multi-tenancy): structurally + behaviorally validated
- ✅ RLS-02 (arquitetos multi-tenancy): structurally + behaviorally validated
- ✅ Smoke 7/7 PASS em 09-06
- ✅ Migration aplicada em prod em 09-04
- ✅ Cleanup completo, zero residual
- ✅ Phase 9 pronta para verification
