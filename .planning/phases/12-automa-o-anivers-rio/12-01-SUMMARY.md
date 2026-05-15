---
phase: 12-automa-o-anivers-rio
plan: 01
subsystem: database
tags: [supabase, migration, postgres, rls, automation, birthday, security-definer, stored-functions]

# Dependency graph
requires:
  - phase: 07-schema-prep-v1.1
    provides: clientes.data_nascimento DATE NULL + index BTREE (AUTO-03)
  - phase: 07-schema-prep-v1.1
    provides: clientes.user_id UUID NOT NULL (RLS-03) — usado pra resolver colab dono
provides:
  - Tabela log aniversario_envios com UNIQUE(cliente_id, ano_referencia) garantindo idempotência 1 envio/ano/cliente
  - Stored fn buscar_aniversariantes_d5() retornando clientes elegíveis joined com auth.users.email do colab dono
  - Stored fn buscar_admins_emails() retornando lista de emails de admins via JOIN auth.users + user_roles
  - RLS admin-only SELECT em aniversario_envios (auditoria); INSERT/UPDATE/DELETE só service role
affects: [phase-12-02-edge-function, phase-12-03-cron-schedule]

# Tech tracking
tech-stack:
  added:
    - PostgreSQL stored functions SECURITY DEFINER + REVOKE pattern (primeiro uso AURA)
    - UNIQUE constraint como mecanismo atomic de idempotência (1 envio/ano/cliente)
  patterns:
    - LEFT JOIN auth.users em stored fn pra cobrir cliente órfão (D-06)
    - Edge case 29/02 em ano não-bissexto via EXTRACT MONTH/DAY + check t.d+1day=março (D-08)
    - Cast 'admin'::app_role explícito em RLS policy (convenção replicada de 20260514000002)

key-files:
  created:
    - supabase/migrations/20260515000001_aniversario_envios_table.sql
    - .planning/phases/12-automa-o-anivers-rio/PUSH-LOG.md
    - .planning/phases/12-automa-o-anivers-rio/12-01-SUMMARY.md
  modified: []

key-decisions:
  - Stored fns vs JOIN inline na edge fn — escolhemos fns para evitar N+1 via supabase.auth.admin.getUserById e simplificar o caller na Wave 2/3 (1 RPC call vs múltiplos round-trips). Também desacopla schema da edge fn — se mudar regra de "quem é admin" basta atualizar a função.
  - SECURITY DEFINER + REVOKE EXECUTE pattern — fns acessam auth.users (proibido a authenticated). REVOKE PUBLIC + REVOKE authenticated trava acesso direto; só service role chama via RPC (bypass natural).
  - UNIQUE(cliente_id, ano_referencia) como mecanismo de idempotência — atomic em nível de DB, dispensa lock aplicacional. Se cron disparar 2x ou edge fn crashar no meio do batch, INSERT duplicado falha com 23505 e edge fn pode tratar como "já enviado".
  - LEFT JOIN auth.users pra cobrir cliente órfão (D-06) — se user_id apontar pra usuário deletado/sem email, retorna colab_email=NULL e edge fn registra status='skipped_no_owner' em vez de crashar.
  - Edge case 29/02 em ano não-bissexto (D-08) — fn dispara em 28/02 quando 29/02 não existe no ano corrente (verificado via t.d+1day=março). Evita aniversariantes "perdidos" em 3/4 dos anos.

patterns-established:
  - "Stored function SECURITY DEFINER + REVOKE EXECUTE FROM PUBLIC/authenticated — pattern reusável pra qualquer query que cruze schemas auth/public restritos"
  - "UNIQUE constraint como guarda de idempotência em tabelas log de automação — primeiro uso no projeto, candidato pra padrão geral em jobs assíncronos"
  - "LEFT JOIN auth.users em qualquer query que resolva email do dono via user_id — defensivo contra usuários deletados"

requirements-completed: [AUTO-01, AUTO-02]

# Metrics
duration: 90min (Plan inteiro: criação SQL → apply prod → smoke → docs)
completed: 2026-05-14
---

# Phase 12 Plan 01: Schema base aniversario_envios + stored fns aplicados em prod

**Tabela log aniversario_envios com UNIQUE(cliente_id, ano_referencia) + 2 stored fns SECURITY DEFINER (buscar_aniversariantes_d5 cobrindo edge case 29/02 e buscar_admins_emails substituindo hardcode ADMIN_EMAIL) aplicados em prod via MCP apply_migration — schema disponível pra Wave 2 consumir.**

## Performance

- **Duration:** ~90 min (SQL design + apply + smoke + docs)
- **Started:** 2026-05-14T~18:30Z
- **Completed:** 2026-05-15T02:30Z
- **Tasks:** 2 (Task 1 SQL file + Task 2 BLOCKING push prod)
- **Files modified:** 3 (1 migration SQL + PUSH-LOG + SUMMARY)

## Accomplishments

