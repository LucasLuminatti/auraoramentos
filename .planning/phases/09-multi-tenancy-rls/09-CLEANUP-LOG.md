# 09-CLEANUP-LOG — Phase 9 Cleanup (Plan 09-07)

**Status:** clean (5/5 deleted)
**Date:** 2026-05-15
**Phase:** 09-multi-tenancy-rls
**Project:** jkewlaezvrbuicmncqbj (prod)

## Before Cleanup (sanity)

| Tabela | Count Esperado | Method |
|--------|----------------|--------|
| arquitetos LIKE 'Smoke %' | 2 | MCP execute_sql |
| clientes LIKE 'Smoke %' | 2 | MCP execute_sql |
| colaboradores LIKE 'Smoke Colab %' | 2 | MCP execute_sql |
| allowed_users LIKE 'lennywajcberg+smoke%' | 2 | MCP execute_sql |
| auth.users LIKE 'lennywajcberg+smoke%' | 2 | MCP execute_sql |

## Cleanup Actions

### 1. SQL DELETEs (via MCP execute_sql)
```sql
DELETE FROM public.arquitetos WHERE nome LIKE 'Smoke %';
DELETE FROM public.clientes WHERE nome LIKE 'Smoke %';
DELETE FROM public.colaboradores WHERE nome LIKE 'Smoke Colab %';
DELETE FROM public.allowed_users WHERE email LIKE 'lennywajcberg+smoke%';
```
**Result:** Success (no errors)

### 2. auth.users deletion (via Supabase Auth Admin API)
SQL DELETE on auth.users requires Admin API (restricted even for service_role in standard Supabase setup). Used:
```bash
curl -X DELETE "https://jkewlaezvrbuicmncqbj.supabase.co/auth/v1/admin/users/{uid}" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

| user_id | email | HTTP |
|---------|-------|------|
| dce51939-3e4a-486e-94c5-3963899eccd9 | lennywajcberg+smokea@gmail.com | 200 |
| 8e81bebd-1bc6-4495-9877-fe5dfa5b7f8e | lennywajcberg+smokeb@gmail.com | 200 |

## After Cleanup (verification)

| Tabela | Count Antes | Count Depois |
|--------|-------------|--------------|
| arquitetos LIKE 'Smoke %' | 2 | **0** ✓ |
| clientes LIKE 'Smoke %' | 2 | **0** ✓ |
| colaboradores LIKE 'Smoke Colab %' | 2 | **0** ✓ |
| allowed_users LIKE 'lennywajcberg+smoke%' | 2 | **0** ✓ |
| auth.users LIKE 'lennywajcberg+smoke%' | 2 | **0** ✓ |

Verification query (executed via MCP `execute_sql`):
```sql
SELECT
  (SELECT count(*) FROM public.arquitetos WHERE nome LIKE 'Smoke %') AS arq,
  (SELECT count(*) FROM public.clientes WHERE nome LIKE 'Smoke %') AS cli,
  (SELECT count(*) FROM public.colaboradores WHERE nome LIKE 'Smoke Colab %') AS colabs,
  (SELECT count(*) FROM public.allowed_users WHERE email LIKE 'lennywajcberg+smoke%') AS allowed,
  (SELECT count(*) FROM auth.users WHERE email LIKE 'lennywajcberg+smoke%') AS users;
-- Result: {"arq":0,"cli":0,"colabs":0,"allowed":0,"users":0}
```

## Pending Cleanup

**None.** Diferente do que o plan previa (D-15: "auth.users ficam como pending cleanup pq SQL DELETE é restrito"), conseguimos deletar os 2 auth.users via Admin API HTTP DELETE. Phase 9 fecha limpa.

## Phase 9 Closure Status

| Requirement | Status |
|-------------|--------|
| RLS-01 (clientes RLS) | ✓ **DELIVERED** — policies em prod desde 2026-05-14, smoke bilateral E2E PASS |
| RLS-02 (arquitetos RLS) | ✓ **DELIVERED** — policies em prod desde 2026-05-14, predicate test PASS |

**Smoke evidence:** `09-SMOKE-RESULTS.md` — 5/5 PASS (Playwright UI + SQL cross-check).

Phase 9 ready for verification gate.
