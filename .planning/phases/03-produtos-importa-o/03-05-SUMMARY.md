---
phase: 03-produtos-importa-o
plan: 05
subsystem: docs-closure
tags: [docs, requirements, state, roadmap, closure]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-04]
  provides: [phase-3-closure, requirements-status-updated, state-phase4-ready]
  affects: []
tech_stack:
  added: []
  patterns: [docs-only, planning-closure]
key_files:
  created:
    - .planning/phases/03-produtos-importa-o/03-05-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
decisions:
  - "D-09 formalizado: PROD-02 marcado OBSOLETO em REQUIREMENTS.md — DB confirmou 0 produtos sem desc/preco em 2026-04-30"
  - "D-18 formalizado: IMP-02 marcado DEFERIDO em REQUIREMENTS.md — preco mensal e operacao periodica justificam phase futura"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-30"
  tasks_completed: 3
  files_created: 0
  files_modified: 3
---

# Phase 3 Plan 05: Fechamento Documental da Phase 3 — Summary

**One-liner:** Fechamento documental da Phase 3 — REQUIREMENTS.md com PROD-02 obsoleto (D-09) e IMP-02 deferido (D-18); STATE.md cursor avança para Phase 4; ROADMAP.md 3/6 phases marcadas [x] com progress table atualizada.

## Tasks Executadas

| Task | Descrição | Commit | Status |
|------|-----------|--------|--------|
| 1 | REQUIREMENTS.md — PROD-02 obsoleto + IMP-02 deferido + traceability + coverage status | `26fd195` | OK |
| 2 | STATE.md — Phase 3 Complete, cursor Phase 4, metrics atualizados | `bb7e0ba` | OK |
| 3 | ROADMAP.md — [x] nas 3 phases + 5 plans da Phase 3 + progress table + footer | `a7a4509` | OK |

## Resumo dos 5 Plans da Phase 3

| Plan | One-liner |
|------|-----------|
| 03-01 | Schema aditivo: RENAME produtos→product_variants, tabela products, pai dummy P-LEGADO, view backward-compat produtos, bucket produtos-imagens |
| 03-02 | 16 AU coringa seedados (AU001..AU016, origem='coringa', editado_manualmente=true); parsers puros parseTensao/parsePotencia; reconcile() D-05..D-10 com invariante testado; 37 tests |
| 03-03 | ProdutoEditDialog estendido (mode=create+edit), uploadProdutoImagem (bucket plural, path sanitizado), botão "+ Novo Produto" no Admin; WRITE migrado de view para product_variants |
| 03-04 | ImportMaster (one-shot XLSX 2088 SKUs + reconcile); ImportProdutos refatorada (CSV diário, preview create/update/erro, template baixável, imagem_url); ImportImagens migrada bucket plural; edge fn import-produtos refatorada (D-05 invariante, variant-only updates) |
| 03-05 | Fechamento documental: REQUIREMENTS.md (PROD-02 obsoleto D-09, IMP-02 deferido D-18), STATE.md (Phase 3 Complete, cursor Phase 4), ROADMAP.md (checkboxes + progress table) |

## Phase 3 Stats

- **Requirements endereçados:** 8/8 (6 entregues + 1 obsoleto + 1 deferido)
- **Plans aplicados:** 5 (03-01 a 03-05)
- **Migrations criadas:** 3 (20260501000001 products_and_variants + 20260501000002 storage_bucket + 20260501000003 seed_au_coringa)
- **Edge fn refatorada:** 1 (import-produtos — D-05 invariante garantido)
- **Sub-tabs configuradas:** 4 (Master / Produtos / Imagens / Precos desabilitado D-18)
- **Testes adicionados:** 37 (Plan 02 — parsers puros + reconcile)
- **Lint count:** 51 antes e depois (sem regressão)

## Decisões Executadas Neste Plan

| Decisão | Resultado |
|---------|-----------|
| D-09 | PROD-02 marcado `[~] OBSOLETO` em REQUIREMENTS.md + traceability `OBSOLETE (D-09)` |
| D-18 | IMP-02 marcado `[~] DEFERIDO` em REQUIREMENTS.md + traceability `DEFERRED (D-18)` |
| D-19 | Mencionado no texto do IMP-02 deferido — schema reserva preco_tabela/preco_minimo intocados |
| D-20 | Mencionado no texto do IMP-02 deferido — quando entrar: bloqueia upload se SKU desconhecido |

## Próximo Passo

`/gsd-discuss-phase 4` — Drive RLS & Reorganização Admin (9 requirements: ACC-01..04 + ADM-01..05).

Decisões a capturar na discussão:
- RLS por colaborador no Drive (ACC-01..04) — storage path vs metadata table
- Visualização detalhada de pedido (ADM-01) — modal ou página dedicada
- Tela de preços (ADM-02) — depende de IMP-02 deferido; pode antecipar via edição inline
- Reorganização de abas (ADM-04) — Cadastros / Pedidos / Precos / Excecoes
- Dashboard inicial (ADM-05) — manter simplificado ou remover

## Nota: Bucket Antigo

`produto-imagens` (singular) NÃO foi deletado nesta phase. Todos os novos uploads vão para `produtos-imagens` (plural). Bucket antigo: admin pode listar/deletar via Supabase Dashboard quando quiser. Decisão de cleanup adiada para Phase 4 ou Quick — não bloqueia nada.

## Deviations from Plan

None — plan era puramente documental. 3 arquivos .planning/* atualizados exatamente conforme especificado. Nenhum arquivo de código de produção tocado.

## Known Stubs

None — plan não cria UI nem código. Documentação reflete estado real do projeto.

## Threat Flags

None — apenas arquivos .planning/* editados. Nenhuma nova superfície de segurança.

## Self-Check: PASSED

- `.planning/REQUIREMENTS.md` — FOUND, contém PROD-02 (OBSOLETO — D-09) e IMP-02 (DEFERIDO — D-18)
- `.planning/STATE.md` — FOUND, completed_phases: 3, cursor Phase 4, 23/42 requirements validated
- `.planning/ROADMAP.md` — FOUND, [x] Phase 1/2/3, 5/5 Complete 2026-04-30, footer atualizado
- Commits: `26fd195`, `bb7e0ba`, `a7a4509` — todos no git log