- Migration `20260515000001_aniversario_envios_table.sql` aplicada em prod (`jkewlaezvrbuicmncqbj`) via MCP `apply_migration` — schema disponível pra Wave 2
- Tabela `public.aniversario_envios` criada com 4 constraints (PK, UNIQUE composto, FK CASCADE, CHECK status) + 2 índices (1 partial pra `status='failed'`)
- 2 stored functions SECURITY DEFINER criadas e blindadas via REVOKE de `authenticated`/`PUBLIC`
- RLS habilitado com 1 policy admin-only SELECT (auditoria); INSERT/UPDATE/DELETE restrito a service role por default deny
- Smoke SQL 5/5 PASS validado em prod (tabela+RLS, constraints, fns SECURITY DEFINER + REVOKE, buscar_admins_emails retornou Lenny+Lucas, buscar_aniversariantes_d5 retornou 0 rows sem erro)

## Task Commits

1. **Task 1: Criar migration 20260515000001_aniversario_envios_table.sql** — `39a2c1b` (feat)
2. **Task 2: [BLOCKING] supabase apply_migration em prod + smoke SQL** — aplicação direta via MCP (sem commit de código; PUSH-LOG registra o ato)

**Plan metadata:** (este commit) — `docs(12-01): SUMMARY + PUSH-LOG — migration aniversario_envios applied in prod`

## Files Created/Modified

- `supabase/migrations/20260515000001_aniversario_envios_table.sql` — DDL tabela + 2 stored fns + RLS admin-only SELECT
- `.planning/phases/12-automa-o-anivers-rio/PUSH-LOG.md` — Registro de aplicação em prod + resultados smoke SQL completos
- `.planning/phases/12-automa-o-anivers-rio/12-01-SUMMARY.md` — Este arquivo

## Decisions Made

### 1. Stored functions vs JOIN inline na edge fn

**Decisão:** Criar `buscar_aniversariantes_d5()` e `buscar_admins_emails()` no DB em vez de fazer JOINs SQL inline ou múltiplas chamadas `supabase.auth.admin.getUserById()` no edge function.

**Por quê:**
- **Evita N+1:** Sem `buscar_admins_emails()`, edge fn precisaria `SELECT user_id FROM user_roles WHERE role='admin'` e depois 1× `getUserById()` por admin. Com a fn, 1 RPC call só.
- **Auth.users é restrito:** Authenticated não pode `SELECT email FROM auth.users` direto. Stored fn SECURITY DEFINER resolve isso uma vez, em vez de a edge fn ter que usar admin client em todas as queries.
- **Desacopla schema da edge fn:** Se mudar regra "quem é admin" (ex: adicionar segundo critério), basta atualizar a fn. Edge fn continua chamando o mesmo RPC.
- **Centraliza edge case 29/02:** Lógica de "dispara em 28/02 quando ano não-bissexto" fica no SQL — sem replicar JS date math no edge.

**Custo:** mais SQL pra manter; harder to debug que JS. Mitigado por: COMMENT ON FUNCTION + PUSH-LOG com smoke results.

### 2. SECURITY DEFINER + REVOKE pattern

**Decisão:** Ambas fns são `SECURITY DEFINER SET search_path = public` + `REVOKE EXECUTE FROM PUBLIC + FROM authenticated`.

**Por quê:**
- SECURITY DEFINER é necessário porque fn lê `auth.users.email` (schema auth não está no path de authenticated).
- REVOKE bloqueia que um colab autenticado chame as fns via supabase-js RPC e vaze lista de aniversariantes ou emails de admins.
- Service role bypassa REVOKE naturalmente (super-user-ish em PostgREST) — único caller legítimo.
- `SET search_path = public` evita ataque de search_path hijacking (CVE pattern para SECURITY DEFINER).

### 3. UNIQUE(cliente_id, ano_referencia) como mecanismo atomic de idempotência

**Decisão:** O UNIQUE composto é o ÚNICO mecanismo garantindo "1 envio/ano/cliente". Sem lock aplicacional na edge fn.

**Por quê:**
- Atomic em nível de DB — se cron dispara 2x no mesmo dia, o segundo `INSERT` falha com PG `23505` (unique violation).
- Edge fn pode tratar 23505 como "já enviado nesse ano" e continuar pro próximo cliente sem ruído.
- Inverso: se confiássemos só num `SELECT COUNT(*) FROM aniversario_envios WHERE ... = 0` antes do `INSERT`, haveria race condition entre 2 invocações concorrentes.

### 4. LEFT JOIN auth.users (não INNER) em buscar_aniversariantes_d5

**Decisão:** `LEFT JOIN auth.users u ON u.id = c.user_id` em vez de INNER.

