---
phase: 21-system-mold-valida-o-reuso
plan: 03
subsystem: ui-validation + ui-duplication
tags: [advisory, compostos, duplicar, system-mold, tdd, a11y]
dependency_graph:
  requires:
    - calcularMetragemModulosDifusos (orcamento.ts — Plan 01)
    - clonarItemLuminaria (orcamento.ts — Plan 01)
    - REGRAS_COMPOSICAO (orcamento.ts — Plan 01)
    - onDuplicate? em ComposicaoCardProps (ComposicaoCard.tsx — Plan 02)
    - rota 'modular' em AmbienteCard (Plan 02)
  provides:
    - detectarAvisosComposto() — função pura exportada com 3 condições D-03
    - 3 novos tipos de advisory não-bloqueante no handleNext (composto-sem-driver, composto-sem-conector, modular-sem-fita)
    - onDuplicarComposto threading AmbienteCard → ComposicaoCard
    - iniciarDuplicacaoComposto + inserirCompostoEm + Dialog de seleção de destino
    - driverReqId ref guard para buscarDriverModular (WR-01/WR-02)
    - duplicação chaveada por id de ambiente (WR-03)
  affects:
    - Phase 22 PDF v3 (Step 3 agrega compostos duplicados corretamente por código)
tech-stack:
  added: []
  patterns:
    - TDD para lógica de advisory (função pura exportada testável sem montar componente)
    - driverReqId ref como race-condition guard em closure async (substitui cancelled flag morto)
    - Seletor de ambiente destino chaveado por id (não índice) — robusto a reordenações com dialog aberto
    - DialogDescription para aria-describedby (Radix a11y — detectado via Playwright)

key-files:
  created:
    - src/components/__tests__/advisory-compostos.test.ts
  modified:
    - src/components/Step2Ambientes.tsx
    - src/components/AmbienteCard.tsx
    - src/components/ComposicaoCard.tsx

key-decisions:
  - "detectarAvisosComposto extraída como função pura exportada de Step2Ambientes.tsx — loop de compostos testável sem montar componente React (TDD)"
  - "D-03 não avisa embutir sem kit LM2987 — evita ruído; s_mode sem REGRAS_COMPOSICAO (não existe) não gera composto-sem-conector"
  - "driverReqId ref substitui cancelled flag morto (WR-01/02) — ref garante que só a busca mais recente reseta loading e aplica sugestão"
  - "inserirCompostoEm chaveado por ambiente.id (não índice) — robusto se lista mudar com dialog aberto (WR-03)"
  - "ambientes.length === 1 insere direto sem dialog (D-05) — UX sem fricção quando há só um ambiente"
  - "DialogDescription fornece aria-describedby ao dialog de duplicação — fix a11y detectado via console Playwright"

patterns-established:
  - "Advisory não-bloqueante via função pura: extrair detectarAvisosComposto() do handleNext para testar sem componente"
  - "Race-condition guard em busca async: useRef<string>() como requestId (vence a busca mais recente)"

requirements-completed: [VAL-01, DUP-01]

duration: "35 min"
completed: "2026-06-16"
---

# Phase 21 Plan 03: Validação & Reuso — Advisory de Composto + Duplicação entre Ambientes

**Advisory não-bloqueante D-03 (3 condições: sem driver, sem conector, SYSTEM MOLD sem fita) + duplicação de composto entre ambientes via clonarItemLuminaria com seletor de destino, threading onDuplicarComposto e 3 follow-up fixes de code review (race-condition guard + a11y). 196 testes verdes.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-16T16:34:00Z
- **Completed:** 2026-06-16T16:54:00Z
- **Tasks:** 3 (incluindo checkpoint humano aprovado)
- **Files modified:** 4

## Accomplishments

