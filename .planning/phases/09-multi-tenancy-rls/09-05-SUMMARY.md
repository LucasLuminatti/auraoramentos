---
phase: 09-multi-tenancy-rls
plan: 05
subsystem: testing

tags: [rls, smoke, multi-tenancy, supabase-auth, admin-api]

requires:
  - phase: 09-multi-tenancy-rls (Plan 09-04)
    provides: RLS policies aplicadas em arquitetos + clientes em prod
provides:
  - 2 colaboradores smoke (A e B) em prod com user_id distintos
  - 4 cadastros smoke (2 arquitetos + 2 clientes) em prod com user_id dono correto
  - 09-SMOKE-SETUP.md com inventário completo (emails, UUIDs, ids dos cadastros) consumido por 09-06
affects: [09-06, 09-07]

tech-stack:
  added: []
  patterns:
    - "Smoke data bootstrap via Supabase Auth Admin API (POST /auth/v1/admin/users com email_confirm=true) — bypassa fluxo /request-access + admin approve + email click quando o que importa é só ter 2 user_ids autenticáveis distintos"
    - "Padrão de nomenclatura Smoke A — Arq / Smoke A — Cli / Smoke B — Arq / Smoke B — Cli (filtrável por LIKE 'Smoke %' no cleanup)"

key-files:
  created:
    - .planning/phases/09-multi-tenancy-rls/09-SMOKE-SETUP.md
  modified: []

key-decisions:
  - "Bypass do signup UI via Admin API: o fluxo real do AURA (/request-access → admin approve → email confirmation → set password) exige 4 cliques manuais no inbox do Lenny e não acrescenta nada à validação RLS, que opera sobre auth.uid() independente da origem do user. Decisão tomada com aprovação explícita do Lenny no chat."
  - "Inserts de colaboradores + arquitetos + clientes diretos via MCP execute_sql com user_id manualmente atribuído. RLS bypass natural do MCP (owner token) é intencional pra setup; smoke 09-06 valida o comportamento real (via user JWT) honra RLS."

patterns-established:
  - "Smoke bootstrap rápido para validar policies de RLS sem depender de fluxo signup completo"
  - "Inventário centralizado (SMOKE-SETUP.md) com emails, UUIDs e ids consumido pelo plan de validação seguinte"

requirements-completed: [RLS-01, RLS-02]

duration: ~15min
completed: 2026-05-15
---

# Phase 09 Plan 05: Smoke Setup Summary

**2 colaboradores smoke + 4 cadastros (2 arquitetos + 2 clientes) bootstrapped em prod via Supabase Auth Admin API, com inventário completo em 09-SMOKE-SETUP.md para Plan 09-06 consumir.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-05-15
- **Tasks:** 2 (1 checkpoint humano + 1 auto)
- **Files modified:** 1 (criação 09-SMOKE-SETUP.md)

## Accomplishments

- 2 colab users criados via Supabase Auth Admin API com `email_confirm=true` (sem necessidade de email clicks)
- 2 rows em `public.colaboradores` inseridas com setor `'comercial'` (lowercase, atende `check_colaboradores_setor`)
- 4 cadastros Smoke (2 arquitetos + 2 clientes) inseridos via SQL com `user_id` correto por dono
- 09-SMOKE-SETUP.md publicado com inventário completo (emails, UUIDs auth.users, ids colaboradores, ids cadastros, senhas smoke-only, justificativa do bypass)

## Task Commits

1. **Task 1 (checkpoint:human-action):** Lenny decidiu emails `lennywajcberg+smokea@gmail.com` e `lennywajcberg+smokeb@gmail.com` (Gmail subaddressing, ambos chegam no inbox principal)
2. **Task 2 (auto):** Bootstrap em prod + criação do SMOKE-SETUP.md — `2944645` (docs)

**Plan metadata closer:** este SUMMARY commitado depois junto com 09-06 + 09-07.

## Files Created/Modified

- `.planning/phases/09-multi-tenancy-rls/09-SMOKE-SETUP.md` — inventário completo dos dados smoke (2 users + 2 colabs + 4 cadastros)

## Inventário rápido

| Item | Quantidade | Padrão |
|------|-----------|--------|
| auth.users (smoke) | 2 | lennywajcberg+smoke[a/b]@gmail.com |
| colaboradores (smoke) | 2 | Smoke Colab A / Smoke Colab B |
| arquitetos (smoke) | 2 | Smoke A — Arq / Smoke B — Arq |
| clientes (smoke) | 2 | Smoke A — Cli / Smoke B — Cli |

UUIDs auth.users: `dce51939-3e4a-486e-94c5-3963899eccd9` (A), `8e81bebd-1bc6-4495-9877-fe5dfa5b7f8e` (B).

## Decisions Made

- **Bypass signup UI via Admin API.** Fluxo signup AURA exige 4 cliques manuais (request-access + admin approval + 2 email confirmations) que não adicionam validação ao invariante RLS (`user_id = auth.uid()`). Bypass entregou 2 users autenticáveis em segundos com o mesmo invariante.
- **Setor `'comercial'` (lowercase)** porque `check_colaboradores_setor` exige lowercase; descoberta durante INSERT (primeira tentativa retornou erro de check constraint).
- **Senhas em clear text no SMOKE-SETUP.md** aceitas como tradeoff: throwaway accounts, sem acesso a dados reais (RLS limita ao próprio user_id), cleanup em 09-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bypass via Admin API em vez de signup UI Playwright**

- **Found during:** Task 2 (criação dos 2 colabs)
- **Issue:** Plano previa Playwright dirigindo signup completo via UI, mas o fluxo AURA exige (a) admin approve em `/request-access`, (b) Lenny clicar 2× em emails (confirmação + set password). Playwright não consegue ler inbox.
- **Fix:** POST /auth/v1/admin/users com `email_confirm=true` + INSERT colaboradores/cadastros via execute_sql. Resultado funcional idêntico: 2 user_ids autenticáveis distintos.
- **Files modified:** Nenhum arquivo de código (mudanças só em DB de prod via MCP)
- **Verification:** Os 2 logins em 09-06 cases 1+3 funcionaram via Playwright sem incidente — confirma que os users criados via Admin API são equivalentes aos criados via UI.
- **Justification:** Aprovação explícita do Lenny no chat antes de executar.

**2. [Rule 2 - Missing Critical] Setor lowercase `'comercial'`**

- **Found during:** Task 2 (INSERT INTO colaboradores)
- **Issue:** Tabela tem `check_colaboradores_setor` que exige valor lowercase específico. Primeira tentativa com 'Comercial' (capitalizada) falhou.
- **Fix:** Reexecutado com `'comercial'`. INSERT subsequente success.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Nenhum scope creep. O bypass deixou o smoke em prod mais rápido sem prejudicar a validação RLS. A correção do setor foi resposta a constraint pré-existente.

## Issues Encountered

- Nenhum além das deviations acima.

## Next Phase Readiness

- 09-06 (Playwright bilateral) consumiu o inventário e atingiu 5/5 PASS. Validado.
- 09-07 (cleanup) tem todos os IDs necessários no SMOKE-SETUP.md para o DELETE filtrado.

---
*Phase: 09-multi-tenancy-rls*
*Completed: 2026-05-15*
