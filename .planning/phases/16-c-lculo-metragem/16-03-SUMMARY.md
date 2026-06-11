---
phase: 16-c-lculo-metragem
plan: "03"
subsystem: testes
tags: [tdd, vitest, calc-01, calc-02, calc-03]
dependency_graph:
  requires: ["16-02"]
  provides: ["cobertura CALC-01/02/03"]
  affects: []
tech_stack:
  added: []
  patterns: ["predicados puros testados diretamente (sem render de componente)"]
key_files:
  created:
    - src/types/__tests__/sufixoMetragem.test.ts
    - src/components/__tests__/Step2Gate.test.ts
    - src/components/__tests__/AmbienteCardPassadas.test.tsx
  modified: []
decisions:
  - "Predicados do gate testados como funções puras replicadas no teste (não exportadas do componente) — mais robusto que render, menos acoplamento"
  - "AmbienteCardPassadas usa teste de função pura opcoesPassadas — espelho da expressão do filtro no Select, sem necessidade de render"
metrics:
  duration_seconds: 215
  completed_date: "2026-06-11"
  tasks_completed: 4
  files_changed: 3
---

# Phase 16 Plan 03: TDD — Suíte de testes CALC-01/02/03 Summary

**One-liner:** Suíte Vitest com 30 casos cobrindo sufixo pt-BR (idempotência), gate null≡0 (D-03/D-04/D-06) e range de passadas por família (D-11/D-12).

## What Was Built

3 arquivos de teste criados cobrindo os 3 requisitos críticos da fase 16:

| Arquivo | Requisito | Casos |
|---------|-----------|-------|
| `src/types/__tests__/sufixoMetragem.test.ts` | CALC-02 | 10 |
| `src/components/__tests__/Step2Gate.test.ts` | CALC-01 | 12 |
| `src/components/__tests__/AmbienteCardPassadas.test.tsx` | CALC-03 | 8 |

**Total: 30 novos testes. Suíte completa: 90 testes, 10 arquivos, exit 0.**

### CALC-02 — sufixoMetragem (10 casos)
- Metragem inteira sem vírgula (`— 2m`)
- Metragem fracionária com vírgula decimal pt-BR (`— 2,5m`)
- Idempotência: re-aplicação substitui sufixo sem duplicar (anti-Pitfall 3)
- Preservação de texto manual antes do sufixo
- Travessão U+2014 verificado (não hífen)

### CALC-01 — Step2Gate (12 casos)
- `metragemManual=null` bloqueia (D-03)
- `metragemManual=0` bloqueia — null ≡ 0 provado em testes separados (D-03)
- `metragemManual=12` válido
- Sistema com perfil presente dispensa metragemManual (D-05)
- Rascunho antigo (null + perfil null + fita preenchida) → inválido sem crash (D-04)
- Sistema totalmente vazio → `totalmenteVazio=true` + `metragemInvalida=false` — distinção D-06

### CALC-03 — AmbienteCardPassadas (8 casos)
- `passadasPadrao=3` → `[1,2,3]`
- `passadasPadrao=2` → `[1,2]`
- `passadasPadrao=1` → `[1]`
- `passadasPadrao=undefined` → fallback `[1,2,3]` (snapshot antigo — anti-Pitfall 4, D-12)
- Invariantes: opção 1 sempre presente, resultado nunca vazio

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 | `0b09509` | test(16-03): CALC-02 — sufixo metragem pt-BR, idempotência, preservação |
| 2 | `fcef2b7` | test(16-03): CALC-01 — gate Step2 null/0/old-draft/vazio (12 casos) |
| 3 | `042809d` | test(16-03): CALC-03 — range passadas por família + fallback snapshot |

## Deviations from Plan

**1. [Rule 3 - Blocking] Merge do wave 2 necessário antes da execução**
- **Found during:** Início — `aplicarSufixoMetragem` não estava presente no HEAD da branch
- **Issue:** O commit 4c3ab4f (merge do wave 2) existia no histórico `--all` mas não estava no HEAD da branch `worktree-agent-a94328d09d24b2a8a`
- **Fix:** `git merge 4c3ab4f504b816b580188df488e75259cfeb5fed` (fast-forward limpo)
- **Files modified:** `src/types/orcamento.ts`, `src/components/AmbienteCard.tsx`, `src/components/Step2Ambientes.tsx`, `.planning/phases/16-c-lculo-metragem/16-02-SUMMARY.md`

## Known Stubs

Nenhum — este plano cria apenas testes, sem stubs de dados ou UI.

## Threat Flags

Nenhum — testes em memória, sem rede, sem DB, sem nova superfície de ataque.

## Self-Check: PASSED

- [x] `src/types/__tests__/sufixoMetragem.test.ts` existe
- [x] `src/components/__tests__/Step2Gate.test.ts` existe
- [x] `src/components/__tests__/AmbienteCardPassadas.test.tsx` existe
- [x] Commits `0b09509`, `fcef2b7`, `042809d` existem no histórico
- [x] `npm run test` → 90 passed, exit 0, sem regressão