- VAL-01: `detectarAvisosComposto()` exportada de Step2Ambientes.tsx — função pura com 3 condições D-03 integrada ao `handleNext` não-bloqueante; 12 novos testes cobrindo os 7 comportamentos do plano (196 total)
- DUP-01: botão Duplicar do ComposicaoCard dispara `onDuplicarComposto` threading via AmbienteCard → Step2Ambientes → Dialog de seleção de ambiente destino → `clonarItemLuminaria` (novos UUIDs em toda a árvore); Step 3 soma 2× correto por agregar por código
- 3 follow-up fixes pós code review: driverReqId ref guard (WR-01/02), duplicação chaveada por id (WR-03), DialogDescription a11y detectado via Playwright
- Checkpoint humano aprovado: SYSTEM MOLD abre card modular, metragem 0,264 m derivada corretamente, "Adicionar fita" pré-preenche metragem, advisory não-bloqueante, duplicação clona com novos UUIDs, 0 erros de console

## Task Commits

1. **Task 1: VAL-01 — 3 novos AdvisoryItem de composto incompleto** — `62b0f95` (feat, TDD)
2. **Task 2: DUP-01 — orquestração duplicação composto com seletor de ambiente destino** — `2992bc5` (feat)
3. **Task 3: Checkpoint humano** — aprovado (sem commit de código)
4. **Follow-up WR-01/02/03 — request-id guard + duplicação chaveada por id** — `3ba38f7` (fix, code review)
5. **Follow-up a11y — DialogDescription no dialog de duplicação** — `609f216` (fix, Playwright)

## Files Created/Modified

- `src/components/__tests__/advisory-compostos.test.ts` — 12 testes para detectarAvisosComposto() cobrindo os 7 behaviors D-03 (criado)
- `src/components/Step2Ambientes.tsx` — 3 novos tipos advisory + ADVISORY_LABELS + detectarAvisosComposto exportada + dupState/iniciarDuplicacaoComposto/inserirCompostoEm + Dialog de seleção de destino + WR-03 + DialogDescription a11y
- `src/components/AmbienteCard.tsx` — onDuplicarComposto threaded até ComposicaoCard
- `src/components/ComposicaoCard.tsx` — driverReqId ref guard (WR-01/02) substituindo cancelled flag morto

## Decisions Made

- `detectarAvisosComposto()` extraída como função pura exportada para ser testável sem montar componente React (padrão TDD aplicado ao longo da fase)
- Condição `composto-sem-conector` guarda via `REGRAS_COMPOSICAO[sistema]` — sistemas sem entrada no mapa (ex: `'s_mode'`) passam silenciosamente (não existe `REGRAS_COMPOSICAO['s_mode']`)
- `composto-sem-driver` aplica a `magneto_48v` e `tiny_magneto` mas NÃO a `s_mode` (driver modular é advisory por outro painel, não por conector obrigatório)
- driverReqId ref (WR-01/02): cada chamada a `buscarDriverModular` gera um ID; só a busca cujo ID ainda é o atual reseta loading e aplica sugestão — elimina travamento em `Calculando...`
- Dialog de destino chaveado por `ambiente.id` em vez de índice (WR-03): robusto se o usuário reorganizar ambientes enquanto o dialog está aberto
- `ambientes.length === 1`: insere clone direto sem dialog (D-05) — sem fricção no caso mais comum

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] cancelled flag morto em buscarDriverModular (WR-01/02)**

- **Found during:** Code review pós-checkpoint (3ba38f7)
- **Issue:** `cancelled` era declarado dentro do closure de `buscarDriverModular` mas nunca marcado como `true` em nenhum caminho de código — o guard era inoperante. Chamadas em sobreposição podiam deixar o spinner de driver travado em "Calculando..." ou aplicar sugestão de busca obsoleta.
- **Fix:** Substituído por `driverReqId = useRef<string>('')`; cada chamada gera `reqId = crypto.randomUUID()`; só a busca cujo `reqId === driverReqId.current` no momento do `finally` reseta loading e aplica resultado.
- **Files modified:** `src/components/ComposicaoCard.tsx`
- **Verification:** 196 testes verdes; Playwright confirmou 0 erros de console
- **Committed in:** 3ba38f7

**2. [Rule 1 — Bug] inserirCompostoEm indexava ambiente por posição (WR-03)**

