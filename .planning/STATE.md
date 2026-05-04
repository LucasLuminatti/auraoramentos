---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-04T17:47:25.463Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 18
  completed_plans: 12
  percent: 67
---

# STATE: AURA — Marco 1 (Melhorias v1)

**Last updated:** 2026-04-30 (after Phase 3 close)

## Project Reference

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** Marco 1 — Melhorias v1
- **Mode:** yolo
- **Granularity:** coarse
- **Current Focus:** Phase 04 — Drive RLS & Reorganização Admin (próxima)

## Current Position

Phase: 03 (produtos-importa-o) — COMPLETE (2026-04-30)
Plan: 5/5 done

- **Phase:** 4
- **Plan:** Not started
- **Status:** Ready to execute
- **Progress:** `[■■■□□□]` 3/6 phases complete

## Milestone Progress

| Phase | Requirements | Status |
|-------|--------------|--------|
| 1. Schema & Prep | 5 | Complete (2026-04-27) |
| 2. Cadastros & Arquiteto CRUD | 10 | Complete (2026-04-27) |
| 3. Produtos & Importação | 8 | Complete (2026-04-30) — 6 entregues, PROD-02 obsoleto (D-09), IMP-02 deferido (D-18) |
| 4. Drive RLS & Reorganização Admin | 9 | Not started |
| 5. PDF Redesign | 5 | Not started |
| 6. Filtros & Smoke | 5 | Not started |

**Total:** 42/42 requirements mapped (100% coverage); 23 Complete + 1 Obsolete + 1 Deferred + 17 Pending

## Performance Metrics

- **Phases completed:** 3/6
- **Requirements validated:** 23/42 (Phase 1: PREP-01, ARQ-01/03/04/05; Phase 2: USR-01/02/03/04, CLI-01/02/03, ARQ-02, PROD-03/04; Phase 3: PROD-01, IMP-01/03/04/05/06)
- **Plans completed:** 12 (Phase 1: 3, Phase 2: 4, Phase 3: 5)
- **Migrations aplicadas:** 7 (20260423000001..04 + 20260501000001 products_and_variants + 20260501000002 storage_bucket_produtos_imagens + 20260501000003 seed_au_coringa)
- **Edge fns deployadas:** create-colaborador (Phase 2) + import-produtos refatorada (Phase 3 Plan 04)

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
| D-09: PROD-02 obsoleto | DB já tinha 0 produtos sem desc/preço; AU001..16 cobrem uso real |
| D-18: IMP-02 deferido | Preço atualiza 1x/mês em produção — operação periódica, não diária |

### Open Todos

- Phase 4 (Drive RLS & Reorganização Admin) — começa pelo `/gsd-discuss-phase 4` para capturar contexto
- [todo] Admin > Orçamentos linha não clicável (`.planning/todos/pending/2026-04-27-admin-orcamentos-row-nao-clicavel.md`)
- [todo] PDF zuado — input pra Phase 5 (`.planning/todos/pending/2026-04-27-pdf-zuado-input-para-phase-5.md`)

### Blockers

- Nenhum no momento

### Context Notes

- **Produção em uso:** Vercel kappa (auraoramentos-kappa.vercel.app). Toda mudança precisa ser compatível com dados antigos
- **Infra:** Supabase `jkewlaezvrbuicmncqbj` (sa-east-1); Resend com `onboarding@resend.dev` (domínio próprio pendente, não bloqueia marco)
- **Stack congelada:** React 18 + Vite + TypeScript + Supabase + shadcn-ui — sem troca
- **Out of scope reforçado:** margem, refatoração de cálculos, comissões, role "representante", validação de CPF/CNPJ em cliente, testes automatizados, redesign geral de UI, integração ERP
- **Estado atual do codebase:** Wizard 3 steps funcional; admin com abas reorganizadas; Drive sem RLS por colaborador; PDF com as 4 caixas a remover; schema products+product_variants em prod; AU001..16 seedados; ImportMaster + ImportProdutos operacionais
- **Bucket antigo:** `produto-imagens` (singular) não deletado na Phase 3 — decisão futura Phase 4 ou Quick

## Session Continuity

### Last Session

- **Date:** 2026-04-30
- **Action:** Phase 3 (Produtos & Importação) fechada — 5 plans aplicados (schema redesign products+product_variants com view de compat; seed AU001..16; ProdutoEditDialog estendido; ImportMaster + ImportProdutos refatorado + Imagens migrada para bucket plural; REQUIREMENTS atualizado)
- **Outcome:** Phase 3 entregue. 6/8 requirements feitos (PROD-01 + IMP-01/03/04/05/06), PROD-02 marcado obsoleto via D-09 (DB já tinha 0 produtos sem desc/preço), IMP-02 deferido via D-18 (preço entra em phase futura). Schema aditivo OK; snapshots antigos preservados; wizard de orçamento e admin continuam funcionais

### Next Session

- **Suggested next action:** `/gsd-discuss-phase 4`
- **Expected outcome:** Captura de contexto da Phase 4 — Drive RLS & Reorganização Admin (9 requirements: ACC-01..04 + ADM-01..05). Decisões locked sobre RLS por colaborador, visualização de pedido, tela de preços (que depende de IMP-02 deferido), abas reorganizadas, dashboard inicial

---
*STATE refreshed: 2026-04-30 após fechamento de Phase 3 — 23/42 requirements validated, 50% das phases completed*
