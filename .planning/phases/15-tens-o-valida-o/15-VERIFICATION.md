---
phase: 15-tens-o-valida-o
verified: 2026-06-11T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code); 2 items need human UAT
re_verification:
  previous_status: none
  note: initial verification
human_verification:
  - test: "Selecionar fita com voltagem definida e abrir o seletor de driver"
    expected: "Seletor já mostra apenas drivers de voltagem compatível (ou tensao null). Selecionar driver de voltagem diferente dispara toast.warning + badge ⚠ NV × MV no header do sistema; badge some ao corrigir."
    why_human: "Comportamento visual/toast em tempo real — não verificável por grep."
  - test: "Criar Ambiente A com sistema 24V e Ambiente B com sistema 12V"
    expected: "Nenhum bloqueio indevido; cada ambiente avança independente para Step 3. Validação só ocorre por-sistema (fita vs driver do mesmo sistema)."
    why_human: "Fluxo cross-ambiente end-to-end; código não tem vínculo entre ambientes, mas confirmação UX é manual (UAT #6)."
  - test: "Adicionar produto da linha TINY (sistema_magnetico='tiny_magneto')"
    expected: "Toast '⚡ TINY MAG 24V: requer driver 24V externo' + badge âmbar persistente 'requer driver 24V externo' no card da luminária."
    why_human: "Toast/badge visual em runtime."
---

# Phase 15: Tensão & Validação Verification Report

**Phase Goal:** O wizard guia o colaborador a escolher o driver certo automaticamente — inferindo voltagem a partir da fita, sugerindo driver compatível, avisando em caso de divergência — e permite usar tensão diferente em cada ambiente sem bloqueio indevido.
**Verified:** 2026-06-11
**Status:** human_needed (todos os 5 critérios PASS no código; 3 itens visuais/UX recomendados para UAT)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pré-filtro driver por voltagem + aviso divergência (não passa silenciosamente) | PASS | `useProdutoSearch.ts:33-34` adiciona `.or('tensao.eq.${filtroVoltagem},tensao.is.null')` quando `filtro==='driver'`; `ProdutoAutocomplete` repassa `filtroVoltagem` (L14,17,20); `AmbienteCard.tsx:553` passa `filtroVoltagem={sis.fita.voltagem}` ao driver. Aviso de divergência: `toast.warning` em ambos branches driver (L161-167) e fita (L169-176) + badge `⚠ {fv}V × {dv}V` (L410-416). |
| 2 | Ambientes independentes, sem bloqueio indevido | PASS (código) / human | Validação 100% por-sistema (compara `sis.fita.voltagem` vs `sis.driver.voltagem` do MESMO sistema); o `return` bloqueante antigo foi removido — agora só `toast.warning`, seleção prossegue (D-05). Nenhum mecanismo no código permite um ambiente bloquear outro. UAT #6 recomendado. |
| 3 | Resumo Global agrupa por (codigo + voltagem) | PASS | `orcamento.ts:304` chave `${sis.driver.codigo}\|${sis.driver.voltagem}`; valor armazena `codigo` (L314); loop de saída usa `g.codigo` (L328) — chave composta nunca vaza. `Step3Revisao.tsx:776` key `${d.driverCodigo}-${d.voltagem}`, rótulo `{d.driverCodigo} · {d.voltagem}V` (L778), coluna "Tensão" removida (header L764-771 sem ela). 5/5 testes passam. |
| 4 | Advisory TINY 24V | PASS (código) / human | Detecção via `produto.sistema_magnetico === 'tiny_magneto'` (L96, D-07), regex fallback preservado; toast "requer driver 24V externo" (L98,100); badge âmbar persistente `item.sistema === 'tiny_magneto'` (L381-382). Nota: SC4 menciona "oferece a opção de incluí-lo" — D-06 decidiu advisory puro (sem botão de inclusão automática), explicitamente fora de escopo v1.2. Coberto como orientação. |
| 5 | Pré-fill driver sugerido ao selecionar fita | PASS | `buscarDriverSugerido` (L139-152): menor potência suficiente (`potencia_watts >= consumo*1.05`), mesma voltagem, exclui DESCONTINUAR, `order asc limit 1`. Só preenche se driver vazio (D-03, L238); reconcilia por `sis.id` contra `ambienteRef.current` após await (L246-248), nunca sobrescreve edição manual. Fita aplicada síncrona antes do await (L235) — nunca perdida. |

