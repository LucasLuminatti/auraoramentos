---
phase: 16-c-lculo-metragem
plan: "02"
subsystem: wizard-step2 + orcamento-types + ambiente-card
tags: [calc, metragem, passadas, gate, sufixo, backwards-compat]
dependency_graph:
  requires: ["16-01"]
  provides: [CALC-01, CALC-02, CALC-03]
  affects: [src/types/orcamento.ts, src/components/Step2Ambientes.tsx, src/components/AmbienteCard.tsx]
tech_stack:
  added: []
  patterns: [guard-in-handleNext, idempotent-string-helper, optional-field-backwards-compat]
key_files:
  created: []
  modified:
    - src/types/orcamento.ts
    - src/components/Step2Ambientes.tsx
    - src/components/AmbienteCard.tsx
decisions:
  - "passadasPadrao opcional no ItemPerfil (não passadasMax) — espelha valor do banco na criação, fallback ?? 3 para rascunhos antigos"
  - "Gate de metragem verifica inválidos ANTES de remover vazios — prioridade de bloqueio"
  - "sufixo gerenciado por helper exportado em orcamento.ts (não inline no componente) — testável e reutilizável"
  - "isSistemaVazio em pdfTemplates/v2.ts não alterado — consistência garantida pela cadeia lógica (D-07)"
metrics:
  duration: "~25min"
  completed_date: "2026-06-11"
  tasks: 3
  files_modified: 3
---

# Phase 16 Plan 02: Patch Atômico CALC-01/02/03 Summary

Gate de metragem obrigatória + sufixo idempotente na descrição do perfil + Select de passadas restrito por família, com campo `passadasPadrao` opcional backwards-compatible no `ItemPerfil`.

## What Was Built

### Task 1 — Tipo `passadasPadrao` + helper `aplicarSufixoMetragem` (commit `49483d4`)

- Adicionado campo opcional `passadasPadrao?: 1 | 2 | 3` ao `interface ItemPerfil` em `src/types/orcamento.ts`. Campo opcional garante backwards-compat com snapshots antigos (sem o campo → UI faz fallback `?? 3`).
- Exportado helper `aplicarSufixoMetragem(descricaoBase, comprimentoPeca, quantidade)` com regex de strip `/ — \d+(,\d+)?m$/` usando travessão em dash (U+2014) para idempotência.
- Revisão atômica dos 5 sites (D-14): `calcularDemandaFita` mantém `|| 0`, `isSistemaVazio` em `pdfTemplates/v2.ts` inalterado, demais sites confirmados sem mudança de lógica.

### Task 2 — Gate CALC-01 no Step2Ambientes (commit `1835f0f`)

- `handleNext` estendido com dois checks sequenciais antes de `onNext()`:
  1. **Bloqueio (CALC-01):** coleta todos os sistemas com `fita.codigo && !perfil && (metragemManual null/0)` → exibe `toast.error` com copy literal D-05 + lista de sistemas inválidos → `return` sem avançar.
  2. **Remoção silenciosa (D-06):** filtra sistemas onde `!fita.codigo && !driver.codigo && !perfil` → chama `onChange(ambientesLimpos)` + `toast.info` com contagem → `onNext()`.
- Ordem importa: bloqueio de metragem verifica ANTES da remoção de vazios.

### Task 3 — Sufixo metragem + Select passadas + badge inline no AmbienteCard (commit `b482e4c`)

- `aplicarSufixoMetragem` importado e chamado em **3 sites**:
  1. Seleção de perfil (`handleSelectProdutoSistema component='perfil'`): `descricao: aplicarSufixoMetragem(produto.descricao, base.comprimentoPeca, base.quantidade)` + seta `passadasPadrao: passadasAuto`.
  2. `onValueChange` do Select de comprimento: regenera `descricao` com novo comprimento.
  3. `onChange` do Input de quantidade: regenera `descricao` com nova quantidade.
- Badge readonly `{passadas}× (auto)` substituído por `<Select>` filtrado por `[1,2,3].filter(n => n <= (passadasPadrao ?? 3))`.
- Badge inline `⚠ Metragem obrigatória` adicionado no header do sistema (mesma posição do badge de divergência de voltagem), condicionado a `fita.codigo && !perfil && metragem null/0`.

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito.

## Known Stubs

Nenhum — todos os campos são funcionais. O sufixo flui automaticamente para o Input de descrição (readOnly), Resumo e PDF sem código extra.

## Threat Flags

Nenhum — nenhuma nova superfície de rede, endpoint ou path de auth introduzida. Os mitigations T-16-05 a T-16-09 foram implementados conforme o threat register do plano.

## Self-Check

### Files exist
- `src/types/orcamento.ts` — modificado ✓
- `src/components/Step2Ambientes.tsx` — modificado ✓
- `src/components/AmbienteCard.tsx` — modificado ✓

### Commits exist
- `49483d4` — Task 1 ✓
- `1835f0f` — Task 2 ✓
- `b482e4c` — Task 3 ✓

## Self-Check: PASSED
