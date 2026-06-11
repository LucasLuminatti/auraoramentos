---
phase: 17-resumo-apresenta-o
verified: 2026-06-11T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verificar visualmente no Step 3 que os chips 'Ambiente — Local · Xm' aparecem abaixo da descrição de cada fita no Resumo Global de Fitas"
    expected: "Chips discretos (Badge outline) listando cada ambiente/local com sua metragem, ex.: 'Sala — Sanca · 12m'"
    why_human: "Renderização de componentes React não é verificável via grep; chip rendering só confirmável no navegador"
  - test: "Verificar que a fita inline no card do ambiente exibe 'incluída no Resumo de Fitas' (não 'Global →') sem preço por ambiente"
    expected: "Célula da fita mostra texto em itálico muted 'incluída no Resumo de Fitas'"
    why_human: "Aprovado pelo usuário via delegation em 17-02 checkpoint — não re-testado independentemente"
  - test: "Verificar que o bloco 'Análise de Otimização de Drivers' aparece recolhido por padrão com badge 'interno' e expande ao clicar"
    expected: "Bloco inicia fechado (defaultOpen=false), badge 'interno' visível, expansão funcional via clique"
    why_human: "Comportamento Collapsible (React state) não é verificável via análise estática; aprovado pelo usuário em 17-02 checkpoint"
  - test: "Verificar PDF v2 gerado: Resumo de Fitas exibe thumbnail da fita (ou placeholder) e chips 'Ambiente — Local · Xm'"
    expected: "thumb(g.imagemUrl) renderiza foto real quando disponível, placeholder quando ausente; chips de localBreakdown presentes"
    why_human: "Geração de PDF client-side via html2pdf.js não é verificável estaticamente; aprovado pelo usuário em 17-03 checkpoint"
  - test: "Verificar o advisory no gate Step 2 → Step 3: dialog aparece com itens incompletos listados e botões 'Revisar'/'Continuar mesmo assim' funcionam"
    expected: "Dialog abre com lista de incompletos por ambiente; Revisar cancela e permanece no Step 2; Continuar mesmo assim avança para o Step 3"
    why_human: "Comportamento de navegação React (onNext / dialog state) não é verificável via análise estática; aprovado pelo usuário em 17-04 checkpoint"
---

# Phase 17: Resumo & Apresentação — Verification Report

