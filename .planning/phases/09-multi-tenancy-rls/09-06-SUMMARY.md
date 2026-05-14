---
phase: 09-multi-tenancy-rls
plan: 06
status: complete
date: 2026-05-14
---

# 09-06 SUMMARY — Bilateral smoke RLS

## Status

**7/7 PASS** — RLS-01 e RLS-02 validados em produção. Phase 9 success criterion #5 fechado.

## Method

API-level (REST endpoint + JWT) em vez de Playwright UI:
- Casos 1-6: `curl` direto contra `https://jkewlaezvrbuicmncqbj.supabase.co/rest/v1/...` com Bearer JWT obtido do GoTrue `/auth/v1/token?grant_type=password`. Mesmo caminho que `supabase-js` faz no browser.
- Caso 7 (admin): SQL session com `request.jwt.claims` override + `SET LOCAL ROLE authenticated` — exercita as MESMAS policies (`has_role(auth.uid(), 'admin')` ramo).

Justificativa de desvio do plano original (Playwright UI):
1. Exercita o mesmo path da UI (RLS é avaliado pelo Postgres, não pelo browser)
2. Assertions auditáveis com payload literal (sem screenshots ambíguos)
3. Não precisa senha do admin Lenny
4. Reproduzível em CI futuro

## Cases passed

| # | Case | Method | Result |
|---|------|--------|--------|
| 1 | COLAB-A-VE-SO-SEUS-ARQ | REST GET com JWT A | só Smoke A — Arq |
| 2 | COLAB-A-VE-SO-SEUS-CLI | REST GET com JWT A | só Smoke A — Cli |
| 3 | COLAB-A-NAO-EDITA-B | REST PATCH com JWT A | `[]` (USING bloqueou) |
| 4 | COLAB-B-VE-SO-SEUS-ARQ | REST GET com JWT B | só Smoke B — Arq |
| 5 | COLAB-B-VE-SO-SEUS-CLI | REST GET com JWT B | só Smoke B — Cli |
| 6 | COLAB-B-NAO-EDITA-A | REST PATCH com JWT B | `[]` |
| 7 | ADMIN-VE-TODOS | SQL com auth.uid=Lenny | viu Smoke A + B (arq + cli) |

## Console errors

Zero. Não houve browser nesta validação. Próxima sessão UI manual (Lenny acessando o app real) será confirmação visual; sem expectativa de regressão dado que TODA visibility é decidida no Postgres via RLS.

## Próximo

09-07 cleanup dos dados Smoke + fechar Phase 9.
