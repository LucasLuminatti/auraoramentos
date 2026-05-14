---
phase: 10-wizard-edi-o-status-descri-o-rica
plan: "03"
subsystem: wizard-step3
tags: [inline-edit, wiz-01, wiz-02, step3, ux]
dependency_graph:
  requires: [10-01]
  provides: [inline-qty-price-edit-step3]
  affects: [orcamentos.ambientes-jsonb, exception-chat-flow]
tech_stack:
  added: []
  patterns: [local-string-state-flush-on-blur, editable-numeric-cell]
key_files:
  modified:
    - src/components/Step3Revisao.tsx
decisions:
  - "D-01: edição via input inline na tabela (sem dialog)"
  - "D-02: recalc on-blur/Enter — sem recalc por keystroke (D-34 pattern PrecosBatch)"
  - "D-03: fluxo ExceptionChat mantido intacto — violacao detectada via useMemo após flush"
  - "D-04: persistência só no snapshot (orcamentos.ambientes), product_variants intocado"
  - "D-05: qty >= 1 (integer), preço >= 0 (decimal) — clamp no handler"
  - "D-06: Step 3 = negociação; qty de perfil editável só no Step 2"
  - "D-34: estado local string + flush no blur/Enter (pattern PrecosBatch.tsx)"
metrics:
  duration: "~15min"
  completed: "2026-05-14"
  tasks: 3
  files_modified: 1
---

# Phase 10 Plan 03: Inline Qty+Price Editing in Step3Revisao Summary

**One-liner:** Input inline de quantidade e preço unitário no Step 3 via EditableNumericCell (estado local string + flush on-blur/Enter), sem recalc por keystroke e com fluxo ExceptionChat preservado.

## What Was Built

### Task 1: Sub-componente EditableNumericCell
Adicionado em `src/components/Step3Revisao.tsx` antes da declaração do componente principal. Props: `{value, onCommit, mode, min?, className?, ariaLabel?}`. Funciona com:
- Estado local `string` para o valor digitado
- `onChange` atualiza apenas o estado local (zero flush)
- `onBlur` faz parse + clamp + chama `onCommit(next)` apenas se o valor mudou
- `onKeyDown Enter` → `currentTarget.blur()` (dispara o flush)
- `onFocus` → `e.target.select()` (seleciona conteúdo ao focar, UX de planilha)
- `useEffect([value])` → sincroniza input quando `handleAjustarPreco` atualiza o valor externamente

### Task 2: 5 Handlers de Edição
Adicionados dentro do `Step3Revisao`, logo após `handleAjustarPreco`:

| Handler | Tipo | Alvo |
|---------|------|------|
| `handleEditQuantidade` | WIZ-02 | `luminaria.quantidade` (int >= 1) |
| `handleEditPrecoLuminaria` | WIZ-01 | `luminaria.precoUnitario` (float >= 0) |
| `handleEditPrecoFita` | WIZ-01 | `sistema.fita.precoUnitario` |
| `handleEditPrecoPerfil` | WIZ-01 | `sistema.perfil.precoUnitario` |
| `handleEditPrecoDriver` | WIZ-01 | `sistema.driver.precoUnitario` |

Todos usam map imutável sobre `ambientes` e chamam `onUpdateAmbientes(updated)`.

### Task 3: 5 TableCells Substituídas
As células estáticas foram substituídas por `<EditableNumericCell>`:

- **Luminária qty** (l.507): `mode="integer"`, min=1
- **Luminária preço** (l.515): `mode="decimal"`, badge de violação em flex ao lado
- **Fita preço** (l.563): `mode="decimal"`, badge de violação em flex ao lado
- **Perfil preço** (l.583): `mode="decimal"`, badge de violação em flex ao lado
- **Driver preço** (l.603): `mode="decimal"`, badge de violação em flex ao lado

Células inalteradas: subtotais (`formatarMoeda`), detalhe de perfil (`Xm × Y = Zm`), detalhe de fita/driver.

## Decisions Applied

- **D-34:** Pattern PrecosBatch.tsx — estado local string, flush só no blur/Enter. Recalc de `violacoes`/`gruposFita`/`resumoDrivers`/`totalGeral` (todos `useMemo([ambientes])`) disparado 1x por edição completa, não por keystroke.
- **D-03:** Fluxo ExceptionChat não regrediu. `isViolacao` e `violacoes` recomputam automaticamente após cada flush via `onUpdateAmbientes`. O badge `AlertTriangle` continua aparecendo quando preço < mínimo.
- **D-04:** Nenhum handler toca Supabase. `onUpdateAmbientes` sobe para `Index.tsx` → snapshot em memória → `salvarOrcamento` grava em `orcamentos.ambientes` quando user gera PDF.
- **D-06:** Quantidade de perfil (`sis.perfil.quantidade`) não é editável no Step 3 — continua como display `{Xm × Y = Zm}`. Editável apenas no Step 2 (AmbienteCard).

## Build & Test

- `npm run build`: exit 0 (warnings de chunk size são pré-existentes, não desta alteração)
- `npm run test --run`: 47/47 passed

## Deviations from Plan

Nenhuma. Plano executado exatamente como escrito.

## Known Stubs

Nenhum. Todos os inputs estão wire ao domain state via `onUpdateAmbientes`.

## Threat Flags

Nenhum. Mudanças limitadas a Step3Revisao.tsx (UI client-side). Sem novos endpoints, auth paths ou schema changes.

## Self-Check: PASSED

- `src/components/Step3Revisao.tsx` modificado e commitado em `2bfb4cd`
- Build exit 0
- 47 testes passando