**Por quê (D-06 cliente órfão):**
- Cenário: colab é deletado mas cliente.user_id ainda aponta pro UUID antigo (Phase 7 colocou FK ON DELETE RESTRICT em clientes.user_id, mas em prod pode haver row inconsistente de seed antigo).
- Com INNER JOIN: cliente some da query, ninguém é notificado, ninguém audita o gap.
- Com LEFT JOIN: cliente aparece com `colab_email = NULL`, edge fn (Wave 2) registra `status='skipped_no_owner'` + admin recebe email mesmo assim (D-06).
- Custo: edge fn precisa lidar com `colab_email IS NULL` (não bug).

### 5. Edge case 29/02 em ano não-bissexto (D-08)

**Decisão:** Lógica explícita no WHERE pra disparar em 28/02 quando aniversariante nasceu em 29/02 e o ano corrente não é bissexto.

```sql
OR (EXTRACT(MONTH FROM c.data_nascimento) = 2
    AND EXTRACT(DAY FROM c.data_nascimento) = 29
    AND EXTRACT(MONTH FROM t.d) = 2
    AND EXTRACT(DAY FROM t.d) = 28
    AND EXTRACT(MONTH FROM (t.d + INTERVAL '1 day')) = 3)
```

**Por quê:**
- Sem isso, aniversariantes 29/02 são notificados só em anos bissextos (1/4 dos anos).
- Check `t.d + 1day = março` confirma "ano não-bissexto" — em bissexto, dia seguinte a 28/02 é 29/02 (mês 2), então a cláusula é falsa e o caso comum mês/dia bate exato pega.
- Trade-off: notifica em 28/02 em ano não-bissexto, mantém comportamento natural em ano bissexto.

## Deviations from Plan

None - plan executado exatamente como escrito. Migration SQL escrita conforme `<action>` do Task 1, MCP `apply_migration` chamado conforme Task 2 Opção B, smoke SQL rodado conforme `<how-to-verify>`.

## Issues Encountered

Nenhum. Aplicação MCP retornou sucesso na primeira tentativa. Smoke SQL 5/5 PASS direto.

## User Setup Required

None — Wave 1 é só schema. Wave 3 (Plan 12-03) vai exigir setup manual (Vault secret pra Resend API key + cron schedule via pg_cron).

## Next Phase Readiness

**Wave 2 (Plan 12-02) — edge function `aniversario-clientes`:** PRONTO para começar. Edge fn vai:

1. Chamar `supabase.rpc('buscar_aniversariantes_d5')` (via service role) — retorna `[{id, nome, data_nascimento, contato, user_id, colab_email}, ...]`
2. Chamar `supabase.rpc('buscar_admins_emails')` (via service role) — retorna `[{email}, ...]`
3. Pra cada aniversariante:
   - Se `colab_email IS NULL` → registrar `INSERT INTO aniversario_envios (cliente_id, ano_referencia, destinatarios, status) VALUES (..., 'skipped_no_owner')`
   - Senão → enviar email via Resend pra `[colab_email, ...admin_emails]` + INSERT log com `status='sent'` ou `status='failed'` se Resend falhar
4. Tratar UNIQUE violation (23505) como idempotência — log já existe pro ano, pula silenciosamente

**Smoke disponível:** após Plan 12-02 deploy, dá pra invocar a edge fn com `curl -X POST .../functions/v1/aniversario-clientes` e checar via:
```sql
SELECT * FROM public.aniversario_envios ORDER BY sent_at DESC LIMIT 10;
```

Service role bypassa RLS naturalmente em INSERT/UPDATE. Admin no Dashboard pode auditar via SELECT (RLS libera).

## Self-Check

### Files verification

- `supabase/migrations/20260515000001_aniversario_envios_table.sql` — FOUND (commit 39a2c1b)
- `.planning/phases/12-automa-o-anivers-rio/PUSH-LOG.md` — FOUND
- `.planning/phases/12-automa-o-anivers-rio/12-01-SUMMARY.md` — FOUND (este arquivo)

### Commits verification

- `39a2c1b` (`feat(12-01): add aniversario_envios migration with RLS and stored fns`) — FOUND in git log

### Acceptance criteria (8 items, all PASS)

- [x] Tabela `aniversario_envios` existe em prod com UNIQUE + CHECK + RLS habilitado — confirmado smoke #1 + #2
- [x] 2 stored functions criadas, SECURITY DEFINER, REVOKEd de authenticated — confirmado smoke #3
- [x] Migration commitada em git (39a2c1b) e aplicada em prod via MCP — confirmado timestamp 2026-05-14
- [x] PUSH-LOG.md atualizado com timestamp + método — confirmado
- [x] `buscar_admins_emails()` retorna ≥ 1 row — PASS (2 rows: Lenny + Lucas)
- [x] `buscar_aniversariantes_d5()` retorna sem erro — PASS (0 rows válido)
- [x] `has_function_privilege('authenticated', ..., 'EXECUTE')` retorna false pra ambas — PASS
- [x] Wave 2 desbloqueada (edge function tem schema pra consumir) — confirmado

## Self-Check: PASSED

---
*Phase: 12-automa-o-anivers-rio*
*Completed: 2026-05-14*
