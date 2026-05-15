# PUSH-LOG — Phase 12 (Automação Aniversário)

Registro de aplicações de migration em produção (`jkewlaezvrbuicmncqbj` / sa-east-1).

---

## 2026-05-14 — Plan 12-01 — `20260515000001_aniversario_envios_table`

- **Migration:** `supabase/migrations/20260515000001_aniversario_envios_table.sql`
- **Method:** MCP `mcp__plugin_supabase_supabase__apply_migration`
- **Project ID:** `jkewlaezvrbuicmncqbj`
- **Region:** `sa-east-1`
- **Timestamp prod:** 2026-05-14
- **Git commit do SQL:** `39a2c1b` (`feat(12-01): add aniversario_envios migration with RLS and stored fns`)
- **Status:** APLICADO COM SUCESSO

### Conteúdo da migration

- 1 tabela: `public.aniversario_envios` (PK + UNIQUE cliente_id+ano_referencia + FK cliente_id + CHECK status)
- 2 índices: `idx_aniversario_envios_cliente`, `idx_aniversario_envios_status_failed` (partial WHERE failed)
- RLS habilitado + 1 policy SELECT (`Admins can read aniversario_envios` via `has_role(auth.uid(), 'admin'::app_role)`)
- 2 stored functions SECURITY DEFINER: `buscar_aniversariantes_d5()`, `buscar_admins_emails()`
- REVOKE EXECUTE pra PUBLIC + authenticated em ambas funções

### Smoke SQL — Resultados (5 queries, all PASS)

#### 1. Tabela + RLS

```sql
SELECT tablename, rowsecurity,
  (SELECT count(*) FROM pg_policies WHERE tablename='aniversario_envios') AS num_policies
FROM pg_tables WHERE schemaname='public' AND tablename='aniversario_envios';
```

| tablename | rowsecurity | num_policies |
|-----------|-------------|--------------|
| aniversario_envios | `true` | `1` |

PASS — Tabela existe, RLS ON, 1 policy (admin-only SELECT).

#### 2. Constraints

```sql
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.aniversario_envios'::regclass
  AND contype IN ('u', 'p', 'f', 'c');
```

| conname | contype |
|---------|---------|
| aniversario_envios_cliente_id_ano_referencia_key | `u` (UNIQUE) |
| aniversario_envios_cliente_id_fkey | `f` (FOREIGN KEY) |
| aniversario_envios_pkey | `p` (PRIMARY KEY) |
| aniversario_envios_status_check | `c` (CHECK) |

PASS — 4 constraints presentes: UNIQUE(cliente_id, ano_referencia) garante idempotência D-02.

#### 3. Stored functions criadas + REVOKEd

```sql
SELECT p.proname, p.prosecdef AS security_definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('buscar_aniversariantes_d5','buscar_admins_emails');
```

| proname | security_definer | auth_can_exec |
|---------|------------------|---------------|
| buscar_aniversariantes_d5 | `true` | `false` |
| buscar_admins_emails | `true` | `false` |

PASS — Ambas SECURITY DEFINER, ambas inacessíveis a authenticated (só service role chama).

#### 4. Smoke `buscar_admins_emails()`

```sql
SELECT * FROM public.buscar_admins_emails();
```

| email |
|-------|
| `lucas.hartmann@luminattiled.com.br` |
| `lenny.wajcberg@luminattiled.com.br` |

PASS — Retornou 2 admins reais (Lucas + Lenny). Substituirá o hardcode de ADMIN_EMAIL na edge fn da Wave 2 (D-05).

#### 5. Smoke `buscar_aniversariantes_d5()`

```sql
SELECT * FROM public.buscar_aniversariantes_d5();
```

| id | nome | data_nascimento | contato | user_id | colab_email |
|----|------|-----------------|---------|---------|-------------|
| (0 rows) | | | | | |

PASS — 0 rows hoje (esperado — nenhum cliente cadastrado com aniversário em 2026-05-19). Sem erro de execução, função compila e roda com sucesso.

---

### Verificação cruzada com `<verification>` do PLAN

| Critério PLAN | Resultado |
|--------------|-----------|
| Tabela existe em `information_schema.tables` | PASS |
| `rowsecurity = true` em `pg_tables` | PASS |
| 1 policy em `pg_policies` | PASS |
| `buscar_admins_emails()` ≥ 1 row | PASS (2 rows) |
| `buscar_aniversariantes_d5()` retorna sem erro | PASS (0 rows válido) |
| `has_function_privilege('authenticated', buscar_aniversariantes_d5, EXECUTE)` = false | PASS |
| `has_function_privilege('authenticated', buscar_admins_emails, EXECUTE)` = false | PASS |

**Conclusão:** Schema disponível pra Wave 2 (Plan 12-02 — edge function `aniversario-clientes`) consumir via service role RPC.

---

*PUSH-LOG criado em 2026-05-14 ao finalizar Plan 12-01.*
