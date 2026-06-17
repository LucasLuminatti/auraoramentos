---
phase: 22-pdf-v3-sistemas-compostos
plan: "02"
subsystem: pdf
tags: [pdf, router, wiring, template-version, compostos]

requires:
  - phase: 22-pdf-v3-sistemas-compostos/22-01
    provides: "gerarOrcamentoHtmlV3, router v >= 3, buildAtributosMap estendido para composicao[]"
  - phase: 21-system-mold
    provides: "ItemLuminaria.composicao?, ItemComposicao, fita_modular, s_mode"

provides:
  - "resolverTemplateVersion(ambientes) helper puro centralizado em src/lib/pdfTemplateVersion.ts"
  - "Writer condicional: Step3Revisao persiste pdf_template_version 3 quando há composto, 2 caso contrário"
  - "Reader OrcamentoDetalhe confirmado com pdf_template_version no select (sem mudança necessária)"
  - "5 testes unitários do helper verde (composto→3, sem-composto→2, array-vazio→2, undefined→2, mistura→3)"
  - "Fix WR-01: thumbnails de composicao[] agora incluídos em inlineImagensSnapshot via pdfImages.ts"

affects:
  - PDF-03 (fechado fim-a-fim)

tech-stack:
  added: []
  patterns:
    - "Helper puro resolverTemplateVersion como fonte única da condição de composto (ambientes.some(a => a.luminarias.some(l => l.composicao?.length)))"
    - "Writer computa templateVersion uma vez no topo de persistirOrcamento/handlePDF e passa para persiste + geração"
    - "Reader usa ?? 1 como fallback — NULL snapshots antigos continuam no v1"

key-files:
  created:
    - src/lib/pdfTemplateVersion.ts
    - src/lib/__tests__/pdfTemplateVersion.test.ts
  modified:
    - src/components/Step3Revisao.tsx
    - src/lib/pdfImages.ts

key-decisions:
  - "Condição de composto centralizada em pdfTemplateVersion.ts (helper puro) — writer e testes importam a mesma função; não existe literal duplicado"
  - "Query do reader (OrcamentoDetalhe) já incluía pdf_template_version no select (linha 107 — select(*)); nenhuma mudança de query necessária"
  - "WR-01 corrigido em commit separado (18e303d): pdfImages.ts percorre l.composicao[] para inlinar thumbnails; WR-02 benigno (fix preserva length → resolverTemplateVersion idêntico)"

patterns-established:
  - "resolverTemplateVersion como contrato canônico: qualquer novo writer de PDF importa esse helper em vez de duplicar a condição"

requirements-completed: [PDF-03]

duration: "checkpoint aprovado (visual via Playwright em prod gerarOrcamentoHtml)"
completed: "2026-06-17"
---

# Phase 22 Plan 02: Wiring Condicional PDF v3 — Writer + Reader + Helper

**Helper `resolverTemplateVersion` centraliza condição de composto; Step3Revisao persiste `pdf_template_version` 3 ou 2 condicionalmente; OrcamentoDetalhe confirmado sem mudança; checkpoint visual aprovado com v3/v2/antigo corretos e console limpo.**

## Performance

- **Duration:** (assíncrono — checkpoint humano aprovado via Playwright)
- **Started:** 2026-06-17
- **Completed:** 2026-06-17
- **Tasks:** 3 (Task 1 + Task 2 executadas + Task 3 checkpoint aprovado)
- **Files modified:** 4

## Accomplishments

- `src/lib/pdfTemplateVersion.ts` criado com `temSistemaComposto` e `resolverTemplateVersion` — fonte única da condição `ambientes.some(a => a.luminarias.some(l => l.composicao?.length))`
- `Step3Revisao.tsx` cabeado: ambos os literais `pdf_template_version: 2` substituídos por `resolverTemplateVersion(ambientes)` tanto no UPDATE/INSERT quanto na chamada `gerarOrcamentoHtml`
- `OrcamentoDetalhe.tsx` confirmado sem mudança: coluna `pdf_template_version` já presente no select (select(`*`), linha 107); lógica `templateVersion: orc.pdf_template_version ?? 1` já correta e aditiva para v3
- 5 testes unitários verdes: composto→3, sem composto→2, `composicao: []`→2, `composicao: undefined`→2, mistura→3
- Fix WR-01 (commit 18e303d): `pdfImages.ts` agora percorre `l.composicao ?? []` para incluir thumbnails dos componentes de composicao no snapshot inline

## Task Commits

1. **Task 1: Helper + writer + reader** — `b7c35a5` (feat)
2. **Task 2: Testes do helper (5 casos)** — `800bbbd` (test)
3. **Fix WR-01: thumbnails composicao[] em inlineImagensSnapshot** — `18e303d` (fix)
4. **Task 3: Checkpoint visual aprovado** — (sem commit de código — verificação visual)

## Files Created/Modified

- `src/lib/pdfTemplateVersion.ts` — Helper puro `temSistemaComposto` + `resolverTemplateVersion`; exporta 2 | 3; expressão travada do CONTEXT.md
- `src/lib/__tests__/pdfTemplateVersion.test.ts` — 5 testes Vitest cobrindo todos os casos do `<behavior>`
- `src/components/Step3Revisao.tsx` — Writer condicional: literais `pdf_template_version: 2` substituídos; `resolverTemplateVersion` importado e chamado no persist + handlePDF
- `src/lib/pdfImages.ts` — Fix WR-01: loop `for (const l of amb.luminarias)` agora itera `l.composicao ?? []` adicionalmente para coletar códigos de imagem dos componentes

