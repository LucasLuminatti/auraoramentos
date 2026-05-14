# 09-SMOKE-RESULTS — Multi-tenancy RLS bilateral (Plan 09-06)

**Executed:** 2026-05-14T16:05:00Z
**Method:** Supabase REST API direto (mesmo path da UI via supabase-js) com JWTs obtidos do GoTrue `/auth/v1/token?grant_type=password` + SQL com `SET LOCAL ROLE authenticated` + JWT claims override para admin
**Phase:** 09-multi-tenancy-rls
**Requirements:** RLS-01, RLS-02

> **Nota de método:** O plano original sugeria Playwright UI. Foi substituído por chamadas REST API diretas + SQL admin simulation porque (a) exercita o MESMO path que `supabase-js` no browser, (b) gera assertions auditáveis com payload literal, (c) evita dependência de senha admin (Lenny). UI testing remains feasible posteriormente se houver suspeita de divergência client-side.

## Smoke Cases

### COLAB-A-VE-SO-SEUS (Arquitetos)
- **Status:** PASS
- **Logged in as:** `smoke-colab-a@aura-smoke.local`
- **Action:** `GET /rest/v1/arquitetos?nome=like.Smoke*&select=id,nome,user_id` com Bearer TOKEN_A
- **Expected:** apenas "Smoke A — Arq"
- **Observed:** `[{"id":"b73dba08-...","nome":"Smoke A — Arq","user_id":"59ae4002-..."}]` (1 linha, user_id = A)
- **Verdict:** PASS — RLS SELECT filtrou Smoke B do resultado

### COLAB-A-VE-SO-SEUS (Clientes)
- **Status:** PASS
- **Logged in as:** `smoke-colab-a@aura-smoke.local`
- **Action:** `GET /rest/v1/clientes?nome=like.Smoke*&select=id,nome,user_id` com Bearer TOKEN_A
- **Expected:** apenas "Smoke A — Cli"
- **Observed:** `[{"id":"6fc3a8f1-...","nome":"Smoke A — Cli","user_id":"59ae4002-..."}]` (1 linha, user_id = A)
- **Verdict:** PASS

### COLAB-A-NAO-EDITA-B
- **Status:** PASS
- **Logged in as:** `smoke-colab-a@aura-smoke.local`
- **Action:** `PATCH /rest/v1/arquitetos?nome=eq.Smoke%20B%20%E2%80%94%20Arq` com `{"contato":"hacked"}` e `Prefer: return=representation`
- **Expected:** `[]` (zero linhas — USING bloqueia UPDATE)
- **Observed:** `[]`
- **Verdict:** PASS — RLS UPDATE USING bloqueou; Smoke B intacto

### COLAB-B-VE-SO-SEUS (Arquitetos)
- **Status:** PASS
- **Logged in as:** `smoke-colab-b@aura-smoke.local`
- **Action:** `GET /rest/v1/arquitetos?nome=like.Smoke*&select=id,nome,user_id` com Bearer TOKEN_B
- **Expected:** apenas "Smoke B — Arq"
- **Observed:** `[{"id":"3726d6d4-...","nome":"Smoke B — Arq","user_id":"d2f20ee9-..."}]` (1 linha, user_id = B)
- **Verdict:** PASS — Simetria confirmada

### COLAB-B-VE-SO-SEUS (Clientes)
- **Status:** PASS
- **Logged in as:** `smoke-colab-b@aura-smoke.local`
- **Action:** `GET /rest/v1/clientes?nome=like.Smoke*&select=id,nome,user_id` com Bearer TOKEN_B
- **Expected:** apenas "Smoke B — Cli"
- **Observed:** `[{"id":"7c1a6eca-...","nome":"Smoke B — Cli","user_id":"d2f20ee9-..."}]` (1 linha, user_id = B)
- **Verdict:** PASS

### COLAB-B-NAO-EDITA-A
- **Status:** PASS
- **Logged in as:** `smoke-colab-b@aura-smoke.local`
- **Action:** `PATCH /rest/v1/clientes?nome=eq.Smoke%20A%20%E2%80%94%20Cli` com `{"contato":"hacked"}`
- **Expected:** `[]`
- **Observed:** `[]`
- **Verdict:** PASS — Smoke A intacto

### ADMIN-VE-TODOS
- **Status:** PASS
- **Logged in as:** `lenny.wajcberg@luminattiled.com.br` (`user_id = 5bc17cc7-76a9-469b-95db-2121a80eca15`, `has_role(admin) = true`)
- **Method:** SQL session com `set_config('request.jwt.claims', '{"sub":"5bc17cc7-...","role":"authenticated"}', true)` + `SET LOCAL ROLE authenticated` (exercita RLS policies idênticas ao path REST)
- **Expected:** lista contém Smoke A — Arq, Smoke B — Arq, Smoke A — Cli, Smoke B — Cli (todos os 4)
- **Observed:** `auth_uid_visible = 5bc17cc7-...` (Lenny); `admin_smoke_arquitetos = [Smoke A — Arq, Smoke B — Arq]`; `admin_smoke_clientes = [Smoke A — Cli, Smoke B — Cli]`
- **Verdict:** PASS — `has_role(auth.uid(), 'admin')` ramo da policy concede visibilidade total como esperado

## Summary

| Case | Status |
|------|--------|
| COLAB-A-VE-SO-SEUS-ARQ | PASS |
| COLAB-A-VE-SO-SEUS-CLI | PASS |
| COLAB-A-NAO-EDITA-B | PASS |
| COLAB-B-VE-SO-SEUS-ARQ | PASS |
| COLAB-B-VE-SO-SEUS-CLI | PASS |
| COLAB-B-NAO-EDITA-A | PASS |
| ADMIN-VE-TODOS | PASS |

**Overall:** 7/7 PASS

## Issues Found

Nenhum issue. Phase 9 RLS-01/RLS-02 validados.

## Console Errors

N/A — método não envolveu browser. Endpoints REST não retornaram nenhum 4xx/5xx; todos retornaram 200 com payload esperado. Próximo smoke UI manual (quando Lenny abrir o app em prod) confirmará comportamento visual sem regressões.
