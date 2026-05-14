# 09-SMOKE-SETUP — Dados de Smoke RLS (Plan 09-05)

**Created:** 2026-05-14T15:58:00Z
**Phase:** 09-multi-tenancy-rls
**Purpose:** Inventário de 2 colabs + 4 cadastros para Playwright bilateral (09-06)
**Method:** SQL shortcut (aprovado por Lenny — `AskUserQuestion` "Atalho SQL: skip signup UI"). Bypassa o fluxo UI de signup mas exercita o caminho mais crítico: o JWT do colab no Playwright (09-06) é o que efetivamente valida as policies RLS.

---

## Smoke Users (auth.users + colaboradores)

| Email | user_id (auth.users.id) | Nome | Senha (clear, smoke only) | Confirmed at |
|-------|-------------------------|------|---------------------------|--------------|
| smoke-colab-a@aura-smoke.local | `59ae4002-c9bd-4fbf-82ab-3551f470d189` | Smoke Colab A | `SmokeA2026!` | 2026-05-14T15:58Z |
| smoke-colab-b@aura-smoke.local | `d2f20ee9-c267-414e-a3e6-cce3589d687a` | Smoke Colab B | `SmokeB2026!` | 2026-05-14T15:58Z |

## Smoke Cadastros

| Tipo | Nome | id | user_id (dono) |
|------|------|----|----------------|
| Arquiteto | Smoke A — Arq | `b73dba08-f3a2-40b4-9848-8cdcb6a106bf` | `59ae4002-c9bd-4fbf-82ab-3551f470d189` |
| Cliente | Smoke A — Cli | `6fc3a8f1-8503-47c1-9750-11f8c13a394d` | `59ae4002-c9bd-4fbf-82ab-3551f470d189` |
| Arquiteto | Smoke B — Arq | `3726d6d4-df1c-4464-8aad-306ca8ecc52e` | `d2f20ee9-c267-414e-a3e6-cce3589d687a` |
| Cliente | Smoke B — Cli | `7c1a6eca-8bb6-4d0c-b144-1d47d4fa9eed` | `d2f20ee9-c267-414e-a3e6-cce3589d687a` |

## Method per User

- **Signup**: bypassed (insert direto em `auth.users` via MCP owner token, `email_confirmed_at` setado para `now()`)
- **auth.identities**: row provider='email' criada para cada user (Supabase exige isso para login via senha)
- **Password hash**: `crypt('SmokeX2026!', gen_salt('bf'))` — bcrypt nativo do Postgres, formato aceito pelo GoTrue
- **allowed_users**: ambos inseridos com `role='user'`
- **colaboradores**: criado manualmente (a edge function `create-colaborador` normalmente faz isso no primeiro login, mas aqui antecipamos via SQL para o Playwright achar tudo pronto). `setor='comercial'` (valor válido do check constraint `check_colaboradores_setor`: `{comercial, projetos, logistica, financeiro}`).
- **Cadastros**: insert direto via SQL (owner token bypassa RLS) com `user_id` explícito do dono — comportamento RLS real será validado em 09-06 quando o Playwright loga via UI e o JWT do colab limita visibility.

## Acceptance Verification

| Check | Result |
|-------|--------|
| `SELECT count(*) FROM public.arquitetos WHERE nome LIKE 'Smoke %'` | 2 ✅ |
| `SELECT count(*) FROM public.clientes WHERE nome LIKE 'Smoke %'` | 2 ✅ |
| `SELECT count(*) FROM auth.users WHERE email LIKE 'smoke-colab-%@aura-smoke.local'` | 2 ✅ |
| `SELECT count(*) FROM public.colaboradores WHERE user_id IN (uuid_a, uuid_b)` | 2 ✅ |
| `SELECT count(*) FROM public.user_roles WHERE user_id IN (uuid_a, uuid_b) AND role='admin'` | 0 ✅ (T-09-E03 mitigated) |

## Notes

- **Cleanup**: 09-07 fará DELETE de arquitetos/clientes/colaboradores `Smoke %`. `auth.users` e `auth.identities` ficam como pending cleanup (Supabase Auth admin API ou Studio UI necessário; service_role não exposto neste fluxo). Documentado em `[[project_aura_pending_cleanup]]`.
- **Senhas em clear text**: intencional para smoke; arquivo NÃO deve ser publicado em repo externo (já está em `.planning/` que é privado).
- **`@aura-smoke.local` TLD**: reservado por design (RFC 6761) — emails não roteam, perfeitos para smoke local.
- **JWT real será exercido em 09-06**: Playwright vai logar como smoke A / smoke B com as senhas acima, obter JWT do GoTrue, e atestar que `SELECT * FROM arquitetos`/`clientes` retorna apenas os cadastros do próprio user_id (validando a policy `Colabs read own...`).
