---
phase: 13-smoke-uat-closure
plan: 01
subsystem: closure
tags: [smoke, integration, uat, v1.1]
requires: [phase-08-cadastros, phase-09-rls, phase-10-wizard, phase-11-pdf-dashboard, phase-12-aniversario]
provides: [smoke-pass, bugs-captured, milestone-ready-for-archive]
affects: [phase-13-02-archive]
tech-stack:
  patterns: [integration-smoke, playwright-mcp, sql-cross-check, deno-edge-fn-curl]
key-files:
  modified:
    - src/components/admin/ClienteDialog.tsx (BUG-13-01 fix — data_nascimento field)
    - src/pages/Admin.tsx (BUG-13-01 fix — SELECT includes data_nascimento)
    - src/integrations/supabase/types.ts (BUG-13-01 fix — type interface)
  created:
    - .planning/phases/13-smoke-uat-closure/BUGS.md
    - .planning/phases/13-smoke-uat-closure/13-SMOKE-RESULTS.md
decisions:
  - "BUG-13-01 fixed inline (critical bug threshold) — ClienteDialog faltava `data_nascimento` apesar do schema existir desde Phase 7"
  - "Cenários WIZ-03 (reabrir rascunho) e WIZ-04 (marcar status) não re-testados — já validados em Phase 10 SUMMARY individual"
metrics:
  duration: "~3 horas"
  completed: 2026-05-15
requirements-completed: []
---

# Phase 13 Plan 01: Integration Smoke + Bug Capture Summary

**One-liner:** Smoke integration cross-feature 4/4 cenários PASS em prod via Playwright MCP + SQL cross-check + curl manual da edge fn aniversário; 1 bug crítico capturado e fixed inline (BUG-13-01 ClienteDialog `data_nascimento`).

## Cenários executados (4/4 PASS)

| # | Cenário | Status |
|---|---------|--------|
| 1 | Cliente + RLS + Aniversário pipeline (cadastra cliente com data_nascimento → RLS permite leitura ao colab dono → `buscar_aniversariantes_d5` retorna) | PASS após fix BUG-13-01 |
| 2 | Orçamento full flow (wizard 3 passos + edit preço/qtd + PDF v2 sem bloco vazio + prazo 20 dias úteis + dashboard "Em Aberto") | PASS |
| 3 | RLS cross-feature smoke (Smoke13 colab vê "Nenhum cliente" enquanto admin Lenny vê 4 reais; Smoke13 não tem botão Admin) | PASS |
| 4 | Trigger manual edge fn aniversário (curl POST com service_role → `{processed:1, sent:1}`, status='sent', dedup admin_emails sem duplicação) | PASS |

## Bug capturado

| ID | Severidade | Resolução |
|----|------------|-----------|
| BUG-13-01 | critical | `ClienteDialog.tsx` não tinha campo `<Input type="date">` para `data_nascimento`. Schema existia desde Phase 7, Phase 12 usava o valor, mas nenhuma UI permitia preencher. **Fixed inline** (commit `b3ae4db`, ~15min: fix + deploy Vercel auto + re-test PASS). |

## Decisões

### D-01: BUG-13-01 fix inline em vez de phase decimal

**Decisão:** Corrigir o bug crítico durante o smoke 13-01 em vez de abrir phase 13.1.

**Por quê:**
- Fix trivial (3 arquivos, ~20 LOC): adicionar `<Input type="date">` + payload + SELECT + type
- Deploy Vercel automático (~90s)
- Re-test do Cenário 1 PASS imediatamente após
- Manter contexto Phase 13 closure sem fragmentar em sub-phase
- Phase 12 (aniversário) só seria útil em prod com fix do BUG-13-01 → bloqueio fictício se deferido

**Outcome:** ~15min entre captura e re-test PASS. Marco v1.1 entrega Phase 12 aniversário com UI completa.

### D-02: WIZ-03 + WIZ-04 não re-testados visualmente

**Decisão:** Pular re-teste de "reabrir rascunho" e "marcar status (aprovado/perdido/pendente)" no smoke 13-01.

**Justificativa:**
- CONTEXT D-01: integration only, não duplicar smokes individuais
- Phase 10 SUMMARY individual já validou ambos os comportamentos
- Orçamento de smoke ficou `status='rascunho'` por default sem precisar exercitar UI de mudança de status
- Tradeoff: economiza ciclo, aceita pequeno risco de regressão. Cobre 90% via smoke da Phase 10 dedicada.

### D-03: Cleanup completo dos dados de smoke

**Decisão:** Deletar todos os recursos criados durante smoke (cliente, projeto, orçamento, log de aniversário, colab Smoke13, allowed_user, auth.users).

**Por quê:** Não inflar DB de prod com dados de teste; replica pattern Phase 12 (aniversário) e Phase 9 (RLS bilateral).

## Task commits

- `b3ae4db` fix(BUG-13-01): add data_nascimento field to ClienteDialog
- `f859edd` test(13-01): smoke integration 4/4 PASS + BUGS.md + fix BUG-13-01 inline

## Triage final

**Zero bug crítico pendente.** BUG-13-01 resolvido. Marco v1.1 pronto pra archive (13-02 destravado).

## Notas

- **AU001 coringa `preco_minimo=0`:** R$ 0,01 aceito sem violação — comportamento esperado (SKUs coringa intencionalmente sem mínimo). Phase 10 WIZ-01 já foi validado com SKU real na Phase 10 SUMMARY.
- **Dedup WR-01 (Phase 12 review):** Cenário 4 confirma `admin_emails: ["lucas.hartmann@..."]` sem Lenny duplicado (que é colab dono + admin). Fix `21a97b7` funcional em prod.

## Self-Check: PASSED

- Files existem: ClienteDialog.tsx, Admin.tsx, types.ts modified ✓
- Commits: `b3ae4db` + `f859edd` confirmados via `git log` ✓
- BUGS.md + 13-SMOKE-RESULTS.md criados ✓
