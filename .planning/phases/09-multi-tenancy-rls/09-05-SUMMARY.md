---
phase: 09-multi-tenancy-rls
plan: 05
status: complete
date: 2026-05-14
---

# 09-05 SUMMARY — Smoke data setup

## Status

**SUCCESS** via SQL shortcut (aprovado por Lenny no checkpoint). 2 users + 4 cadastros criados em prod.

## What built

- 2 `auth.users` (`smoke-colab-a@aura-smoke.local`, `smoke-colab-b@aura-smoke.local`) com `email_confirmed_at` setado, password bcrypt nativo, identities `provider='email'` para login via senha
- 2 `allowed_users` entries (role=user)
- 2 `colaboradores` (setor=comercial, cpf/telefone preenchidos)
- 2 arquitetos: `Smoke A — Arq`, `Smoke B — Arq` (cada um do seu dono)
- 2 clientes: `Smoke A — Cli`, `Smoke B — Cli` (cada um do seu dono)
- `09-SMOKE-SETUP.md` documentando todos os UUIDs

## Method usado

SQL shortcut (insert direto via MCP `execute_sql` com owner token). Bypassa signup UI e edge function `create-colaborador`. JWT real será exercido no Playwright (09-06) — é onde a validação RLS realmente importa.

## Acceptance criteria

- ✅ 2 arquitetos `Smoke %` em prod
- ✅ 2 clientes `Smoke %` em prod
- ✅ 2 auth.users matching smoke email pattern
- ✅ 2 colaboradores associados aos user_ids
- ✅ 0 admin roles atribuídos (T-09-E03 mitigated)

## Próximo

09-06 (Playwright bilateral) — logar como A, B, e admin Lenny; assertar visibility.

## Cleanup pendente

09-07 fará DELETE dos cadastros/colabs/allowed_users. `auth.users` + `auth.identities` ficam como pending (precisa service_role ou Studio UI).
