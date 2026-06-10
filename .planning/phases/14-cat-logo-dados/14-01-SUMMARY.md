---
phase: 14-cat-logo-dados
plan: 01
subsystem: database
tags: [supabase, catalog, product_variants, tipo_produto, diagnostico]

requires:
  - phase: none
    provides: estado real do catálogo em produção
provides:
  - "14-DIAGNOSTICO.md com baseline (Query A), grupos null/inválidos (Query B), famílias UAT (Query C), causa-raiz MAGNETO (Query D)"
  - "Lista explícita aprovada Tier 1: 401 perfis + 18 fitas → para a migration do Plano 02"
  - "Decisão CAT-02: dado já correto, nenhum fix necessário"
affects: [14-02, 14-03]

tech-stack:
  added: []
  patterns: ["Diagnóstico de catálogo via service role + agregação JS (scripts/diag-14*.mjs)"]

key-files:
  created:
    - .planning/phases/14-cat-logo-dados/14-DIAGNOSTICO.md
    - scripts/diag-14.mjs
    - scripts/diag-14-classify.mjs
  modified: []

key-decisions:
  - "CAT-01 escopo = Tier 1 (401 perfis + 18 fitas); Tier 2 (~1.150 acessórios/spots) deferido — sem efeito funcional"
  - "Regra de grupo = descrição começa com 'PERFIL'/'FITA' (não 'contém WALL WASHER') — evita marcar spots/difusores como perfil"
  - "CAT-02 = nenhum fix: todos os 27 MAGNETO22 já têm sistema='magneto_48v' e TINY MAG='tiny_magneto'; toast já dispara correto"

patterns-established:
  - "Aprovação por grupo/regra (D-02) com lista explícita materializada para auditabilidade"

requirements-completed: []

duration: ~25min
completed: 2026-06-10
---

# Phase 14 / Plan 01: Diagnóstico de Catálogo — Summary

**Varredura read-only de produção isolou 401 perfis + 18 fitas escondidos do seletor correto (tipo_produto null) e confirmou que o dado MAGNETO (CAT-02) já está correto.**

## Performance
- **Duration:** ~25 min
- **Tasks:** 2 (varredura + checkpoint de aprovação)
- **Files created:** 3 (diagnóstico + 2 scripts)

## Accomplishments
- **Query A (baseline):** 4.975 variants — 4.053 com `tipo_produto = null`, mas a maioria são luminárias/acessórios que já aparecem no seletor luminária.
- **Query B (varredura ampla):** reclassificação por descrição isolou só os funcionalmente quebrados — 401 perfis + 18 fitas. 0 drivers escondidos.
- **Query C:** as 4 famílias do UAT (WALL WASHER, CANTONEIRA, LM3475, LM3291) confirmadas com `tipo_produto = NULL` (não `'wall_washer'`). Nuance descoberta: `SPOT EMBUTIR WALL WASHER` e difusores/kits NÃO são perfis.
- **Query D (CAT-02):** todos os 27 `MAGNETO22` têm `sistema='magneto_48v'` ✓ e TINY MAG `tiny_magneto` ✓ → toast já correto; nenhum fix necessário.
- **Checkpoint D-02:** Lenny aprovou Tier 1 e "nenhum fix" para CAT-02.

## Files Created/Modified
- `.planning/phases/14-cat-logo-dados/14-DIAGNOSTICO.md` — diagnóstico completo + listas explícitas aprovadas
- `scripts/diag-14.mjs` — Queries A–D via service role + agregação JS
- `scripts/diag-14-classify.mjs` — classificação rule-based (perfil/fita/acessório)

## Decisions Made
- **Tier 1 only** (401 perfis + 18 fitas). Tier 2 deferido para etapa futura de higiene semântica.
- **Regra de grupo por prefixo de descrição** ("começa com PERFIL/FITA") em vez de "contém WALL WASHER" — mais preciso, evita falsos positivos (spots/difusores).
- **CAT-02 sem fix** — dado já consistente; `AmbienteCard.tsx` não será tocado no Plano 02.

## Deviations from Plan
None — plano executado como escrito. Acesso à DB foi via service role + PostgREST (agregação em JS) em vez do SQL editor, por ser o método disponível neste ambiente non-TTY; resultado idêntico às Queries A–D do RESEARCH.

## Issues Encountered
- Heurística inicial "contém PERFIL" gerava falsos positivos (MODULO SPOT ... USO PERFIL). Refinada para "começa com PERFIL" → 401 perfis limpos, sem vazamento de acessórios.

## Next Phase Readiness
- Listas explícitas Tier 1 prontas em `14-DIAGNOSTICO.md` (apêndice) → consumidas pela migration do Plano 02.
- CAT-02 resolvido no diagnóstico (nenhum fix) → Plano 02 Task 3 (regex) será pulada.

---
*Phase: 14-cat-logo-dados*
*Completed: 2026-06-10*
