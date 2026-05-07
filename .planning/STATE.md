---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 2 of 5
status: executing
last_updated: "2026-05-07T19:48:01.825Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 28
  completed_plans: 24
  percent: 86
---

# STATE: AURA — Marco 1 (Melhorias v1)

**Last updated:** 2026-05-04 (after Phase 4 close)

## Project Reference

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** Marco 1 — Melhorias v1
- **Mode:** yolo
- **Granularity:** coarse
- **Current Focus:** Phase 06 — filtros-smoke

## Current Position

Phase: 06 (filtros-smoke) — EXECUTING
Current Plan: 2 of 5
Total Plans in Phase: 5

- **Phase:** 6
- **Plan:** 06-01 complete (ArquitetoAutocomplete mode='filter')
- **Status:** Executing Phase 06
- **Progress:** `[■■■■□□]` 4/6 phases complete

## Milestone Progress

| Phase | Requirements | Status |
|-------|--------------|--------|
| 1. Schema & Prep | 5 | Complete (2026-04-27) |
| 2. Cadastros & Arquiteto CRUD | 10 | Complete (2026-04-27) |
| 3. Produtos & Importação | 8 | Complete (2026-04-30) — 6 entregues, PROD-02 obsoleto (D-09), IMP-02 deferido (D-18) |
| 4. Drive RLS & Reorganização Admin | 9 | Complete (2026-05-04) — 9 entregues (ACC-01..04 + ADM-01..05) |
| 5. PDF Redesign | 5 | Not started |
| 6. Filtros & Smoke | 5 | Not started |

**Total:** 42/42 requirements mapped (100% coverage); 30 Complete + 1 Obsolete + 1 Deferred + 10 Pending

## Performance Metrics

- **Phases completed:** 4/6
- **Requirements validated:** 30/42 (Phase 1: PREP-01, ARQ-01/03/04/05; Phase 2: USR-01/02/03/04, CLI-01/02/03, ARQ-02, PROD-03/04; Phase 3: PROD-01, IMP-01/03/04/05/06; Phase 4: ACC-01/02/03/04, ADM-01/02/03/04/05)
- **Plans completed:** 19 (Phase 1: 3, Phase 2: 4, Phase 3: 5, Phase 4: 6, Phase 6: 1)
- **Phase 6 metrics:** P01 — 1min, 1 task, 1 file
- **Migrations aplicadas:** 9 (20260423000001..04 + 20260501000001 products_and_variants + 20260501000002 storage_bucket_produtos_imagens + 20260501000003 seed_au_coringa + 20260504000001 drive_rls_user_id + 20260504000002 arquivo_url_nullable)
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
| Phase 4 D-02 errata: user_id em vez de colaborador_id em cliente_arquivos/arquivo_pastas | RLS direta com auth.uid(), evita confusão entre colaboradores.id e auth.uid() (Pitfall 1 do RESEARCH) |
| Phase 4 D-09 errata: Storage policy via tabela cliente_arquivos, não path-prefix | Não migrar paths de objetos legados; Estratégia B do RESEARCH evita Pitfall 3 |
| Phase 4 D-26 errata: Dashboard como sub-tab Início, não rota separada | Consistência com tab strip; ?tab=inicio default |
| Phase 06 P01: ArquitetoAutocomplete com prop opcional `mode='filter'` + callback estendido com `kind` ('arquiteto'\|'none'\|'all') | Foundation reutilizável para filtros das tabs Cadastros/Pedidos (Plans 02/03/04); retro-compat total com ClienteDialog/ProdutoEditDialog |

### Open Todos

- Phase 5 (PDF Redesign) — começa pelo `/gsd-discuss-phase 5` para capturar contexto
- [todo] PDF zuado — input pra Phase 5 (`.planning/todos/pending/2026-04-27-pdf-zuado-input-para-phase-5.md`)

### Blockers

- Nenhum no momento

### Context Notes

- **Produção em uso:** Vercel kappa (auraoramentos-kappa.vercel.app). Toda mudança precisa ser compatível com dados antigos
- **Infra:** Supabase `jkewlaezvrbuicmncqbj` (sa-east-1); Resend com `onboarding@resend.dev` (domínio próprio pendente, não bloqueia marco)
- **Stack congelada:** React 18 + Vite + TypeScript + Supabase + shadcn-ui — sem troca
- **Out of scope reforçado:** margem, refatoração de cálculos, comissões, role "representante", validação de CPF/CNPJ em cliente, testes automatizados, redesign geral de UI, integração ERP
- **Estado atual do codebase:** Wizard 3 steps funcional; admin reorganizado em 5 sub-tabs (Início/Cadastros/Pedidos/Preços/Exceções) com URL state; Drive com RLS user_id + bucket privado + signed URLs (Phase 4); PrecosBatch operacional em Preços > Atualização; OrcamentoDetalhe `/admin/orcamento/:id` read-only com Re-emitir PDF; PDF com as 4 caixas a remover; schema products+product_variants em prod; AU001..16 seedados; ImportMaster + ImportProdutos operacionais
- **Bucket antigo:** `produto-imagens` (singular) não deletado na Phase 3 — decisão futura Phase 4 ou Quick

## Session Continuity

### Last Session

- **Date:** 2026-05-07
- **Action:** Phase 6 Plan 01 executado (ArquitetoAutocomplete mode='filter') — prop opcional `mode: 'select' | 'filter'` adicionada (default 'select'); item `[Todos]` (ícone ListFilter) prepended em mode='filter'; callback estendido com 2º arg opcional `kind: 'arquiteto' | 'none' | 'all'` para desambiguar `null`. ClienteDialog/ProdutoEditDialog não tocados (retro-compat via TypeScript)
- **Outcome:** Foundation pronta para Plans 02/03/04 (filtros nas tabs Cadastros > Clientes, Cadastros > Produtos, Pedidos). 1 commit (`18de780`); FIL-01/02/03 marcados como provided pelo plan (validação real virá ao consumir nos Plans 02/03/04). TypeScript clean nos 3 arquivos relacionados; ESLint clean

### Next Session

- **Suggested next action:** `/gsd-execute-phase 06` continuando com Plan 06-02 (filtro arquiteto em Cadastros > Clientes)
- **Expected outcome:** Plan 02 consome `<ArquitetoAutocomplete mode="filter" />` no header da tab Cadastros > Clientes; sincroniza estado com URL param `?arq_clientes=<uuid|none>`; query Supabase filtra `clientes.arquiteto_id` via `.eq()` / `.is(null)` ou ausente conforme D-04/D-07 do CONTEXT

---
*STATE refreshed: 2026-05-07 após Phase 6 Plan 01 — ArquitetoAutocomplete pronto para reuso como filtro*