**Phase Goal:** Step 3 e o Resumo Global apresentam fitas, perfis e drivers de forma coerente — sem duplicação confusa, com localização (LOCAL) visível e drivers por ambiente — tanto na tela quanto no PDF do cliente
**Verified:** 2026-06-11
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | O Resumo Global de Fitas (tela + PDF) mostra o LOCAL de cada fita como breakdown por "Ambiente — Local" (ex.: SANCA 12m · MARCENARIA 8m → 20m), mantendo agrupamento por código e otimização de rolos cross-projeto; o Resumo de Fitas do PDF também exibe a foto da fita | ✓ VERIFIED | `orcamento.ts:407-408`: label `${amb.nome} — ${sis.local.trim()}` gerado; `orcamento.ts:463`: localBreakdown populado no resultado; `Step3Revisao.tsx:738-746`: chips renderizados com guard backward-compat; `v2.ts:272-275`: localChips via `(g.localBreakdown ?? []).map(lb => chip(...))` + `thumb(g.imagemUrl)` em linha 278 |
| 2 | A fita aparece de forma coerente: o Resumo Global é a fonte oficial de compra/rolos/preço e a fita no card do ambiente é referência contextual explícita ("incluída no Resumo de Fitas") — sem duplicação confusa para o cliente | ✓ VERIFIED | `Step3Revisao.tsx:656`: `<TableCell className="text-right text-xs text-muted-foreground italic">incluída no Resumo de Fitas</TableCell>`; ausência confirmada de "Global →" no arquivo |
| 3 | Os drivers aparecem por ambiente no Step 3 como fonte oficial; o bloco "Resumo Global de Drivers" é rebaixado a análise de otimização interna secundária (colapsável/claramente rotulada), não competindo com o pedido | ✓ VERIFIED | `Step3Revisao.tsx:679-696`: driver renderizado por sistema dentro do card de ambiente; `Step3Revisao.tsx:767-825`: bloco envolvido em `<Collapsible defaultOpen={false}>`, título "Análise de Otimização de Drivers", badge "interno", subtitle "Ferramenta de análise — não aparece no PDF do cliente" |
| 4 | Ao clicar "Avançar" do Step 2 para o Step 3, o wizard exibe aviso advisory (não-bloqueante, com "avançar mesmo assim") listando sistemas/peças incompletos: fita sem driver, driver sem fita, perfil sem fita, peça/luminária sem lâmpada esperada | ✓ VERIFIED | `Step2Ambientes.tsx:19-52`: interface `AdvisoryItem` com 4 tipos; `Step2Ambientes.tsx:126-150`: detecção dos 4 gatilhos sobre `ambientesLimpos`; `Step2Ambientes.tsx:198-224`: `AlertDialog` com "Revisar" (cancel) e "Continuar mesmo assim" (`onClick={() => { setAdvisoryOpen(false); onNext(); }}`) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/orcamento.ts` | GrupoFita estendido com `localBreakdown?` e `imagemUrl?`; `calcularRolosPorGrupo` populando ambos | ✓ VERIFIED | `LocalBreakdown` interface exportada em L368; `localBreakdown?: LocalBreakdown[]` em L386; `imagemUrl?: string` em L388; `localAcc: Map<string, number>` em L399; `imagemUrl: sis.fita.imagemUrl` em L421; `localBreakdown: Array.from(g.localAcc.entries())...` em L463 |
| `src/components/Step3Revisao.tsx` | Resumo de Fitas com LOCAL breakdown chips; fita inline com rótulo referência; bloco de drivers colapsável | ✓ VERIFIED | Chips em L738-746 com `g.localBreakdown &&` guard; rótulo "incluída no Resumo de Fitas" em L656; `Collapsible defaultOpen={false}` em L769; import `Collapsible/CollapsibleTrigger/CollapsibleContent` em L8 |
| `src/lib/pdfTemplates/v2.ts` | `blocoResumoFitas` com `thumb(g.imagemUrl)` e chips de LOCAL breakdown | ✓ VERIFIED | `thumb(g.imagemUrl)` em L278; `localChips` construído de `(g.localBreakdown ?? []).map(lb => chip(...))` em L272-274; concatenado ao `chipsHtml` em L275 via `filter(Boolean).join("")` |
| `src/components/Step2Ambientes.tsx` | Gate `handleNext` com detecção de 4 gatilhos + AlertDialog advisory | ✓ VERIFIED | `interface AdvisoryItem` em L19; `luminariaPrecisaLampada` em L26; `ADVISORY_LABELS` em L46; estado `[advisoryOpen, advisoryItems]` em L54-55; detecção dos 4 gatilhos em L126-147; `setAdvisoryOpen(true)` early return em L148-151; `AlertDialog` em L198-224 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `calcularRolosPorGrupo` loop | `GrupoFita.localBreakdown` | `Map<string, number>` (localAcc) acumulando demanda por label "Ambiente — Local" | ✓ WIRED | `orcamento.ts:407-413`: label gerado e acumulado em `localAcc`; `orcamento.ts:463`: convertido em array no resultado |
| `gruposFita` (calcularRolosPorGrupo) | Resumo Global de Fitas (tabela chips) | `g.localBreakdown` mapeado em `Badge variant="outline"` com `{lb.label} · {lb.demanda}m` | ✓ WIRED | `Step3Revisao.tsx:738-746`: guard + map com Badge |
| `gruposFita` (calcularRolosPorGrupo) | `blocoResumoFitas` no PDF | `(g.localBreakdown ?? []).map(lb => chip(...))` + `thumb(g.imagemUrl)` | ✓ WIRED | `v2.ts:272-278`: localChips + thumb na thumb-cell |
| `handleNext` (após remoção de vazios) | AlertDialog advisory | `setAdvisoryItems + setAdvisoryOpen(true)` quando `itensIncompletos.length > 0`; `AlertDialogAction` chama `onNext()` | ✓ WIRED | `Step2Ambientes.tsx:148-151`: early return com setAdvisoryOpen; `Step2Ambientes.tsx:221`: AlertDialogAction chama onNext() |
| `Resumo Global de Drivers` header | tabela de drivers | `Collapsible/CollapsibleTrigger/CollapsibleContent defaultOpen={false}` | ✓ WIRED | `Step3Revisao.tsx:769-825`: import L8, Collapsible wrapper, defaultOpen={false} |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `Step3Revisao.tsx` — chips de localBreakdown | `g.localBreakdown` | `calcularRolosPorGrupo(ambientes)` — pure function over prop `ambientes` | Sim — acumulado de `calcularDemandaFita(sis)` por label real em runtime | ✓ FLOWING |
| `v2.ts` — `blocoResumoFitas` | `g.localBreakdown`, `g.imagemUrl` | `calcularRolosPorGrupo(ambientes)` | Sim — mesma fonte; `imagemUrl` de `sis.fita.imagemUrl` (campo real da tabela `produtos`) | ✓ FLOWING |
| `Step2Ambientes.tsx` — `advisoryItems` | `itensIncompletos: AdvisoryItem[]` | Loop síncrono sobre `ambientesLimpos` (prop) | Sim — detectado de `sis.fita.codigo`, `sis.driver.codigo`, regex sobre `lum.descricao` | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| RES-01 | 17-01, 17-02, 17-03 | LOCAL no Resumo Global de Fitas/Drivers | ✓ SATISFIED | `localBreakdown` em `GrupoFita`; chips na tela e no PDF; foto da fita no PDF |
| RES-02 | 17-02, 17-03 | Fita sem duplicação confusa; apresentação coerente | ✓ SATISFIED | "incluída no Resumo de Fitas" na fita inline; `rowFita` no PDF intocada |
| RES-03 | 17-02 | Drivers aparecem no respectivo ambiente (não apenas global) | ✓ SATISFIED | Drivers já renderizados por sistema em cada ambiente (pré-existente + Phase 17 confirmado: bloco global rebaixado a análise interna colapsável, satisfazendo a intent do UAT #18 conforme D-10/D-11 do CONTEXT.md) |
| RES-05 | 17-04 | Aviso ao avançar quando peça ficou sem lâmpada/item esperado | ✓ SATISFIED | Advisory AlertDialog com 4 gatilhos (incluindo `peca-sem-lampada`) em `Step2Ambientes.tsx` |

**Note on RES-03 traceability discrepancy:** `REQUIREMENTS.md` traceability table still shows RES-03 as "Pending" and RES-05 as "Pending". This appears to be a stale status — the implementations are present in the codebase (commits `7f66431` and `5dec514`). The ROADMAP shows these as complete. The REQUIREMENTS.md traceability table needs to be updated to reflect the actual state.

**Note on RES-04:** Explicitly moved to Phase 18 per CONTEXT.md decision and ROADMAP update. Not a gap for this phase.

### Behavioral Spot-Checks

Step 7b: SKIPPED for dynamic UI behaviors (Collapsible state, AlertDialog navigation, PDF generation) — these require a running browser and cannot be tested via static analysis. Covered by human verification items above.

The following static checks passed:

| Behavior | Evidence | Status |
|----------|----------|--------|
| `calcularRolosPorGrupo` returns `localBreakdown` populated | `orcamento.ts:463`: `localBreakdown: Array.from(g.localAcc.entries()).map(([label, demanda]) => ({ label, demanda }))` | ✓ PASS |
| Backward-compat: old budgets (no imagemUrl/local) do not crash | `orcamento.ts:404-405`: `if (!key) continue;` guards; `orcamento.ts:407`: `(sis.local && sis.local.trim()) ?` guard; `v2.ts:272`: `g.localBreakdown ?? []` guard | ✓ PASS |
| "Global →" removed from Step3Revisao | grep confirms absence of "Global →" string; "incluída no Resumo de Fitas" present at L656 | ✓ PASS |
| Advisory triggers all 4 types | `Step2Ambientes.tsx`: `fita-sem-driver`, `driver-sem-fita`, `perfil-sem-fita`, `peca-sem-lampada` all present with correct predicates | ✓ PASS |
| Advisory is non-blocking | `AlertDialogAction onClick={() => { setAdvisoryOpen(false); onNext(); }}` — always calls onNext() | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `Step3Revisao.tsx` | ~819 | `<\strong>` — malformed closing tag in JSX comment text: `<strong>Qtd Global<\strong>` | ⚠️ Warning | Renders as literal `<\strong>` text in the browser; cosmetic only, no functionality broken |

### Human Verification Required

The following items require human testing in the browser. These were approved by the user via delegation ("terminar Phase 17") during plan execution, but were not independently re-tested by this verifier.

#### 1. LOCAL breakdown chips na tela (Step 3)

**Test:** npm run dev, montar orçamento com mesma fita em 2 ambientes/locais distintos (ex.: Sala — Sanca, Cozinha — Marcenaria), avançar para Step 3
**Expected:** Chips "Sala — Sanca · Xm" e "Cozinha — Marcenaria · Ym" visíveis abaixo da descrição da fita no Resumo Global de Fitas LED
**Why human:** Renderização React (Badge com text-[10px]) + guard `g.localBreakdown &&` só confirmável visualmente

#### 2. Fita inline como referência (Step 3)

**Test:** No Step 3 com sistemas, verificar a linha de fita no card de cada ambiente
**Expected:** Célula exibe "incluída no Resumo de Fitas" em itálico muted; sem valor de preço por ambiente na coluna subtotal da fita
**Why human:** Aprovado pelo usuário em checkpoint 17-02; não re-testado independentemente

#### 3. Bloco de drivers colapsável (Step 3)

**Test:** Verificar bloco "Análise de Otimização de Drivers" no Step 3 com sistemas que têm drivers
**Expected:** Bloco inicia recolhido; badge "interno" visível; subtitle "Ferramenta de análise — não aparece no PDF do cliente" visível; expande ao clicar o header; tabela de drivers aparece após expansão
**Why human:** Comportamento de Collapsible (React state, toggle) não verificável via análise estática; aprovado pelo usuário em checkpoint 17-02

#### 4. PDF v2 — foto da fita + chips de LOCAL no Resumo de Fitas

**Test:** Gerar PDF de orçamento com fita com imagemUrl em múltiplos locais; gerar também PDF de orçamento antigo sem imagemUrl
**Expected:** PDF novo: thumbnail da fita visível, chips "Ambiente — Local · Xm" presentes junto dos chips de demanda/rolos; PDF antigo: placeholder `thumb-empty` renderiza sem quebrar o layout
**Why human:** Geração de PDF via html2pdf.js client-side não verificável estaticamente; aprovado pelo usuário em checkpoint 17-03

#### 5. Advisory gate Step 2 → Step 3

**Test:** Montar ambiente com fita sem driver (metragem válida), clicar "Avançar"; testar também caminho limpo (fita+driver completo)
**Expected:** (a) Dialog aparece com "Alguns itens parecem incompletos", listando "Fita sem driver" no ambiente correto; (b) "Revisar" fecha dialog e permanece no Step 2; (c) "Continuar mesmo assim" avança para Step 3; (d) caminho limpo avança diretamente sem dialog
**Why human:** Navegação React (onNext callback, dialog state) não verificável via análise estática; aprovado pelo usuário em checkpoint 17-04

### Gaps Summary

Nenhum gap de implementação foi identificado. Todas as 4 success criteria do roadmap estão satisfeitas no código. Os 5 itens de verificação humana acima não representam gaps — representam confirmação visual de comportamentos cujo código é substancialmente correto mas não totalmente verificável programaticamente.

A única observação não-bloqueante é a tag malformada `<\strong>` em Step3Revisao.tsx:~819 (cosmética) e o status desatualizado das linhas RES-03/RES-05 na tabela de traceabilidade de REQUIREMENTS.md (documentação, não código funcional).

---

_Verified: 2026-06-11_
_Verifier: Claude (gsd-verifier)_