## Resultado do Checkpoint Visual (Task 3 — APROVADO)

Verificação via Playwright contra `gerarOrcamentoHtml` real no dev server :8080 (2026-06-17):

**v3 — orçamento com composto (SYSTEM MOLD):**
- Renderizou bloco `SISTEMA COMPOSTO 1 — SYSTEM MOLD` com resumo `16W total · fita 0,8m`
- Trilho no topo com SKU `RVSM-TRILHO-2M`
- Sub-linhas ordenadas: módulo → fita modular → driver → conector, com chip técnico por papel e preço por linha
- `Subtotal do sistema: R$ 1.045,00`
- TOTAL GERAL `R$ 1.285,00` — math conferida

**v2 — orçamento sem composto (mesmo dado sem composicao[]):**
- Bloco composto NÃO renderizado — PDF v2 inalterado (aditivo confirmado)

**Snapshot antigo (templateVersion 1 — NULL no banco):**
- Renderizou sem erro e inalterado

**Rótulos confirmados:** `magneto_48v` → MAGNETO 48V, `tiny_magneto` → TINY 24V, `s_mode` → SYSTEM MOLD

**Segurança:** Nenhum `<script>` cru; `&` escapado; console: 0 erros em toda a sessão

## Decisions Made

- **Condição de composto centralizada em helper puro:** `resolverTemplateVersion` em `pdfTemplateVersion.ts` é a única implementação da condição — writer importa em vez de duplicar. Decisão garante que uma futura mudança na condição afeta todos os call sites automaticamente.
- **Query do reader sem mudança:** A query `select('*')` em `OrcamentoDetalhe.tsx` (linha 107) já inclui `pdf_template_version`; a lógica `?? 1` já existia e é aditiva para v3 pelo router do Plan 01. Confirmado via leitura do arquivo — nenhuma edição necessária.
- **WR-01 corrigido em commit separado:** `pdfImages.ts` não percorria `composicao[]` ao montar o snapshot de imagens inline. Fix em commit dedicado `18e303d` antes do checkpoint visual (WR-02 benigno — fix preserva `length`, portanto `resolverTemplateVersion` permanece idêntico).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Thumbnails de componentes de composicao[] ausentes do snapshot inline**
- **Found during:** Code review pré-checkpoint (commit 18e303d)
- **Issue:** `pdfImages.ts` em `inlineImagensSnapshot` iterava `amb.luminarias` e `amb.sistemas` mas não percorria `l.composicao ?? []` — componentes (módulos, driver, acessórios) ficavam sem imagem inlined no PDF
- **Fix:** Adicionado loop `for (const c of l.composicao ?? []) { if (c.codigo) codigos.add(c.codigo); }` após o loop de luminarias
- **Files modified:** `src/lib/pdfImages.ts`
- **Verification:** WR-01 reportado no code review e confirmado corrigido antes do checkpoint visual (checkpoint aprovado sem imagens ausentes)
- **Committed in:** `18e303d` (fix separado, pré-checkpoint)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Fix necessário para corretude do PDF v3. Sem scope creep.

## Issues Encountered

Nenhum problema durante as tarefas planejadas. WR-01 foi detectado via code review automático (pipeline padrão do projeto) antes da validação Playwright — corrigido antes do checkpoint visual.

## Known Stubs

Nenhum. O plan 22-02 fecha PDF-03 fim-a-fim: writer persiste 3/2 condicionalmente, reader roteia via Plan 01, PDF v3 renderiza bloco composto completo com dados reais confirmados via Playwright.

## Threat Flags

Nenhuma superfície nova além do threat model do plano:
- T-22-04 (Tampering em persist de pdf_template_version): aceito — valor derivado deterministicamente de `resolverTemplateVersion` sem input de usuário livre
- T-22-05 (Information Disclosure em select): aceito — coluna não-sensível (inteiro de versão) sob mesma RLS do orçamento

## Next Phase Readiness

- PDF-03 encerrado: orçamentos com sistema composto geram PDF v3 com bloco estruturado completo; orçamentos sem composto continuam v2; snapshots antigos inalterados
- Phase 22 completa (2/2 plans)
- Milestone v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR) — COMPLETO (PDF-03 era o último requirement)
- Próximo: fechar milestone v1.3, revisão/UAT, ou iniciar v1.4 conforme prioridade do Lenny

## Self-Check

### Arquivos criados/modificados existem

- [x] `src/lib/pdfTemplateVersion.ts` — FOUND (Task 1)
- [x] `src/lib/__tests__/pdfTemplateVersion.test.ts` — FOUND (Task 2)
- [x] `src/components/Step3Revisao.tsx` — FOUND (modificado Task 1)
- [x] `src/lib/pdfImages.ts` — FOUND (modificado WR-01)

### Commits existem

- [x] `b7c35a5` — Task 1 (helper + writer + reader)
- [x] `800bbbd` — Task 2 (testes)
- [x] `18e303d` — Fix WR-01 (thumbnails composicao[])

### Checkpoint

- [x] Aprovado via Playwright — v3/v2/antigo corretos, console limpo

## Self-Check: PASSED

---
*Phase: 22-pdf-v3-sistemas-compostos*
*Completed: 2026-06-17*