**Score:** 5/5 critérios verificados no código.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/orcamento.ts` | grouping (codigo+voltagem), loop usa g.codigo | VERIFIED | L304/L314/L328 — chave composta interna, codigo limpo na saída |
| `src/types/orcamento.test.ts` | 5 testes cobrindo o fix | VERIFIED | 5 testes (mesmo cód voltagens distintas → 2 linhas; mesma voltagem → soma; driverCodigo sem '\|'; edges) — 5/5 pass |
| `src/components/AmbienteCard.tsx` | pré-fill async reconciliado por id, divergência não-bloqueante, TINY advisory | VERIFIED | ambienteRef (L53-54), buscarDriverSugerido (L139), reconcile by id (L247), badges (L382,414) |
| `src/components/Step3Revisao.tsx` | rótulo composto driver, coluna Tensão removida | VERIFIED | L776-778; header sem Tensão |
| `src/hooks/useProdutoSearch.ts` | pré-filtro driver por voltagem da fita | VERIFIED | filtroVoltagem 3º param (L7), `.or(tensao.eq/is.null)` (L33-34), dep array (L53) |
| `src/components/ProdutoAutocomplete.tsx` | repassa filtroVoltagem | VERIFIED | prop (L14/L17), thread ao hook (L20) |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| AmbienteCard driver autocomplete | useProdutoSearch | filtroVoltagem={sis.fita.voltagem} → ProdutoAutocomplete → hook | WIRED |
| handleSelectProdutoSistema (fita) | Supabase produtos | buscarDriverSugerido async query | WIRED |
| async pre-fill | ambiente state | ambienteRef.current + onChange reconciled by sis.id | WIRED |
| calcularDriversPorProjeto | Step3 resumo render | ResumoDriverProjeto → rótulo composto | WIRED |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| TENS-01 (aviso divergência) | SATISFIED | toast.warning não-bloqueante + badge persistente (SC1) |
| TENS-02 (grouping codigo+voltagem) | SATISFIED | orcamento.ts L304 + 5 testes (SC3) |
| SIST-04 (advisory TINY 24V) | SATISFIED (advisory) | sistema_magnetico==='tiny_magneto' toast+badge (SC4); botão de inclusão deferido por D-06 |
| UX-02 (sugerir/pré-filtrar driver) | SATISFIED | pré-filtro + pré-fill (SC1/SC5) |

### Anti-Patterns Found

Nenhum blocker. Observações:
- Branch if/else em L97-101 (AmbienteCard) tem mensagem idêntica nos dois ramos — redundância cosmética, sem impacto funcional (advisory correto em ambos os casos).
- SC4 fala em "oferece a opção de incluí-lo" mas D-06/CONTEXT decidiu explicitamente advisory puro (botão de inclusão rejeitado nesta fase, tangencia montagem composta v1.3). Desvio intencional e documentado — não é gap.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Grouping por (codigo+voltagem) | `npx vitest run src/types/orcamento.test.ts` | 5 passed | PASS |

### Human Verification Required

1. **Pré-filtro + aviso divergência** — selecionar fita, abrir seletor driver (só compatíveis), escolher voltagem divergente → esperar toast + badge no header.
2. **Ambientes independentes (UAT #6)** — Ambiente A 24V + Ambiente B 12V sem bloqueio mútuo.
3. **Advisory TINY** — adicionar TINY MAG → toast + badge âmbar persistente.

### Gaps Summary

Nenhum gap bloqueante. Todos os 5 success criteria têm implementação substantiva, wired e com dados reais (Supabase). O grouping fix (TENS-02/D-08) está correto e coberto por 5 testes verdes — inclusive o código usa `g.codigo` (mais limpo que o `chave.split('|')[0]` descrito no SUMMARY, mesmo resultado correto). A única ressalva é a divergência intencional em SC4 (advisory puro vs "oferecer inclusão"), coberta por decisão D-06. Status `human_needed` apenas pela natureza visual/UX de 3 comportamentos (toasts, badges, fluxo cross-ambiente), não por falhas de código.

---

_Verified: 2026-06-11_
_Verifier: Claude (gsd-verifier)_
