---
phase: 18-ux-transversal
plan: "01"
subsystem: domain-logic
tags: [clonagem, checklist, uuid, pure-functions, tdd, ux-04, ux-05, res-04]
dependency_graph:
  requires: []
  provides:
    - clonarSistema
    - clonarSistemaParaAmbiente
    - clonarAmbiente
    - detectarChecklistIssues
    - ChecklistIssue
    - luminariaPrecisaLampada
    - ambienteTemLampada
  affects:
    - src/types/orcamento.ts
tech_stack:
  added: []
  patterns:
    - TDD (RED → GREEN) para funções puras exportadas
    - crypto.randomUUID() para regeneração de UUIDs (padrão existente do projeto)
    - Ordenação erro-antes-de-aviso no array de retorno do detector
key_files:
  created:
    - src/types/__tests__/clonagem.test.ts
    - src/types/__tests__/checklistDetectors.test.ts
  modified:
    - src/types/orcamento.ts
decisions:
  - "Predicados luminariaPrecisaLampada/ambienteTemLampada DUPLICADOS em orcamento.ts sem remover de Step2Ambientes.tsx — swap de import fica para plan 18-03 para não quebrar build da Wave 1"
  - "local vazio/null em clonarSistema resulta em '(cópia)' puro (sem prefixo vazio) — consistência visual"
  - "detectarChecklistIssues retorna slice ordenado [erros, avisos] via dois arrays intermediários — sem sort pós-fato para preservar ordem de coleta dentro de cada nível"
metrics:
  duration_minutes: 15
  completed_date: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
  commits: 2
---

# Phase 18 Plan 01: Camada de Domínio — Clonagem e Checklist Summary

**One-liner:** Funções puras de clonagem com UUID-novo (clonarSistema/clonarSistemaParaAmbiente/clonarAmbiente) e detector unificado de itens suspeitos (detectarChecklistIssues) exportados de orcamento.ts com 32 testes Vitest.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Adicionar helpers de clonagem (UUID-novo) em orcamento.ts | 8560f4c | src/types/orcamento.ts, src/types/__tests__/clonagem.test.ts |
| 2 | Extrair detectores para detectarChecklistIssues em orcamento.ts | 8ecca3a | src/types/orcamento.ts, src/types/__tests__/checklistDetectors.test.ts |

## What Was Built

**Task 1 — Helpers de clonagem (RES-04 / UX-04):**

Três funções exportadas adicionadas ao final de `src/types/orcamento.ts`:

- `clonarSistema(sis)` — duplica sistema no mesmo ambiente: gera novos UUIDs em sistema/fita/driver/perfil, sufixa `local` com " (cópia)" (local vazio/null vira "(cópia)")
- `clonarSistemaParaAmbiente(sis)` — duplica sistema para ambiente clonado: mesmos UUIDs novos, mas `local` preservado sem sufixo
- `clonarAmbiente(amb)` — duplica árvore inteira: novo id, sufixo " (cópia)" no nome, cada luminária com novo id, cada sistema via `clonarSistemaParaAmbiente`

Nenhum UUID do original é reusado em nenhum nível. Usa `crypto.randomUUID()` (padrão existente do projeto, AmbienteCard.tsx:47). 10 chamadas UUID no bloco de clonagem.

**Task 2 — Detector unificado (UX-05):**

Adicionados ao final de `src/types/orcamento.ts`:

- `luminariaPrecisaLampada(descricao)` — detecta peça com base de lâmpada sem LED integrado (GU10/E27/MR11/etc.)
- `ambienteTemLampada(amb)` — verifica se ambiente já tem lâmpada pelo texto da descrição
- `ChecklistIssue` — interface `{ id, level: 'error'|'warning', ambienteNome, mensagem }`
- `detectarChecklistIssues(ambientes[])` — 6 detectores puros, sem async, erros antes de avisos:
  1. Fita 0m sem perfil → `level: 'error'`
  2. Fita com driver vazio → `level: 'warning'`
  3. Driver com fita vazia → `level: 'warning'`
  4. Perfil com fita vazia → `level: 'warning'`
  5. Voltagem divergente fita × driver → `level: 'warning'`
  6. Peça que precisa lâmpada num ambiente sem lâmpada → `level: 'warning'`

Os predicados foram duplicados (não movidos) de Step2Ambientes.tsx — o swap de import fica para plan 18-03 para não quebrar build da Wave 1.

## Verification

- `npm run test -- clonagem checklistDetectors` → 32/32 testes passando
- `npx tsc --noEmit` → sem erros de compilação
- Nenhuma assinatura/tipo existente alterado (apenas adições ao final do arquivo)

## Deviations from Plan

Nenhum — plano executado exatamente como escrito.

## Known Stubs

Nenhum. As funções são completas e testadas; os consumidores (AmbienteCard, Step2Ambientes, Step3Revisao) importarão nos plans 18-02/18-03 da Wave 2.

## Threat Flags

Nenhum. Funções puramente em memória — sem I/O, sem rede, sem persistência. T-18-01 (UUID reuse) mitigado: todos os UUIDs regenerados via `crypto.randomUUID()` em todos os níveis, coberto por teste de unicidade de id em `clonagem.test.ts`.

## Self-Check: PASSED

- src/types/orcamento.ts: FOUND (modificado com 7 novas exports)
- src/types/__tests__/clonagem.test.ts: FOUND (20 testes)
- src/types/__tests__/checklistDetectors.test.ts: FOUND (12 testes)
- Commits 8560f4c e 8ecca3a: FOUND
