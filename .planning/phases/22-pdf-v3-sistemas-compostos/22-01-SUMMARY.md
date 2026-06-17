---
phase: 22-pdf-v3-sistemas-compostos
plan: "01"
subsystem: pdf
tags: [pdf, template, compostos, v3]
dependency_graph:
  requires:
    - 19-fundação-compostos (ItemLuminaria.composicao?, ItemComposicao interface)
    - 20-fluxos-magnéticos (sistema field: magneto_48v/tiny_magneto)
    - 21-system-mold (s_mode, fita_modular, calcularMetragemModulosDifusos)
  provides:
    - gerarOrcamentoHtmlV3 (src/lib/pdfTemplates/v3.ts)
    - router branch v >= 3 (src/lib/gerarPdfHtml.ts)
    - buildAtributosMap estendido para composicao[] (src/lib/gerarPdfHtml.ts)
  affects:
    - Step3Revisao.tsx (call site de gerarOrcamentoHtml — precisa passar templateVersion: 3, Plan 02)
    - OrcamentoDetalhe.tsx (reader de pdf_template_version, Plan 02)
tech_stack:
  added: []
  patterns:
    - "Router aditivo de PDF por templateVersion (v1/v2/v3 coexistem)"
    - "Helpers copiados localmente em v3.ts (zero-toque em v2.ts)"
    - "blocoComposto: âncora no topo + sub-linhas ordenadas por papel + subtotal"
    - "chipsPorPapel: chip técnico diferenciado por papel do componente"
key_files:
  created:
    - src/lib/pdfTemplates/v3.ts
    - src/lib/pdfTemplates/__tests__/v3.test.ts
  modified:
    - src/lib/gerarPdfHtml.ts
decisions:
  - "Helpers copiados localmente em v3.ts (zero-toque absoluto em v2.ts) — alternativa à abordagem preferida de re-export; escolhida por segurança máxima de compatibilidade"
  - "blocoAmbienteV3 acumula luminárias simples em buffer e faz flush como tabela antes de cada bloco composto — preserva agrupamento visual"
  - "chipsPorPapel() parametrizado por papel sem atributos externos obrigatórios — fallback gracioso quando atributosMap está vazio"
metrics:
  duration_seconds: 346
  completed_date: "2026-06-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
  tests_added: 20
  tests_total_after: 216
---

# Phase 22 Plan 01: PDF Template v3 com Sistemas Compostos

**One-liner:** Template v3 com `blocoComposto` inline (trilho → módulos → fita modular → driver → acessórios) + router aditivo `v >= 3` + `buildAtributosMap` estendido para `composicao[]`, sem tocar em v1.ts nem v2.ts.

## Objective

Criar o template PDF v3 como camada aditiva que renderiza sistemas compostos (MAGNETO 48V / TINY 24V / SYSTEM MOLD) como bloco estruturado inline dentro do ambiente — cumprindo PDF-03 sem regredir o PDF estável v1/v2.

## Tasks Executed

### Task 1: Criar src/lib/pdfTemplates/v3.ts

**Commit:** `1924012`
**Files:** `src/lib/pdfTemplates/v3.ts` (689 linhas)

Criado `gerarOrcamentoHtmlV3` que reutiliza `PdfParamsV2` e `AtributosMap` de `./v2` via import de tipo. Implementação principal:

- **`blocoComposto(item, indexComposto, atributosMap)`** — renderiza:
  - Header `Sistema Composto N — {LABEL}` com mapa de rótulos (`magneto_48v → MAGNETO 48V`, `tiny_magneto → TINY 24V`, `s_mode → SYSTEM MOLD`)
  - Resumo técnico: `calcularCargaComposicao` → `"12W total"` + `calcularMetragemModulosDifusos` → `"fita 0,8m"` (omite parte quando 0)
  - Linha do trilho âncora no topo com SKU `RV{codigo}`, qtd, preço unitário, subtotal
  - Sub-linhas dos componentes ordenados por papel (módulos → fita modular → driver → acessórios) via `ordenarComponentes()`
  - Chip técnico por papel via `chipsPorPapel()`: potência/comprimento p/ módulo; W/m+voltagem+comprimento p/ fita; potência+voltagem p/ driver; só descrição p/ acessórios
  - Subtotal do sistema: `calcularSubtotalLuminaria + calcularSubtotalComposicao`
