---
phase: 18-ux-transversal
plan: "02"
subsystem: ui
tags: [react, supabase, autocomplete, tabs, ux, accessibility]

# Dependency graph
requires:
  - phase: 18-01
    provides: clonarSistema helper em src/types/orcamento.ts

provides:
  - "useProdutoSearch retorna redirectTipo via fallback query quando fita/perfil/driver digitado em busca de luminária"
  - "ProdutoAutocomplete exibe empty-state azul de redirect com botão Ir para Sistemas de Iluminação"
  - "AmbienteCard com Tabs controlado, 2 microcopies inline, botão Duplicar sistema funcional"

affects:
  - 18-03
  - 18-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fallback query gated: segunda query só dispara após primary retornar 0 resultados e condição de filtro/query satisfeita"
    - "Tabs controlado (value + onValueChange) em vez de defaultValue para permitir troca programática de aba"
    - "sr-only obrigatório em botões icon-only para acessibilidade"
    - "redirectTipo propagado de hook → autocomplete → card via prop callback onRedirectToSistemas"

key-files:
  created: []
  modified:
    - src/hooks/useProdutoSearch.ts
    - src/components/ProdutoAutocomplete.tsx
    - src/components/AmbienteCard.tsx

key-decisions:
  - "Fallback query usa .in('tipo_produto', ['perfil','fita','driver']) e nunca 'luminaria' (não é valor CHECK válido)"
  - "Redirect wiring via prop callback (onRedirectToSistemas) — sem contexto global, sem lifting de estado adicional"
  - "Microcopy posicionado logo após TabsContent antes do conteúdo, em text-xs text-muted-foreground"
  - "Botão Duplicar sistema usa variant=ghost com sr-only para acessibilidade (icon-only)"

patterns-established:
  - "Fallback query gated: só dispara quando primary retorna 0 + filtro específico + query.length >= 2"
  - "Tabs controlado com useState local para permitir setActiveTab programático"

requirements-completed: [UX-01, UX-03, RES-04]

# Metrics
duration: checkpoint-approved
completed: 2026-06-12
---

# Phase 18 Plan 02: UX Transversal — Redirect, Microcopy e Duplicar Sistema Summary

**Busca inteligente em Luminárias: redirect automático para perfil/fita/driver com troca de aba + microcopy inline nas 2 abas + botão Duplicar sistema via clonarSistema**

## Performance

- **Duration:** checkpoint-approved (execução em sessão anterior + verificação humana aprovada)
- **Started:** 2026-06-12
- **Completed:** 2026-06-12
- **Tasks:** 3 auto + 1 checkpoint (aprovado)
- **Files modified:** 3

## Accomplishments

- `useProdutoSearch` agora retorna `redirectTipo` via fallback query gated: quando busca de luminária retorna 0 resultados e a query bate em perfil/fita/driver, o tipo real é detectado e propagado
- `ProdutoAutocomplete` exibe bloco azul "Este produto é um [tipo] — adicione em Sistemas de Iluminação" com botão "Ir para Sistemas de Iluminação" (ArrowRight); empty-state "Nenhum produto encontrado" preservado quando não há redirect
- `AmbienteCard` migrado para Tabs controlado (`value={activeTab}` + `onValueChange`), com wiring do redirect (`onRedirectToSistemas={() => setActiveTab('sistemas')}`), 2 microcopies inline e botão Duplicar sistema com `sr-only` e ícone `Copy` usando `clonarSistema` + `splice(index+1, 0, clone)`

## Task Commits

1. **Task 1: Fallback query em useProdutoSearch retornando redirectTipo** - `7e3040b` (feat)
2. **Task 2: Empty-state de redirect em ProdutoAutocomplete** - `bc47940` (feat)
3. **Task 3: AmbienteCard — Tabs controlado, microcopy, duplicar sistema, wiring redirect** - `ccba3ae` (feat)

## Files Created/Modified

- `src/hooks/useProdutoSearch.ts` — adicionado estado `redirectTipo`, fallback query gated com `.in("tipo_produto", ["perfil","fita","driver"])`, reset em início e catch, retorno expandido
- `src/components/ProdutoAutocomplete.tsx` — prop `onRedirectToSistemas?`, consumo de `redirectTipo`, bloco condicional de redirect azul com Button+ArrowRight, empty-state padrão preservado
- `src/components/AmbienteCard.tsx` — import `clonarSistema`+`Copy`, state `activeTab`, Tabs controlado, `onRedirectToSistemas` wiring, 2 microcopies, handler `duplicarSistema` com splice, botão ghost+sr-only

## Decisions Made

- Fallback query usa `.in("tipo_produto", ["perfil","fita","driver"])` e nunca `'luminaria'` — não é valor CHECK válido na constraint do banco (Pitfall 7 do RESEARCH.md)
- Wiring via prop callback `onRedirectToSistemas` sem lifting de estado adicional ou contexto global — mantém encapsulamento do AmbienteCard
- Microcopy em `text-xs text-muted-foreground` logo após `TabsContent` — explicativo e discreto, sem competir com o conteúdo
- Botão Duplicar usa `variant="ghost"` + `<span className="sr-only">` — pattern obrigatório para icon-only per UI-SPEC

## Deviations from Plan

Nenhuma — plano executado exatamente como especificado.

## Issues Encountered

Nenhum.

## User Setup Required

Nenhum — sem configuração externa necessária.

## Next Phase Readiness

- Phase 18-03 pode prosseguir: AmbienteCard estável com Tabs controlado, clonarSistema disponível, padrão de microcopy estabelecido
- UX-01 e UX-03 entregues; RES-04 entregue — sem blockers para 18-03 (UX-04) ou 18-04 (UX-05)

---
*Phase: 18-ux-transversal*
*Completed: 2026-06-12*
