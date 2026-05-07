---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 5
status: executing
last_updated: "2026-05-07T20:10:12.305Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 28
  completed_plans: 27
  percent: 96
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
Current Plan: 5
Total Plans in Phase: 5

- **Phase:** 6
- **Plan:** 06-03 complete (filtro arquiteto em Cadastros > Produtos com search combinado)
- **Status:** Ready to execute
- **Progress:** [██████████] 96%

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
- **Plans completed:** 21 (Phase 1: 3, Phase 2: 4, Phase 3: 5, Phase 4: 6, Phase 6: 3)
- **Phase 6 metrics:** P01 — 1min, 1 task, 1 file; P02 — 3min, 1 task, 1 file; P03 — 2min, 1 task, 1 file
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
| Phase 06 P02: filtro Cadastros>Clientes via URL `?arq_clientes=<uuid\|none>`; `fetchClientes(arqFilter)` com `.eq()` / `.is(null)` / sem cláusula; pattern reaplicado nos Plans 03/04 | Filtro Supabase-side (D-07), URL como source of truth (D-03/D-04), 3 estados claros, empty state diferenciado |
| Phase 06 P03: filtro Cadastros>Produtos via URL `?arq_produtos=<uuid\|none>` AND-chained com search por código/descrição; `fetchProdutos(search, arqFilter)` refatorado; effect debounce único `[produtoSearch, arqProdutosParam]`; empty state com 4 branches | Combinação search+filter na mesma query Supabase (PostgREST AND natural); pattern de matriz de empty state escalável para Plan 04 (Pedidos com cliente+período+status) |
| Phase 06 P06-04 | 4min | 2 tasks | 2 files |

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
- **Action:** Phase 6 Plan 03 executado (filtro arquiteto em Cadastros > Produtos com search combinado) — `<ArquitetoAutocomplete mode="filter" />` no header da tab Produtos, à direita do search por código/descrição existente; URL `?arq_produtos=<uuid|none>` como source of truth; `fetchProdutos(search, arqFilter)` refatorado com 2 critérios AND-chained (`.or()` + `.eq()`/`.is()`); effect de debounce unificado em `[produtoSearch, arqProdutosParam]`; initial mount fetchProdutos('') removido; empty state com 4 branches (search+filter, filter só, search só, neither); 2 ProdutoEditDialog onSuccess preservam search+filtro; outras tabs intocadas
- **Outcome:** FIL-02 entregue (filtro Produtos por arquiteto, combinável com search). 1 commit (`0d5af92`); pattern de combinação search+filter (AND-chain natural via PostgREST) documentado no SUMMARY para reuso direto no Plan 04 (Pedidos com filtros adicionais cliente/período/status). TypeScript clean em Admin.tsx (zero erros novos); ESLint sem regressão (7 erros `no-explicit-any` idênticos a HEAD pré-diff). Code-review manual sobre o diff — clean, sem findings. **Playwright MCP NÃO executado** (ferramenta não disponível neste agent thread; instrução explícita do orchestrator: validação no Wave 5); curl em `localhost:8080/admin` + módulo Admin.tsx ambos retornaram 200

### Next Session

- **Suggested next action:** `/gsd-execute-phase 06` continuando com Plan 06-04 (filtros Pedidos com JOIN clientes!inner + cliente + período + status)
- **Expected outcome:** Plan 04 escala o pattern dos Plans 02/03 — URL com 4+ params (`arq_pedidos`, `cli_pedidos`, `de`, `ate`, `status`), `fetchOrcamentos` aceita 5 critérios; arquiteto via JOIN `clientes!inner(arquiteto_id)` (D-11); layout com popover "Filtros" para mobile (D-06); empty state simplificado por presença de "qualquer filtro ativo" em vez de matriz combinatória

---
*STATE refreshed: 2026-05-07 após Phase 6 Plan 03 — filtro Produtos por arquiteto + search combinado entregue (FIL-02); pattern search+filter AND-chained pronto para Plan 04*
