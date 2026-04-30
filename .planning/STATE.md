---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
last_updated: "2026-04-30T12:23:26.162Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# STATE: AURA — Marco 1 (Melhorias v1)

**Last updated:** 2026-04-27 (after Phase 1 close)

## Project Reference

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** Marco 1 — Melhorias v1
- **Mode:** yolo
- **Granularity:** coarse
- **Current Focus:** Phase 02 — Cadastros & Arquiteto CRUD (próxima)

## Current Position

Phase: 01 (schema-prep) — COMPLETE
Plan: 3/3 done

- **Phase:** 3
- **Plan:** Not started
- **Status:** Ready to plan
- **Progress:** `[■□□□□□]` 1/6 phases complete

## Milestone Progress

| Phase | Requirements | Status |
|-------|--------------|--------|
| 1. Schema & Prep | 5 | Complete (2026-04-27) |
| 2. Cadastros & Arquiteto CRUD | 10 | Not started |
| 3. Produtos & Importação | 8 | Not started |
| 4. Drive RLS & Reorganização Admin | 9 | Not started |
| 5. PDF Redesign | 5 | Not started |
| 6. Filtros & Smoke | 5 | Not started |

**Total:** 42/42 requirements mapped (100% coverage)

## Performance Metrics

- **Phases completed:** 1/6
- **Requirements validated:** 5/42 (PREP-01, ARQ-01, ARQ-03, ARQ-04, ARQ-05)
- **Plans completed:** 3 (01-01, 01-02, 01-03)
- **Migrations aplicadas:** 4 (20260423000001..04)
- **Commits do marco:** 13 (5 schema + 5 docs/state + 3 hotfix/todos)

## Accumulated Context

### Key Decisions (from PROJECT.md)

| Decision | Rationale |
|----------|-----------|
| Arquiteto = entidade própria com FK | Filtros confiáveis, evita divergência textual, CRUD no admin |
| Representante = colaborador existente | Setor resolve; não inflacionar roles |
| Margem adiada para Marco 2 | Depende de tabela de custos que Lenny vai receber |
| CPF validado no signup | Dado vira base de comissões no futuro — entrar sujo cria passivo |
| Importação via CSV manual | Fluxo realista; integração ERP fica pra marco futuro |
| Reescrever PDF do zero | Redesign + remover caixas + texto limpo não se resolve com patch |
| Schema aditivo, nunca destrutivo | Dados de produção existem — colunas nullable, tabelas novas |
| UAT descartado, escopo reescrito sobre commits existentes | Histórico preservado, zero risco de reset destrutivo |

### Open Todos

- Executar Phase 1 (começando por PREP-01 — limpar git pendente antes de qualquer migration)
- Decidir destino das mudanças pendentes em `supabase/config.toml`, `supabase/functions/request-access/`, `supabase/functions/review-access/`, `supabase/.temp/` (commit ou revert)
- Planejar ordem das migrations aditivas (arquitetos primeiro, depois FKs em clientes/produtos, depois colunas em colaboradores/clientes)
- [todo] Admin > Orçamentos linha não clicável (`.planning/todos/pending/2026-04-27-admin-orcamentos-row-nao-clicavel.md`)
- [todo] PDF zuado — input pra Phase 5 (`.planning/todos/pending/2026-04-27-pdf-zuado-input-para-phase-5.md`)

### Blockers

- Nenhum no momento

### Context Notes

- **Produção em uso:** Vercel kappa (auraoramentos-kappa.vercel.app). Toda mudança precisa ser compatível com dados antigos
- **Infra:** Supabase `jkewlaezvrbuicmncqbj` (sa-east-1); Resend com `onboarding@resend.dev` (domínio próprio pendente, não bloqueia marco)
- **Stack congelada:** React 18 + Vite + TypeScript + Supabase + shadcn-ui — sem troca
- **Out of scope reforçado:** margem, refatoração de cálculos, comissões, role "representante", validação de CPF/CNPJ em cliente, testes automatizados, redesign geral de UI, integração ERP
- **Estado atual do codebase:** Wizard 3 steps funcional; admin com 5 abas; Drive sem RLS por colaborador; PDF com as 4 caixas a remover; 16 produtos "mentais" do Lenny ainda não cadastrados

## Session Continuity

### Last Session

- **Date:** 2026-04-27
- **Action:** Phase 1 smoke (Plan 03) — 5 testes manuais executados em prod (Vercel kappa + Supabase Dashboard); hotfix `b8dfc40` aplicado pra persistir aba de admin no F5; bugs pré-existentes capturados como todos
- **Outcome:** Phase 1 fechada. Schema novo (arquitetos + FKs + colunas em colaboradores/clientes) confirmado em prod sem regressão. 4 gaps documentados (orçamento não-clicável, PDF zuado, create-colaborador 401 fora do signup, request-access 409 UX) — nenhum bloqueia Phase 2

### Next Session

- **Suggested next action:** `/gsd-plan-phase 2`
- **Expected outcome:** Plano de execução para Phase 02 — Cadastros & Arquiteto CRUD (10 requirements: ARQ-02 admin CRUD + USR-01..03 frontend + CLI-01..02 frontend + autocomplete arquiteto no Step 1, etc.)

---
*STATE refreshed: 2026-04-27 após fechamento de Phase 1*
