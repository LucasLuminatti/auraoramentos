# 09-PUSH-LOG — Multi-tenancy RLS (RLS-01 + RLS-02)

**Phase:** 09-multi-tenancy-rls
**Migration:** supabase/migrations/20260514000001_arquitetos_clientes_rls.sql (TBD em 09-03)
**Push method:** mcp__plugin_supabase_supabase__apply_migration (D-08)

---

## PRE-PUSH pg_policies snapshot

**Captured:** 2026-05-14T15:33:00Z
**Method:** Supabase Management API v1 `POST /v1/projects/jkewlaezvrbuicmncqbj/database/query` (token via Windows Credential Manager `Supabase CLI:supabase`)

### Table: public.arquitetos

| policyname | cmd | roles | qual | with_check |
|------------|-----|-------|------|------------|
| Admins can manage arquitetos | ALL | {authenticated} | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| Anyone can read arquitetos | SELECT | {public} | `true` | null |

**Total policies (arquitetos):** 2
**RLS enabled:** true
**RLS forced:** false

### Table: public.clientes

| policyname | cmd | roles | qual | with_check |
|------------|-----|-------|------|------------|
| Anyone can read clientes | SELECT | {public} | `true` | null |
| Authenticated users can delete clientes | DELETE | {authenticated} | `true` | null |
| Authenticated users can insert clientes | INSERT | {authenticated} | null | `true` |
| Authenticated users can update clientes | UPDATE | {authenticated} | `true` | null |

**Total policies (clientes):** 4
**RLS enabled:** true
**RLS forced:** false

### Divergência com D-02 (se houver)

Nenhuma — estado em prod bate exatamente com as hipóteses do contexto:

- `arquitetos`: D-02 previu 2 policies (`"Anyone can read arquitetos"` + `"Admins can manage arquitetos"`) — **confirmado**.
- `clientes`: D-02 previu 4 policies (`"Anyone can read clientes"`, `"Authenticated users can insert clientes"`, `"Authenticated users can update clientes"`, `"Authenticated users can delete clientes"`) — **confirmado**.
- `relrowsecurity = true` em ambas — **confirmado**; os `ENABLE ROW LEVEL SECURITY` na migration 09-03 serão idempotentes.

**Input para 09-03 (DROPs necessários):**
- `arquitetos`: DROP POLICY IF EXISTS "Admins can manage arquitetos"; DROP POLICY IF EXISTS "Anyone can read arquitetos";
- `clientes`: DROP POLICY IF EXISTS "Anyone can read clientes"; DROP POLICY IF EXISTS "Authenticated users can delete clientes"; DROP POLICY IF EXISTS "Authenticated users can insert clientes"; DROP POLICY IF EXISTS "Authenticated users can update clientes";
- Total: 6 DROP POLICY IF EXISTS statements — exatamente o previsto em D-07.

---

## POST-PUSH pg_policies snapshot
[TODO — preenchido em 09-04 após apply]

---

## Apply Log
[TODO — preenchido em 09-04]