- **`blocoAmbienteV3`** — itera `amb.luminarias` com detecção de composto: `composicao?.length` → `blocoComposto`; senão buffer de `rowLuminaria` para tabela agrupada
- **`blocoResumoFitas`** — cópia idêntica do v2 (D-04: só `sistemas[].fita`)
- **CSS v3** = CSS do v2 copiado integralmente + 6 classes novas: `.composto-block`, `.composto-label`, `.composto-resumo`, `.composto-subtotal`, `.comp-sub-row`, `.comp-tag.comp-trilho`
- **Segurança T-22-01**: 30 chamadas a `esc()` — toda string de catálogo escapada

**Estratégia de reuso escolhida:** Cópia local dos helpers (`esc`, `chip`, `thumb`, `agruparPorLocal`) em `v3.ts` — alternativa de "zero-toque absoluto" em `v2.ts`. Garante que `v2.ts` nunca é modificado, eliminando qualquer risco de regressão.

### Task 2: Router v3 + buildAtributosMap + testes + guard v2

**Commit:** `d565735`
**Files:** `src/lib/gerarPdfHtml.ts`, `src/lib/pdfTemplates/__tests__/v3.test.ts`

**(A) Router:**
```typescript
if (v >= 3) {
  const atributosMap = await buildAtributosMap(params.ambientes);
  return gerarOrcamentoHtmlV3({ ...params, atributosMap });
}
// branches v2/v1 inalterados; default ?? 2 inalterado
```

**(B) buildAtributosMap estendido:**
```typescript
for (const c of l.composicao ?? []) if (c.codigo) codigos.add(c.codigo);
```
Guard `?? []` garante backward-compat com snapshots sem `composicao`.

**(C) Testes — 20 testes verdes:**
| Grupo | Testes |
|-------|--------|
| bloco composto (SYSTEM MOLD) | rótulo, SKU âncora, SKUs componentes, subtotal |
| rótulos de tipo (D-01) | magneto_48v, tiny_magneto, s_mode, null fallback |
| resumo de sistema (D-03) | carga W, metragem fita, omissão quando 0 |
| escape HTML (T-22-01) | script em âncora, script em componente, meta-chars |
| guard D-04 | v2 sem RESUMO DE FITAS para fita_modular, v2 com RESUMO para fita padrão, v3 idem |
| distinção v2 vs v3 | export, composto-block, numeração 1-based |

**(D) Guard D-04 confirmado:**
```
grep "composicao" src/lib/pdfTemplates/v2.ts → (vazio)
```
`v2.ts` não varre `composicao[]` — `blocoResumoFitas` continua iterando apenas `sistemas[].fita`.

## Deviations from Plan

### Auto-fixed Issues

Nenhum bug encontrado durante execução.

### Escolha de estratégia de reuso

**Desvio de intenção (não-bloqueante):** O plano listava a abordagem preferida como "adicionar `export` aos helpers já existentes em v2.ts". Optei pela **alternativa**: cópia local dos helpers em v3.ts.

**Razão:** A alternativa garante zero-toque absoluto em v2.ts (nem mesmo mudança de visibilidade de símbolo), eliminando qualquer risco de interferência de bundler/HMR/cache. O guard test (Teste 5) prova que `gerarOrcamentoHtmlV2` continua correto sem alterações.

**Impact:** Nenhum — os testes do guard confirmam comportamento v2 inalterado.

## Known Stubs

Nenhum. O template v3 renderiza HTML funcional com dados reais. A ligação condicional `templateVersion: 3` no writer (Step3Revisao.tsx) é responsabilidade do Plan 02 — o router está pronto para receber.

## Threat Flags

Nenhuma superfície nova introduzida além da descrita no threat model do plano:
- T-22-01 (XSS/Tampering): mitigado — 30 chamadas `esc()` + Teste 4 prova escape de `<script>`
- T-22-02 (Information Disclosure): aceito — mesma query/colunas de product_variants
- T-22-03 (DoS): aceito — client-side, sem amplificação

## Self-Check

### Arquivos criados/modificados existem

- [x] `src/lib/pdfTemplates/v3.ts` — FOUND
- [x] `src/lib/pdfTemplates/__tests__/v3.test.ts` — FOUND
- [x] `src/lib/gerarPdfHtml.ts` — FOUND (modificado)

### Commits existem

- [x] `1924012` — FOUND (Task 1: v3.ts)
- [x] `d565735` — FOUND (Task 2: router + tests)

### Testes

- 20/20 testes v3 verdes
- Build verde (exit 0)
- Guard D-04: `grep "composicao" src/lib/pdfTemplates/v2.ts` → vazio

## Self-Check: PASSED
