---
phase: 15-tens-o-valida-o
plan: "01"
subsystem: domain-logic + step3-ui
tags: [validacao, drivers, voltagem, grouping, resumo, tdd]
one_liner: "Agrupamento de drivers por (codigo + voltagem) com rótulo composto LM2130 · 24V e remoção da coluna Tensão redundante"
dependency_graph:
  requires: []
  provides: [calcularDriversPorProjeto-grouping-by-codigo-voltagem, resumo-drivers-rotulo-composto]
  affects: [src/types/orcamento.ts, src/components/Step3Revisao.tsx]
tech_stack:
  added: []
  patterns: [tdd-red-green, composite-map-key, react-key-dedup]
key_files:
  created:
    - src/types/orcamento.test.ts
  modified:
    - src/types/orcamento.ts
    - src/components/Step3Revisao.tsx
decisions:
  - "D-08 implementado: chave composta codigo|voltagem no Map interno de calcularDriversPorProjeto"
  - "D-09a Opção A implementada: rótulo composto no campo Driver, coluna Tensão removida"
metrics:
  duration_min: 10
  completed_date: "2026-06-10"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 15 Plan 01: Grouping Key + Rótulo Composto de Drivers — Summary

**One-liner:** Agrupamento de drivers por (codigo + voltagem) com rótulo composto `LM2130 · 24V` e remoção da coluna Tensão redundante.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD RED) | Testes falhos para grouping por (codigo + voltagem) | c29174b | src/types/orcamento.test.ts |
| 1 (TDD GREEN) | Mudar grouping key para (codigo + voltagem) | 290ce40 | src/types/orcamento.ts |
| 2 | Rótulo composto + remover coluna Tensão | 8f0c406 | src/components/Step3Revisao.tsx |

## What Was Built

**Task 1 — `calcularDriversPorProjeto` grouping fix (`src/types/orcamento.ts`)**

Antes, o Map usava `const cod = sis.driver.codigo` como chave. Dois sistemas com o mesmo código de driver em voltagens diferentes (ex.: LM2130 a 12V e LM2130 a 24V) colapsavam numa única linha, somando consumo de voltagens incompatíveis.

A chave foi alterada para:
```typescript
const chave = `${sis.driver.codigo}|${sis.driver.voltagem}`;
```

No loop de saída, `driverCodigo` é extraído com `chave.split('|')[0]` — a chave composta é interna ao Map e nunca vaza para o campo de saída. A interface `ResumoDriverProjeto` não foi alterada.

**Task 2 — Resumo Global de Drivers em `Step3Revisao.tsx`**

Aplicada decisão D-09a Opção A (aprovada em checkpoint):
1. `key` da `<TableRow>` alterada para `` `${d.driverCodigo}-${d.voltagem}` `` — evita warning de key duplicada quando dois itens têm o mesmo `driverCodigo` mas voltagens distintas.
2. Rótulo composto: `{d.driverCodigo} · {d.voltagem}V` no campo de identificação do driver.
3. Coluna "Tensão" removida (cabeçalho + célula) — redundante após o rótulo composto.

## Verification

- `npx vitest run src/types/orcamento.test.ts` — 5/5 testes passando
- `npm run build` — build sem erros de tipo

## Deviations from Plan

None — plano executado exatamente como escrito. TDD RED→GREEN seguido. Decisions D-08 e D-09a implementadas conforme aprovado.

## Known Stubs

None — dados reais de driver são usados diretamente; nenhum placeholder ou hardcode introduzido.

## Threat Flags

Nenhum — mudança puramente em lógica client-side de cálculo e renderização. Sem novo input não-confiável, sem mudança de auth/RLS/schema/edge function. Conforme threat model do plano: T-15-01 e T-15-02 com disposição `accept`.

## Self-Check: PASSED

- `src/types/orcamento.ts` contém `` `${sis.driver.codigo}|${sis.driver.voltagem}` `` — FOUND
- `src/types/orcamento.ts` contém `chave.split('|')[0]` — FOUND
- `src/components/Step3Revisao.tsx` contém `{d.driverCodigo} · {d.voltagem}V` — FOUND
- `src/components/Step3Revisao.tsx` contém `` key={`${d.driverCodigo}-${d.voltagem}`} `` — FOUND
- `src/components/Step3Revisao.tsx` NÃO contém `<TableHead className="text-right">Tensão</TableHead>` — CONFIRMED
- `src/types/orcamento.test.ts` existe — FOUND
- Commits c29174b, 290ce40, 8f0c406 existem — FOUND
