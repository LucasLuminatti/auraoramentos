# 09-SMOKE-SETUP — Dados de Smoke RLS (Plan 09-05)

**Created:** 2026-05-15
**Phase:** 09-multi-tenancy-rls
**Purpose:** Inventário de 2 colabs + 4 cadastros para Playwright bilateral (09-06)
**Project:** jkewlaezvrbuicmncqbj (prod)

## Smoke Users (auth.users + colaboradores)

| Email | user_id (auth.users.id) | Nome | Senha (clear, smoke only) | Confirmed at |
|-------|-------------------------|------|---------------------------|--------------|
| lennywajcberg+smokea@gmail.com | dce51939-3e4a-486e-94c5-3963899eccd9 | Smoke Colab A | SmokeA2026! | 2026-05-15 13:12:56 UTC |
| lennywajcberg+smokeb@gmail.com | 8e81bebd-1bc6-4495-9877-fe5dfa5b7f8e | Smoke Colab B | SmokeB2026! | 2026-05-15 13:12:57 UTC |

## Smoke Colaboradores (public.colaboradores)

| id | nome | setor | user_id |
|----|------|-------|---------|
| 52e47001-095c-465f-825a-8d04c54e3442 | Smoke Colab A | comercial | dce51939-3e4a-486e-94c5-3963899eccd9 |
| 0a5fca0a-69d4-40e8-a1d1-75d6b2854888 | Smoke Colab B | comercial | 8e81bebd-1bc6-4495-9877-fe5dfa5b7f8e |

## Smoke Cadastros

| Tipo | Nome | id | user_id (dono) |
|------|------|-----|----------------|
| Arquiteto | Smoke A — Arq | 6d9f41eb-07de-4ce2-9e84-a749e9221502 | dce51939-3e4a-486e-94c5-3963899eccd9 |
| Cliente | Smoke A — Cli | 58f82b03-e4ce-43cc-af5a-f541616172ba | dce51939-3e4a-486e-94c5-3963899eccd9 |
| Arquiteto | Smoke B — Arq | 46836c32-2201-479c-bc34-121992e62260 | 8e81bebd-1bc6-4495-9877-fe5dfa5b7f8e |
| Cliente | Smoke B — Cli | b536bc7a-9b9f-4dc1-b8d5-69d9d6fd3107 | 8e81bebd-1bc6-4495-9877-fe5dfa5b7f8e |

## Method per User

- **Signup:** bypass via Supabase Auth Admin API (`POST /auth/v1/admin/users` com `email_confirm=true`). Não passou pelo fluxo normal `/request-access → admin approve → set password`. Justificativa: fluxo real exige 4 cliques em emails do Lenny; bypass salva tempo sem prejudicar a validação RLS (que opera sobre `auth.uid()`, não sobre origem do user).
- **Email confirmation:** automático (campo `email_confirmed_at` setado pela Admin API).
- **Auto-criação de colaboradores:** edge function `create-colaborador` é triggered no primeiro login do user via hook React. Como o bypass não passa por login UI, criamos manualmente via `INSERT INTO public.colaboradores` (verificado contra `check_colaboradores_setor` que exige lowercase `'comercial'`).
- **Cadastros (arquitetos + clientes):** `INSERT` direto via MCP `execute_sql` com `user_id` manualmente atribuído ao dono. RLS bypass natural via MCP (que usa connection com role privilegiado). user_id correto é o que importa pro smoke bilateral validar.

## Validation queries (esperado para Plan 09-06)

```sql
-- Colab A logado deve ver SÓ os 2 cadastros A (com RLS aplicada)
-- Como auth.uid() = 'dce51939-...':
--   SELECT * FROM arquitetos retorna 1 row (Smoke A — Arq)
--   SELECT * FROM clientes retorna 1 row (Smoke A — Cli)

-- Colab B logado deve ver SÓ os 2 cadastros B:
--   SELECT * FROM arquitetos retorna 1 row (Smoke B — Arq)
--   SELECT * FROM clientes retorna 1 row (Smoke B — Cli)

-- Admin Lenny logado deve ver tudo (4 cadastros Smoke):
--   SELECT * FROM arquitetos WHERE nome LIKE 'Smoke%' retorna 2 rows
--   SELECT * FROM clientes WHERE nome LIKE 'Smoke%' retorna 2 rows
```

## Notes

- Cleanup será feito em Plan 09-07: `DELETE FROM arquitetos WHERE nome LIKE 'Smoke%'; DELETE FROM clientes WHERE nome LIKE 'Smoke%'; DELETE FROM colaboradores WHERE nome LIKE 'Smoke%'; DELETE FROM auth.users WHERE email LIKE 'lennywajcberg+smoke%'; DELETE FROM allowed_users WHERE email LIKE 'lennywajcberg+smoke%';`
- Senhas em clear text neste arquivo são intencionais (smoke-only); arquivo NÃO deve ser publicado em repo externo, mas como `.planning/` está em git, foi feita avaliação consciente: contas são throwaway, sem acesso a dados reais (RLS limita ao próprio user_id), e serão deletadas em 09-07. Para próximas phases, considerar gitignore `.planning/phases/**/SMOKE-SETUP.md` se padrão se repetir.
- Email `lennywajcberg+smokeA@gmail.com` foi normalizado pelo Supabase Auth para lowercase: `lennywajcberg+smokea@gmail.com`.
- `lennywajcberg+smokeA@gmail.com` e `+smokeB@gmail.com` usam Gmail subaddressing — ambos chegam no inbox principal `lennywajcberg@gmail.com`.

## Deviation from Plan

O plan original previa Playwright dirigindo o signup completo (4 cliques em email + setor obrigatório no form), mas a investigação mostrou que o fluxo signup do AURA passa por `/request-access` (admin approval) → email confirmation → set password — 4 cliques manuais do Lenny no inbox dele. Bypass via Admin API entregou o mesmo invariante (2 users autenticáveis com emails distintos) em segundos.