- **Found during:** Code review pós-checkpoint (3ba38f7)
- **Issue:** `dupState.origemIdx` e o seletor de destino usavam índice numérico; se o usuário adicionasse ou removesse um ambiente enquanto o dialog estava aberto, o clone iria para o ambiente errado.
- **Fix:** `dupState` passou a guardar `origemId: string`; o seletor lista `ambientes.map(a => ({ id: a.id, nome: a.nome }))`; `inserirCompostoEm` filtra por `a.id === destinoId`.
- **Files modified:** `src/components/Step2Ambientes.tsx`
- **Verification:** Playwright confirmou clonagem correta no ambiente escolhido
- **Committed in:** 3ba38f7

**3. [Rule 2 — Missing] DialogDescription ausente no dialog de duplicação (a11y)**

- **Found during:** Playwright pós-checkpoint, console do navegador (609f216)
- **Issue:** Radix `DialogContent` sem `<DialogDescription>` emitia aviso `Missing Description or aria-describedby` — violação de acessibilidade detectada em runtime.
- **Fix:** Texto descritivo "Escolha o ambiente de destino para o clone do sistema." movido para `<DialogDescription>` que fornece `aria-describedby` automaticamente.
- **Files modified:** `src/components/Step2Ambientes.tsx`
- **Verification:** 0 avisos a11y no console Playwright após o fix
- **Committed in:** 609f216

---

**Total deviations:** 3 auto-fixed (2 Rule 1 — bugs, 1 Rule 2 — missing critical)
**Impact on plan:** Todos os fixes necessários para corretude e acessibilidade. Sem scope creep.

## Issues Encountered

**Observação não-bloqueante — driver advisory depende de `wm` preenchida na fita:**
`buscarDriverModular` filtra `potencia_watts >= wm × metragem × MARGEM_SEGURANCA_DRIVER`. Se o produto da fita escolhida tiver `wm = null` ou `wm = 0` no catálogo, a query retorna zero resultados e o advisory não aparece. Não é bug — é limitação de dados; o vendedor ainda pode pesquisar e aplicar o driver manualmente. Registrado como tech debt para quando a carga de dados de W/m estiver completa.

## Known Stubs

Nenhum. Toda a lógica de advisory e duplicação está funcional e wired. O botão Duplicar não aparece se `onDuplicate` for `undefined` (por design — Plan 02 já documentou isso como stub intencional resolvido neste plan).

## Threat Flags

Nenhum novo. T-21-06 (Tampering — clone com UUIDs novos) mitigado via `clonarItemLuminaria` (Plan 01). T-21-07 (Information Disclosure — destino restrito ao mesmo orçamento) aceito. Nenhuma nova superfície de rede introduzida.

## User Setup Required

Nenhum — nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Phase 21 COMPLETA: SIST-03 (SYSTEM MOLD) + VAL-01 (advisory) + DUP-01 (duplicação) entregues
- Phase 22 desbloqueada: PDF v3 com seção "Sistemas Compostos" — Step 3 já agrega compostos duplicados corretamente; `pdf_template_version: 3` pode ser ativado quando `ambientes.some(a => a.luminarias.some(l => l.composicao?.length))`
- 196 testes verdes, 0 erros de console, build verde

## Self-Check

| Check | Result |
|-------|--------|
| `src/components/__tests__/advisory-compostos.test.ts` existe | FOUND |
| `src/components/Step2Ambientes.tsx` modificado | FOUND |
| `src/components/AmbienteCard.tsx` modificado | FOUND |
| `src/components/ComposicaoCard.tsx` modificado | FOUND |
| commit 62b0f95 (VAL-01) | FOUND |
| commit 2992bc5 (DUP-01) | FOUND |
| commit 3ba38f7 (WR-01/02/03) | FOUND |
| commit 609f216 (a11y) | FOUND |
| 196 testes verdes | PASS |
| build verde | PASS |
| Playwright 0 erros de console | PASS |
| Checkpoint humano aprovado | PASS |

## Self-Check: PASSED

---
*Phase: 21-system-mold-valida-o-reuso*
*Completed: 2026-06-16*
