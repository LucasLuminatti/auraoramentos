---
phase: 17-resumo-apresenta-o
plan: 02
subsystem: ui
tags: [react, shadcn, collapsible, step3, presentation, backward-compat]

# Dependency graph
requires:
  - phase: 17-01-resumo-apresenta-o
    provides: GrupoFita.localBreakdown and imagemUrl fields (upstream data layer)
provides:
  - Step3Revisao.tsx with localBreakdown chips ("Ambiente — Local · Xm") in Resumo Global de Fitas
  - Inline fita reference label "incluída no Resumo de Fitas" replacing "Global →"
  - Global drivers block demoted to closed Collapsible "Análise de Otimização de Drivers" (internal-only)
affects:
  - 17-03-resumo-apresenta-o (PDF v2 localBreakdown chips — same data contract)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collapsible from @/components/ui/collapsible used for internal-only analysis blocks (defaultOpen=false)"
    - "localBreakdown chips rendered as Badge variant=outline with backward-compat guard (g.localBreakdown &&)"

key-files:
  created: []
  modified:
    - src/components/Step3Revisao.tsx

key-decisions:
  - "D-01 copy literal: 'incluída no Resumo de Fitas' (not 'Global →') for the inline fita cell"
  - "D-04/D-05: expand Descrição cell (not add column) to keep mobile layout intact"
  - "D-11: rename block to 'Análise de Otimização de Drivers' + badge 'interno' + subtitle 'não aparece no PDF do cliente'"
  - "defaultOpen={false} so drivers block starts collapsed — drivers por ambiente remain the official source"
  - "Backward-compat guard (g.localBreakdown && g.localBreakdown.length > 0) preserves old budgets without the field"

patterns-established:
  - "Collapsible pattern: use defaultOpen={false} + badge 'interno' for internal analysis blocks not sent to client PDF"
  - "localBreakdown guard: always check (field && field.length > 0) before rendering — old snapshots have undefined"

requirements-completed: [RES-01, RES-02, RES-03]

# Metrics
duration: pre-committed (tasks 1+2 committed before closeout)
completed: 2026-06-11
---

# Phase 17 Plan 02: Resumo & Apresentação — Step 3 visual reorganization Summary

**Resumo Global de Fitas ganha chips "Ambiente — Local · Xm" por fita (RES-01), fita inline rotulada "incluída no Resumo de Fitas" sem preço duplicado (RES-02), e bloco de drivers global rebaixado a Collapsible recolhido "Análise de Otimização de Drivers" marcado como interno (RES-03) — tudo em Step3Revisao.tsx, sem tocar cálculos, com guards backward-compat para orçamentos antigos**

## Performance

- **Duration:** pre-committed (tasks 1+2 committed atomically before this closeout)
- **Started:** 2026-06-11
- **Completed:** 2026-06-11
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify — APPROVED)
- **Files modified:** 1 (src/components/Step3Revisao.tsx)

## Accomplishments

- Task 1 (RES-01/02): `localBreakdown` chips renderizados dentro da célula Descrição do Resumo Global de Fitas como `Badge variant="outline"` no formato `{lb.label} · {lb.demanda}m` (ex.: "Sala — Sanca · 12m"), com guard `g.localBreakdown && g.localBreakdown.length > 0` para compatibilidade com orçamentos antigos; inline fita cell alterada de "Global →" para "incluída no Resumo de Fitas"
- Task 2 (RES-03): Import de `Collapsible/CollapsibleTrigger/CollapsibleContent` adicionado; bloco "Resumo Global de Drivers" envolvido em `<Collapsible defaultOpen={false}>`, header reescrito como "Análise de Otimização de Drivers" com badge "interno" e subtitle "Ferramenta de análise — não aparece no PDF do cliente"; conteúdo da tabela de drivers inalterado
- Task 3: Checkpoint human-verify aprovado — chips LOCAL visíveis, rótulo referência correto, colapso de drivers funcionando, console sem erros JS

## Task Commits

1. **Task 1: LOCAL breakdown no Resumo Global de Fitas + rótulo referência na fita inline** - `1d556af` (feat)
2. **Task 2: Rebaixar Resumo Global de Drivers a análise interna colapsável** - `7f66431` (feat)
3. **Task 3: Verificação visual** - checkpoint:human-verify aprovado pelo usuário (sem commit adicional)

## Files Created/Modified

- `src/components/Step3Revisao.tsx` — (1) célula fita inline: "Global →" → "incluída no Resumo de Fitas"; (2) célula Descrição no Resumo de Fitas expandida com chips de localBreakdown; (3) import Collapsible adicionado; (4) bloco de drivers envolvido em Collapsible fechado por padrão com novo header interno

## Decisions Made

- Expandir a célula Descrição em vez de adicionar coluna para os chips de LOCAL — preserva layout mobile sem quebrar as demais colunas (Demanda, Rolos, Preço, Subtotal)
- `g.localBreakdown &&` guard garante que orçamentos sem o campo (pré plan 17-01) continuam renderizando sem crash
- Fita inline recebe apenas relabeling de texto — sem mudança de layout ou preço por ambiente
- Bloco de drivers mantido na tela (insight de otimização tem valor) mas tornado secundário via Collapsible + rótulo "interno"

## Deviations from Plan

None - plan executed exactly as written. Todos os acceptance criteria atendidos: `incluída no Resumo de Fitas` presente, `Global →` removido, `g.localBreakdown` e `lb.label} · {lb.demanda}m` presentes, import Collapsible presente, `Análise de Otimização de Drivers` presente, `defaultOpen={false}` presente, título `Resumo Global de Drivers` removido, `tsc --noEmit` passou.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RES-01/02/03 entregues — dados de `localBreakdown` estão visíveis na tela com guards backward-compat
- 17-03-PLAN.md pode consumir o mesmo contrato `GrupoFita.localBreakdown` e `GrupoFita.imagemUrl` para levar chips LOCAL + foto da fita ao PDF v2
- Nenhum cálculo alterado; otimização de rolos cross-projeto preservada intacta

## Self-Check: PASSED

- `src/components/Step3Revisao.tsx` — arquivo modificado, confirmado via git log
- Commit `1d556af` — `git log --oneline --grep="17-02"` retornou a linha
- Commit `7f66431` — `git log --oneline --grep="17-02"` retornou a linha

---
*Phase: 17-resumo-apresenta-o*
*Completed: 2026-06-11*
