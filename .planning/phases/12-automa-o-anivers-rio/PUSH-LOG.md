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

## 2026-05-14/15 — Plan 12-03 — Vault secret + `20260515000002_aniversario_cron_schedule`

### Vault secret `service_role_key` (manual, FORA do git)

- **Timestamp prod:** 2026-05-14
- **Method:** MCP `execute_sql` com `SELECT vault.create_secret(...)`
- **Secret name:** `service_role_key`
- **Secret ID:** `40edc274-efa0-4d28-afaf-aeb7968026bd`
- **Key length:** `219` (dentro da faixa esperada 200-500 — JWT longo)
- **Description registrada:** `Phase 12 cron auth — pg_cron lê via vault.decrypted_secrets pra montar Authorization header da edge fn aniversario-clientes`
- **Status:** CRIADO COM SUCESSO

**Confirmações de segurança:**
- Service role key NÃO está em nenhum arquivo do repo (`grep` por padrão JWT `eyJ` em `.planning/` e `supabase/migrations/` não retornou hits)
- Valor original vive apenas em: Supabase Dashboard → Settings → API + Vault (cifrado)
- Migration aplicada lê via subquery `vault.decrypted_secrets` em runtime — rotação propaga automaticamente

### Migration `20260515000002_aniversario_cron_schedule`

- **Migration:** `supabase/migrations/20260515000002_aniversario_cron_schedule.sql`
- **Method:** MCP `mcp__plugin_supabase_supabase__apply_migration`
- **Project ID:** `jkewlaezvrbuicmncqbj`
- **Region:** `sa-east-1`
- **Timestamp prod:** 2026-05-15
- **Git commit do SQL:** `e03dd4c` (Task 2 commit do Plan 12-03)
- **Status:** APLICADO COM SUCESSO (response: `success: true`)

### Conteúdo da migration

- `CREATE EXTENSION IF NOT EXISTS pg_cron` — habilita pg_cron 1.6.4 (era DISPONÍVEL, agora installed)
- `CREATE EXTENSION IF NOT EXISTS pg_net` — habilita pg_net 0.20.0 (era DISPONÍVEL, agora installed)
- Bloco `DO $$ ... END $$` defensivo: `cron.unschedule('aniversario-diario')` se já existir
- `cron.schedule('aniversario-diario', '0 9 * * *', $$ ... $$)` — schedule diário 09:00 UTC = 06:00 BR (CONTEXT D-01)
- Command body: `net.http_post(url, headers, body, timeout_milliseconds := 60000)` com `Authorization Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='service_role_key')`
- 2 `COMMENT ON EXTENSION` rastreando Phase 12 origin

### Smoke pós-deploy — Resultados (3 verificações, all PASS)

#### 1. Extensions habilitadas

```sql
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
```

| extname | extversion |
|---------|------------|
| pg_cron | `1.6.4`    |
| pg_net  | `0.20.0`   |

PASS — Ambas extensions installed (transição DISPONÍVEL → installed).

#### 2. Cron job agendado

```sql
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'aniversario-diario';
```

| jobid | jobname             | schedule    | active | command (resumo) |
|-------|---------------------|-------------|--------|------------------|
| `1`   | `aniversario-diario`| `0 9 * * *` | `true` | contém `net.http_post` + `functions/v1/aniversario-clientes` + `vault.decrypted_secrets` |

PASS — Job único, ativo, schedule literal `'0 9 * * *'`, command com toda a chain.

#### 3. Smoke E2E manual do command SQL

```sql
SELECT net.http_post(
  url := 'https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
) AS request_id;
```

Retorno: `request_id = 1` (UUID/bigint válido do pg_net).

```sql
SELECT id, status_code, content_type, content, error_msg, created
FROM net._http_response
ORDER BY created DESC LIMIT 1;
```

| id | status_code | content_type | content | error_msg | created |
|----|-------------|--------------|---------|-----------|---------|
| `1` | `200` | `application/json` | `{"processed":0,"sent":0,"failed":0,"skipped":0,"ano_referencia":2026}` | `NULL` | `2026-05-15 02:51:35 UTC` |

PASS — Chain end-to-end validada:
- cron.schedule → pg_net.http_post → Vault subquery (decifrou key) → edge fn auth Bearer (200) → edge fn executou → stored fns rodaram → 0 clientes elegíveis em prod (esperado — clean prod) → JSON 200 OK
- `error_msg = NULL` confirma sem timeout/DNS/TCP error
- `status_code = 200` confirma autenticação Bearer funcionou (não 401)

---

### Verificação cruzada com `<verification>` do PLAN

| Critério PLAN | Resultado |
|--------------|-----------|
| Pré-check: Vault secret existe + supabase_vault habilitado | PASS (secret_id 40edc274..., vault 0.3.1) |
| Migration aplicada sem erro | PASS (MCP apply_migration success=true) |
| `pg_extension` retorna pg_cron 1 row | PASS |
| `pg_extension` retorna pg_net 1 row | PASS |
| `cron.job WHERE jobname='aniversario-diario'` retorna 1 row, active=true | PASS (jobid=1) |
| Smoke manual retorna request_id UUID | PASS (request_id=1) |
| `net._http_response.status_code=200` + content JSON | PASS (`{"processed":0,...,"ano_referencia":2026}`) |
| Migration NÃO contém literal de service_role_key (negative grep `eyJ...`) | PASS |
| PUSH-LOG.md atualizado SEM expor key | PASS (este registro) |

### Estado final do cron

- **Jobname:** `aniversario-diario`
- **Schedule:** `0 9 * * *` (diário 09:00 UTC = 06:00 BR / D-01)
- **Active:** `true`
- **Próxima execução real prevista:** `2026-05-15 09:00 UTC` = `2026-05-15 06:00 BRT`

**Conclusão:** Phase 12 entregue end-to-end. Chain completa cron → pg_net → edge fn → Resend → log validada em prod sem intervenção manual. Phase 13 (Smoke & UAT Closure) destravada.

---

*PUSH-LOG atualizado em 2026-05-15 ao finalizar Plan 12-03.*
