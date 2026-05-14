---
phase: 11-pdf-v2-dashboard
plan: "01"
subsystem: pdf-v2
tags: [pdf-v2, sistema-vazio, prazo-entrega, blocoTermos]
dependency_graph:
  requires: [10-05-SUMMARY]
  provides: [isSistemaVazio, filtro-sistemas-vazios, prazo-20-dias]
  affects: [src/lib/pdfTemplates/v2.ts]
tech_stack:
  added: []
  patterns: [pure-function-filter, helper-local-module]
key_files:
  modified:
    - src/lib/pdfTemplates/v2.ts
decisions:
  - "Critério de sistema vazio é físico (demanda/consumo/driver), não financeiro (subtotal) — alinha com roadmap success #1, diverge conscientemente de CONTEXT D-05"
  - "isSistemaVazio declarada como função local ao módulo (não exportada), consistente com rowLuminaria e demais helpers internos"
  - "Filtro aplicado em blocoLocal antes do .map — blocoSistema permanece função pura, quem decide é o caller"
metrics:
  duration: "~15 min"
  completed: "2026-05-14"
  tasks: 3
  files: 1
---

# Phase 11 Plan 01: PDF v2 — Sistemas Vazios + Prazo 20 Dias Úteis Summary

Helper `isSistemaVazio` local + filtro em `blocoLocal` eliminam blocos "SISTEMA N" zerados do PDF v2; frase de prazo fundida com "com prazo médio de 20 dias úteis" em `blocoTermos`.

## Tasks Executadas

| Task | Nome | Commit | Arquivos |
|------|------|--------|----------|
| 1 | Helper isSistemaVazio + filtro em blocoLocal (PDF-01) | 76094da | src/lib/pdfTemplates/v2.ts |
| 2 | Fundir frase de prazo em blocoTermos (PDF-02) | 52409d6 | src/lib/pdfTemplates/v2.ts |
| 3 | Smoke: lint + build + tests | — (sem commit) | — |

## Mudanças em src/lib/pdfTemplates/v2.ts

### Helper isSistemaVazio (linha ~84)

Adicionado logo antes da seção `/* Builders */`, após `agruparPorLocal`:

```typescript
function isSistemaVazio(sis: SistemaIluminacao): boolean {
  return calcularDemandaFita(sis) === 0
    && calcularConsumoW(sis) === 0
    && calcularQtdDrivers(sis) === 0;
}
```

- Função local ao módulo (não exportada)
- 3 helpers já importados de `orcamento.ts` — zero novos imports
- Perfil ignorado intencionalmente (D-02)

### Filtro em blocoLocal (linha ~237)

```typescript
// antes:
const sistemasHtml = sistemas.map((sis, i) => blocoSistema(sis, i, atributosMap)).join("");

// depois:
const sistemasHtml = sistemas
  .filter(sis => !isSistemaVazio(sis))
  .map((sis, i) => blocoSistema(sis, i, atributosMap))
  .join("");
```

`blocoSistema` permanece com assinatura intacta `(sis, indexNoLocal, atributosMap)` — Phase 10 WIZ-05 não regride.

### Prazo em blocoTermos (linha 324)

```html
<!-- antes: -->
<p>A consultar conforme disponibilidade de estoque. Pedidos confirmados após aprovação da proposta.</p>

<!-- depois: -->
<p>A consultar conforme disponibilidade de estoque, com prazo médio de 20 dias úteis. Pedidos confirmados após aprovação da proposta.</p>
```

Hardcoded no template (D-07). Snapshots antigos re-renderizam com o texto novo sem duplicação porque o boilerplate nunca é armazenado no `ambientes` JSONB.

## Decisão Consciente: Critério Físico vs. Financeiro

O CONTEXT D-05 define sistema vazio via `subtotalFita === 0 && subtotalDriver === 0` (critério financeiro). O plano 11-01 e o roadmap success criterion #1 são explícitos: `0m de fita, 0W de consumo, 0 driver` (critério físico).

**Decisão:** seguir o critério físico. Consequência: sistema com fita preenchida a R$ 0 (cortesia) **não** some do PDF — tem demanda real, é visível no PDF. Se o cliente quiser "cortesia invisível", é phase nova. Documentado no commit 76094da.

## Smoke Automatizado

| Check | Resultado |
|-------|-----------|
| `npm run lint` | 0 erros/warnings em v2.ts (worktree legada em `.claude/worktrees/` tem erros pré-existentes — out-of-scope) |
| `npm run build` | exit 0 (✓ em 1m41s, 3460 módulos) |
| `npm run test -- --run` | 55/55 passando (6 suites) |

## Deviations from Plan

None — plano executado exatamente como escrito. A divergência D-05 vs. roadmap estava documentada no próprio plano como decisão a tomar; seguiu-se o roadmap (critério físico).

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma nova superfície de segurança introduzida. `isSistemaVazio` é pure function client-side sem acesso a dados externos.

## Self-Check: PASSED

- `src/lib/pdfTemplates/v2.ts` modificado com `isSistemaVazio`, filtro em `blocoLocal`, frase fundida em `blocoTermos`
- Commit 76094da: `feat(11): hide empty systems in PDF v2 (PDF-01)` — existe
- Commit 52409d6: `feat(11): merge "prazo médio de 20 dias úteis"` — existe
- 55 testes passando — sem regressão
- Build TypeScript: exit 0
