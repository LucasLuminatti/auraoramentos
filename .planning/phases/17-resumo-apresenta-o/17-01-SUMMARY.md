---
phase: 17-resumo-apresenta-o
plan: "01"
subsystem: domain-types
tags: [pdf, presentation, calculation, refactor, tdd]
requirements: [RES-01]

dependency_graph:
  requires: []
  provides: [GrupoFita.localBreakdown, GrupoFita.imagemUrl, LocalBreakdown]
  affects: [Step3Revisao, blocoResumoFitas, calcularRolosPorGrupo]

tech_stack:
  added: []
  patterns: [TDD red-green, aditivo opcional, Map acumulador]

key_files:
  created: []
  modified:
    - src/types/orcamento.ts
    - src/types/orcamento.test.ts

decisions:
  - "LocalBreakdown exportado como interface standalone (não inline em GrupoFita) para facilitar consumo tipado em Step3Revisao e PDF"
  - "localAcc usa Map<string, number> preservando ordem de inserção — garante ordem estável no breakdown sem sort extra"
  - "imagemUrl copiado da fita no ramo else (criação do grupo) — primeira fita do código define a imagem; comportamento aceitável pois todas as fitas de mesmo código têm a mesma imagem"
  - "Correção no Teste 4: algoritmo usa rolos 15/10/5 em cascata (não rolos do tamanho metragemRolo da fita) — 20m = 1x15 + 1x5 = 2 rolos, não 4"

metrics:
  duration_minutes: 15
  completed_date: "2026-06-11"
  tasks_completed: 2
  files_modified: 2
---

# Phase 17 Plan 01: Estender GrupoFita com localBreakdown e imagemUrl — Summary

**One-liner:** Extensão aditiva de `GrupoFita` com `localBreakdown?` (breakdown "Ambiente — Local" por label) e `imagemUrl?` via `calcularRolosPorGrupo`, propagando RES-01/D-08 para tela e PDF sem duplicar lógica.

## What Was Built

`LocalBreakdown` interface + dois campos opcionais em `GrupoFita` + acumulador `localAcc: Map<string, number>` em `calcularRolosPorGrupo` que agrega demanda por label `"Ambiente — Local"`. Mudança aditiva zero-risco: campos opcionais, tipo computado em runtime (nunca serializado), algoritmo de rolos 15/10/5 intocado.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED  | Testes TDD para localBreakdown e imagemUrl | `148469d` | src/types/orcamento.test.ts |
| 1+2  | GrupoFita estendido + calcularRolosPorGrupo populando ambos | `67edd29` | src/types/orcamento.ts, src/types/orcamento.test.ts |

## Verification Results

- `npm run test -- src/types/orcamento.test.ts`: 11/11 passando (6 novos + 5 existentes)
- `npm run build`: build com sucesso (0 erros novos — erros pré-existentes em types.ts gerado pelo Supabase)
- Grep confirmou: `LocalBreakdown` (L368), `localBreakdown?` (L386), `imagemUrl?` em GrupoFita (L388), `localAcc` (L399, L413, L422), label `${amb.nome} — ${sis.local.trim()}` (L408), `imagemUrl: sis.fita.imagemUrl` (L421)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Correção de expectativa incorreta no Teste 4**
- **Found during:** Task 2 (fase GREEN)
- **Issue:** Teste 4 esperava `qtdRolosTotal = 4` (assumindo 4 rolos de 5m para 20m), mas o algoritmo usa rolos em cascata 15/10/5 — 20m resulta em 1×15 + 1×5 = 2 rolos
- **Fix:** Corrigida a asserção para `toBe(2)` e adicionado assert de `demandaTotal === 20` para manter cobertura de backward-compat
- **Files modified:** src/types/orcamento.test.ts
- **Commit:** `67edd29`

## Known Stubs

Nenhum. `localBreakdown` e `imagemUrl` são populados com dados reais em runtime. Plans 02 e 03 consumirão esses campos na tela e no PDF respectivamente.

## Threat Flags

Nenhum. Mudança puramente client-side em função pura de cálculo. Nenhuma nova superfície de rede, auth path, ou schema change.
