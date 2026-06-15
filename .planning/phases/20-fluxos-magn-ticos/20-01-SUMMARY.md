---
phase: 20-fluxos-magn-ticos
plan: "01"
subsystem: orcamento-types / produto-search
tags: [helpers, pure-functions, tdd, product-first, phase-20]
dependency_graph:
  requires: [19-03]
  provides: [detectarTipoAncora, calcularCargaComposicao, recomendarDriver48V, filtroSistema]
  affects: [src/types/orcamento.ts, src/hooks/useProdutoSearch.ts, src/components/ProdutoAutocomplete.tsx]
tech_stack:
  added: []
  patterns: [pure-functions, tdd-red-green, optional-param-extension]
key_files:
  created: []
  modified:
    - src/types/orcamento.ts
    - src/types/orcamento.test.ts
    - src/hooks/useProdutoSearch.ts
    - src/components/ProdutoAutocomplete.tsx
decisions:
  - "TipoAncora type exported para consumo por ComposicaoCard (Plano 02)"
  - "RecomendacaoDriver48V discriminated union com campo 'estado' (sem_carga | recomendado | excede_200w)"
  - "filtroSistema como 4º param opcional em useProdutoSearch — zero quebra de chamadas existentes"
  - "Guard tests usam imports ES em vez de require() — compatível com Vitest ESM"
metrics:
  duration_minutes: 10
  completed_date: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 20 Plan 01: Helpers Puros + filtroSistema Summary

**One-liner:** Três helpers puros exportados (`detectarTipoAncora`, `calcularCargaComposicao`, `recomendarDriver48V`) + `filtroSistema` opcional em `useProdutoSearch`/`ProdutoAutocomplete` como camada de contratos para os cards de composição magnética.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Helpers puros de detecção, carga e driver 48V | 5e0fe21 | src/types/orcamento.ts, src/types/orcamento.test.ts |
| 2 | filtroSistema em useProdutoSearch para busca escopada | 7834d74 | src/hooks/useProdutoSearch.ts, src/components/ProdutoAutocomplete.tsx |

## What Was Built

### Task 1 — Helpers puros (TDD red→green)

Adicionados logo após `REGRAS_COMPOSICAO` (linha 167 original) em `src/types/orcamento.ts`:

- **`TipoAncora`** — union type `'luminaria' | 'fita' | 'magneto_48v' | 'tiny_magneto' | 'modular'`
- **`detectarTipoAncora(produto)`** — roteamento product-first D-02; prioridade `tipo_produto==='fita'` ANTES do fallback (Pitfall 1: fita tem `sistema_magnetico=null`)
- **`calcularCargaComposicao(composicao)`** — soma `potenciaW × quantidade` só dos `papel==='modulo'`; `undefined` conta como 0; `composicao` undefined retorna 0
- **`RecomendacaoDriver48V`** — discriminated union com `estado: 'sem_carga' | 'recomendado' | 'excede_200w'`
- **`recomendarDriver48V(cargaTotalW)`** — buckets 48V com margem `×1.05` via `MARGEM_SEGURANCA_DRIVER`; `>200W` retorna `excede_200w` (D-08: nunca auto-divide)

Testes: 21 novos + 14 existentes = **35/35 verde**. Guard tests confirmam os 5 calc sites de Fita Padrão com imports ES (sem `require()`).

### Task 2 — filtroSistema

- **`useProdutoSearch`**: 4º parâmetro opcional `filtroSistema?: string`; quando presente adiciona `.eq('sistema', filtroSistema).not('tipo_produto', 'in', '("driver","conector","kit_fixacao","perfil")')` após o bloco de voltagem; adicionado ao array de deps do `useEffect`
- **`ProdutoAutocomplete`**: `filtroSistema?: string` na interface, no destructuring e passado ao hook

Nota crítica implementada: usa coluna `sistema` no banco (não o alias `sistema_magnetico` do SELECT).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guard tests com `require()` não compatíveis com Vitest ESM**
- **Found during:** Task 1, fase RED
- **Issue:** O plano especificava guard tests via `require('@/types/orcamento')` mas o projeto usa ESM — `require` falha com "Cannot find module"
- **Fix:** Adicionados `calcularDemandaFita`, `calcularConsumoW`, `calcularSubtotalSistemaSemFita` ao import ES do topo do arquivo de testes; `require()` removido dos guard tests
- **Files modified:** src/types/orcamento.test.ts
- **Commit:** 5e0fe21

## Verification Results

- `npm run test -- --run orcamento.test`: **35/35 passed**
- `npm run build`: **verde** (warnings de chunk size são pré-existentes)
- 5 calc sites byte-idênticos via grep:
  - `calcularDemandaFita(arg: SistemaIluminacao | ItemPerfil): number` — linha 227 ✓
  - `calcularConsumoW(arg1: SistemaIluminacao | ItemPerfil, arg2?: ItemFitaLED): number` — linha 244 ✓
  - `calcularQtdDrivers(arg1: SistemaIluminacao | ItemPerfil, arg2?: ItemFitaLED, arg3?: ItemDriver): number` — linha 257 ✓
  - `calcularSubtotalSistemaSemFita(sistema: SistemaIluminacao): number` — linha 340 ✓
  - `isSistemaVazio(sis: SistemaIluminacao): boolean` em v2.ts linha 89 ✓ (arquivo NÃO tocado)
- `grep -n "filtroSistema" useProdutoSearch.ts` → 4 matches (assinatura, bloco .eq, .not, deps array)
- `grep -n ".eq('sistema', filtroSistema)"` → 1 match
- `grep -n "filtroSistema" ProdutoAutocomplete.tsx` → 3 matches (interface, destructuring, hook call)
- `grep -c "sistema_magnetico" useProdutoSearch.ts` → 1 (só o alias no SELECT)

## Known Stubs

Nenhum — plano é camada de contratos pura (tipos + funções + hook extension). Sem UI, sem dados mockados.

## Threat Flags

Nenhum — nenhuma nova superfície de rede, auth path, ou schema change introduzida. `filtroSistema` lê tabela `produtos` (catálogo público a autenticados, RLS inalterada). T-20-02 e T-20-03 avaliados como `accept` no threat model do plano.

## Self-Check: PASSED

- src/types/orcamento.ts modificado: FOUND (5e0fe21)
- src/types/orcamento.test.ts modificado: FOUND (5e0fe21)
- src/hooks/useProdutoSearch.ts modificado: FOUND (7834d74)
- src/components/ProdutoAutocomplete.tsx modificado: FOUND (7834d74)
- Commit 5e0fe21: FOUND
- Commit 7834d74: FOUND
