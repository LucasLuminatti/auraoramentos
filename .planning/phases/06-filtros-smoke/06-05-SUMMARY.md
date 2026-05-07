# Plan 06-05 — WRAP-UAT Smoke Test Marco 1 (SUMMARY)

**Status:** delivered (with checkpoint pending)
**Created:** 2026-05-07
**Plan:** [.planning/phases/06-filtros-smoke/06-05-PLAN.md](./06-05-PLAN.md)

## What was built

- `.planning/phases/06-filtros-smoke/06-WRAP-UAT.md` — UAT-style smoke checklist com 8 itens (D-09) cobrindo todos os fluxos do Marco 1.
- 6 itens automatizáveis executados via Playwright MCP em produção (https://orcamentosaura.com.br):
  - #2 Cliente novo com arquiteto — passed
  - #3 Orçamento completo + PDF v2 — passed (visual pendente)
  - #4 PDF re-emit do #3 — passed
  - #5 Snapshot legacy renderiza PDF v1 — passed-pending-visual
  - #6 Importar CSV — passed
  - #8 Filtros Phase 6 (FIL-01..04) — passed (12 cenários verificados)
- 2 itens manuais pending para Lenny:
  - #1 Signup novo (provider externo)
  - #7 Drive isolado entre 2 contas

## Pre-deploy gap detected

Antes de rodar Playwright em prod, descobrimos que **41 commits** locais (Phase 5 + Phase 6 inteiras) **nunca foram pushed** para `origin/main`. Lenny aprovou push (opção a) — `git push origin main` em `eb1e73a`, Vercel auto-deployou em ~3min, smoke prosseguiu em prod com Phase 6 código deployado.

## Findings

- **0 regressões reais** detectadas nos fluxos automatizados.
- **0 erros JS** no console em todos os fluxos.
- **Backwards-compat Plan 01 confirmado em prod:** ClienteDialog (`mode='select'` implícito) não exibe `[Todos]` — só `[Nenhum arquiteto]` + lista. Plans 02/03/04 (`mode='filter'`) exibem `[Todos]` + `[Nenhum arquiteto]` + lista.
- **Filtros isolados E combinados funcionam:**
  - URL state hydrates (refresh, bookmark).
  - Sentinel `none` = `arquiteto_id IS NULL` em Clientes/Produtos; em Pedidos via `clientes!inner(arquiteto_id)` JOIN.
  - Empty states diferenciados: "Nenhum cliente vinculado a este arquiteto" / "Nenhum pedido bate com os filtros aplicados".
  - Mobile (375px): popover + badge contador funcionam.
  - "Limpar filtros" zera URL.
  - Linha clicável Pedidos (ADM-01) preservada.
- **Import CSV:** preview "Criar X / Atualizar Y" + confirmação OK; SMOKE-001 apareceu em Cadastros>Produtos.
- **Wizard 3 passos:** Step1 → Step2 (1 ambiente, 1 luminária qtd × preço) → Step3 → "Gerar PDF" baixou v2 (506 KB).
- **Re-emit:** orçamento smoke #3 baixou PDF idêntico via `/admin/orcamento/:id`.
- **Legacy PDF (v1):** orçamento de 26/04/2026 (pré-Phase-5, `pdf_template_version IS NULL`) re-emit baixou 604 KB — **inspeção visual ainda pendente** (Lenny).

## Outstanding human work (checkpoint Task 2)

| # | Item | Quem | Notas |
|---|------|------|-------|
| 1 | Signup novo end-to-end | Lenny | Aba anônima → request-access → admin aprova → completar signup |
| 7 | Drive isolado entre 2 contas | Lenny | 2 contas reais, validar RLS Phase 4 |
| 5 (visual) | Confirmar PDF v1 abre com Outfit + 4 caixas | Lenny | Abrir `.playwright-mcp/Proposta-JOAQUIM-CASA.pdf` |
| 3,4 (visual) | Confirmar PDF v2 (Playfair/Inter/sem caixas) | Lenny | Abrir `.playwright-mcp/Proposta-smoke-cliente-*.pdf` |
| Cleanup | Apagar 6 entidades smoke- de prod | Lenny | SQL no fim de `06-WRAP-UAT.md` |

## Key files

- Created: `.planning/phases/06-filtros-smoke/06-WRAP-UAT.md`
- Created: `.planning/phases/06-filtros-smoke/06-05-SUMMARY.md` (este)
- PDFs salvos em `.playwright-mcp/Proposta-*.pdf` (não commitar — adicionar ao .gitignore se ainda não estão)

## Commits

- `eb1e73a` test(06-05): scaffold WRAP-UAT smoke checklist (8 items)
- (próximo) docs(06-05): record Playwright smoke results in WRAP-UAT + SUMMARY

## Resume signal expected (D-09 closure)

Após Lenny executar #1, #7 e validar visuais de #3/#4/#5:

- "smoke aprovado" → Marco 1 fechado.
- "smoke aprovado com TODOs: …" → registrar TODOs via `/gsd-add-todo`.
- "regressão em #N: …" → abrir gap-closure plan via `/gsd-plan-phase 06 --gaps`.
