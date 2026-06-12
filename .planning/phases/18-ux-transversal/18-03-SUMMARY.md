---
phase: 18-ux-transversal
plan: "03"
subsystem: ui
tags: [react, typescript, ambiente, duplicar, ux, wizard, step2]

# Dependency graph
requires:
  - phase: 18-01
    provides: clonarAmbiente + luminariaPrecisaLampada + ambienteTemLampada exportados de orcamento.ts
  - phase: 18-02
    provides: AmbienteCard com Tabs controlado + Copy importado de lucide-react
provides:
  - UX-04: botão Duplicar ambiente no header do AmbienteCard — clona árvore inteira com novos UUIDs e nome "(cópia)"
  - duplicarAmbiente handler em Step2Ambientes consumindo clonarAmbiente via splice(i+1)
  - predicados luminariaPrecisaLampada/ambienteTemLampada removidos do inline do Step2 e importados de orcamento.ts
affects: [18-04, future-ux-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Duplicar-via-splice: clonarAmbiente(ambientes[i]) + arr.splice(i+1, 0, clone) + onChange(arr) — insere clone logo abaixo do original sem rearranjar"
    - "onDuplicate?: () => void prop opcional com guard {onDuplicate && (...)} no JSX — botão só renderiza quando handler está disponível"
    - "e.stopPropagation() em botão icon-only dentro de collapsible header — previne toggle do accordion"
    - "Predicados compartilhados: remover definição inline e importar de types/orcamento.ts — fonte única de verdade"

key-files:
  created: []
  modified:
    - src/components/Step2Ambientes.tsx
    - src/components/AmbienteCard.tsx

key-decisions:
  - "Predicados luminariaPrecisaLampada/ambienteTemLampada removidos do Step2Ambientes.tsx (inline) e importados de orcamento.ts — unifica fonte da lógica de detecção de itens incompletos"
  - "duplicarAmbiente usa splice(index+1, 0, clone) para inserir clone imediatamente após o original — UX intuitiva sem rearranjar os outros ambientes"
  - "Botão Duplicar ambiente é opcional (onDuplicate?: () => void) — AmbienteCard permanece utilizável em contextos futuros sem o handler"

patterns-established:
  - "Prop-guard pattern: {onDuplicate && (<Button onClick={() => onDuplicate()} />)} — botão condicional sem branching no componente pai"
  - "stopPropagation em header colapsável: qualquer ação dentro do header de um Collapsible deve chamar e.stopPropagation() para não abrir/fechar o painel"

requirements-completed: [UX-04]

# Metrics
duration: 25min
completed: 2026-06-12
---

# Phase 18 Plan 03: UX-04 Duplicar Ambiente Summary

**Botão Duplicar ambiente clona árvore inteira com novos UUIDs via clonarAmbiente + advisory da Phase 17 unificado usando predicados compartilhados de orcamento.ts**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-12T14:00:00Z
- **Completed:** 2026-06-12T14:25:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint aprovado)
- **Files modified:** 2

## Accomplishments

- Predicados `luminariaPrecisaLampada` e `ambienteTemLampada` removidos do Step2Ambientes e importados de `@/types/orcamento` — unifica fonte da lógica de detecção com o checklist do Step 3
- Handler `duplicarAmbiente` adicionado ao Step2Ambientes — usa `clonarAmbiente` de orcamento.ts + `splice(index+1, 0, clone)` para inserir clone imediatamente abaixo do original
- Botão Duplicar ambiente no header do AmbienteCard (prop `onDuplicate`, ícone `Copy`, `sr-only`, `e.stopPropagation()`) — verifica UX-04 completo
- Advisory da Phase 17 ("Alguns itens parecem incompletos") preservado intacto sem regressão

## Task Commits

1. **Task 1: Refatorar advisory do Step2 para usar predicados compartilhados** - `262dfc5` (refactor)
2. **Task 2: duplicarAmbiente + botão Duplicar ambiente no AmbienteCard** - `f9411d9` (feat)
3. **Task 3: Verificação humana — checkpoint aprovado** - (sem commit adicional, aprovação sem issues)

## Files Created/Modified

- `src/components/Step2Ambientes.tsx` — removidas definições inline de predicados; importados `luminariaPrecisaLampada`, `ambienteTemLampada`, `clonarAmbiente` de `@/types/orcamento`; adicionado handler `duplicarAmbiente`; prop `onDuplicate` passada ao `AmbienteCard` na render loop
- `src/components/AmbienteCard.tsx` — adicionada prop `onDuplicate?: () => void`; botão Duplicar ambiente no header com `Copy` (já importado por 18-02), `sr-only`, `e.stopPropagation()`

## Decisions Made

- Predicados removidos do inline e importados de orcamento.ts — evita divergência entre a lógica do advisory (Step 2) e o checklist pré-PDF (Step 3/18-04)
- splice(index+1) preferido a push — mantém ordem visual intuitiva (clone imediatamente abaixo do original)
- Prop `onDuplicate` opcional — AmbienteCard não depende do handler, pode ser usado em contextos futuros sem duplicação

## Deviations from Plan

None — plano executado exatamente como escrito. AmbienteCard já tinha `Copy` importado por 18-02 conforme previsto na `<dependency_note>`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UX-04 entregue e aprovado no checkpoint humano
- `clonarAmbiente` reutilizado corretamente de 18-01; nenhum UUID compartilhado entre original e clone (T-18-04 mitigado)
- Phase 18 completa (18-01 → 18-02 → 18-03 → 18-04 todos entregues)
- Milestone v1.2 pronta para fechamento

## Self-Check: PASSED

- Commits 262dfc5 e f9411d9 verificados via `git log --oneline -10`
- Arquivos `src/components/Step2Ambientes.tsx` e `src/components/AmbienteCard.tsx` modificados nos commits correspondentes

---
*Phase: 18-ux-transversal*
*Completed: 2026-06-12*
