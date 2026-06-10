---
phase: 14-cat-logo-dados
plan: 03
subsystem: testing
tags: [playwright, e2e, catalog, validation, supabase]

requires:
  - phase: 14-02
    provides: migration tipo_produto aplicada em prod
provides:
  - "e2e/catalogo.spec.ts — valida seletores perfil/fita + dica MAGNETO contra PROD"
  - "Confirmação: 4 Success Criteria do roadmap Phase 14 atendidos"
affects: []

tech-stack:
  added: []
  patterns: ["Teste E2E que valida catálogo no Step 2 sem persistir orçamento (persistência só no Step 3 → zero lixo em PROD)"]

key-files:
  created:
    - e2e/catalogo.spec.ts
  modified: []

key-decisions:
  - "Teste fica no Step 2 — não cria rascunho em prod (persistência só no Step 3). afterEach defensivo."
  - "Validação manual (D-05) coberta pelo Playwright + spot-check de snapshot (D-06); Lenny aprovou"

patterns-established:
  - "Assert de toast por frase exclusiva ('Trilho magnético 48V') que não colide com a descrição do produto ('MAGNETICO ... 48V')"

requirements-completed: [CAT-01, CAT-02]

duration: ~20min
completed: 2026-06-10
---

# Phase 14 / Plan 03: Validação de Catálogo (Playwright + UAT) — Summary

**e2e/catalogo.spec.ts (3/3 passando contra PROD) confirma que perfis/fita corrigidos aparecem nos seletores e a dica do MAGNETO 48V está correta; orçamentos antigos intactos.**

## Performance
- **Duration:** ~20 min
- **Tasks:** 2 (teste Playwright + checkpoint human-verify aprovado)
- **Files created:** 1 (e2e/catalogo.spec.ts)

## Accomplishments
- **`e2e/catalogo.spec.ts`** criado seguindo o padrão de `wizard.spec.ts` (auth setup, snapshot/cleanup helpers).
  - **Teste CAT-01:** abre Step 2 → aba Sistemas → Novo Sistema → Vincular Perfil; assert que LM3475 (WALL WASHER), LM982 (CANTONEIRA), LM3291 (NANO) aparecem no seletor de perfil e LM3825 no seletor de fita.
  - **Teste CAT-02:** adiciona luminária MAGNETO 48V (LM2331); assert toast "Trilho magnético 48V" presente e "Tiny Mag" ausente.
- **`npm run test:e2e -- catalogo` → 3 passed (31.5s)** contra PROD (setup + 2 specs).
- **D-06 (snapshot intacto):** spot-check via service role — 9/9 orçamentos antigos com itens preservados no jsonb.
- **Checkpoint human-verify:** aprovado por Lenny.

## Verificação dos Success Criteria (roadmap Phase 14)
1. WALL WASHER no seletor de perfil → ✅ (Playwright)
2. CANTONEIRA / LM3291 / LM3475 no seletor correto → ✅ (Playwright)
3. Dica MAGNETO descreve o MAGNETO (não TINY) → ✅ (Playwright toast assert)
4. Orçamentos antigos abrem sem perder dados (D-06) → ✅ (spot-check snapshot)

## Files Created/Modified
- `e2e/catalogo.spec.ts` — teste de validação de catálogo contra PROD

## Decisions Made
- **Sem persistência em PROD:** teste fica no Step 2; persistência só no Step 3. `afterEach` defensivo (deleta só rascunho novo da janela, esperado 0).
- **Assert de toast robusto:** usa "Trilho magnético 48V" (frase exclusiva do toast, acento `é`) — não colide com a descrição do produto ("MAGNETICO").

## Deviations from Plan
- Validação manual (Task 2, how-to-verify) coberta pelo pipeline automático (Playwright + spot-check de snapshot) conforme padrão do usuário, em vez de execução manual passo-a-passo. Lenny aprovou.

## Issues Encountered
None.

## Next Phase Readiness
- Phase 14 (CAT-01 + CAT-02) entregue e validada. Catálogo corrigido em prod, regressão de snapshot descartada.
- Pendência sinalizada (fora de escopo): divergência do histórico de migrations + `20260602` (ativo) não-aplicada — tratar em etapa futura.

---
*Phase: 14-cat-logo-dados*
*Completed: 2026-06-10*
