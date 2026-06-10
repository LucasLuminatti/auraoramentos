---
phase: 14-cat-logo-dados
plan: 02
subsystem: database
tags: [supabase, migration, product_variants, tipo_produto, catalog]

requires:
  - phase: 14-01
    provides: lista explícita Tier 1 aprovada (401 perfis + 18 fitas) + decisão CAT-02
provides:
  - "Migration 20260610000001 aplicada em prod: 401 perfis + 18 fitas com tipo_produto corrigido"
  - "Catálogo: perfil 222→623, fita 298→316, null 4053→3634"
affects: [14-03]

tech-stack:
  added: []
  patterns: ["Aplicação de fix de dados via service role + migration repair quando supabase db push é inseguro (histórico divergente)"]

key-files:
  created:
    - supabase/migrations/20260610000001_tipo_produto_correcao_catalogos.sql
    - scripts/diag-14-apply.mjs
  modified: []

key-decisions:
  - "supabase db push NÃO usado — puxaria 6 migrations locais divergentes (incl. 20260602 não-aplicada). Aplicado via service role (aprovado por Lenny) + migration repair p/ registrar 20260610000001"
  - "CAT-02: Task 3 (regex AmbienteCard.tsx) PULADA — dado MAGNETO já correto, AmbienteCard.tsx inalterado"

patterns-established:
  - "Migration idempotente por lista explícita WHERE codigo IN (...) com guarda IS DISTINCT FROM"

requirements-completed: [CAT-01, CAT-02]

duration: ~20min
completed: 2026-06-10
---

# Phase 14 / Plan 02: Migration de tipo_produto — Summary

**401 perfis e 18 fitas que estavam invisíveis nos seletores ganharam tipo_produto correto em produção; CAT-02 não exigiu mudança (dado MAGNETO já correto).**

## Performance
- **Duration:** ~20 min
- **Tasks:** 2 executadas (migration + aplicação); Task 3 (regex) pulada por decisão
- **Files created:** 2 (migration + script de aplicação)

## Accomplishments
- **Migration `20260610000001`** criada: idempotente, transacional (BEGIN/COMMIT), `WHERE codigo IN (...)` com guarda `IS DISTINCT FROM`, header de ROLLBACK, mira `product_variants` (não a view). Sem `wall_washer` inválido.
- **Aplicada em prod** via service role (caminho aprovado por Lenny — `supabase db push` era inseguro por divergência de histórico). Delta D-04 exato:
  - perfil **222 → 623 (+401)**, fita **298 → 316 (+18)**, null **4053 → 3634 (−419)**.
- **Idempotência confirmada:** re-execução altera 0 linhas.
- **Histórico:** `20260610000001` marcada `applied` via `supabase migration repair` (aparece em `supabase migration list`).
- **CAT-02:** nenhuma alteração de código — `AmbienteCard.tsx` intacto (dado já `magneto_48v`/`tiny_magneto`).

## Relatório solicitado por Lenny
- **Perfis corrigidos:** 401 (todos os 401 da lista; 0 já eram perfil; 0 não-encontrados)
- **Fitas corrigidas:** 18 (todas; 0 já eram fita)
- **Grupos afetados:** WALL WASHER (LM3475–3480), CANTONEIRA (LM982/983/2429/1646…), NANO (LM3291…), PERFIL DE SOBREPOR/EMBUTIR; FITA LED ULTRA POWER/DIRECT COB/BABY COB + AU004
- **Antes/depois por tipo_produto:** ver tabela "## Delta pós-migration (D-04)" em 14-DIAGNOSTICO.md

## Files Created/Modified
- `supabase/migrations/20260610000001_tipo_produto_correcao_catalogos.sql` — migration aditiva idempotente (registro auditável)
- `scripts/diag-14-apply.mjs` — aplicação via service role (não-committado / tooling)

## Decisions Made
- **Mecanismo:** service role + `migration repair` em vez de `db push` — evitou aplicar 6 migrations divergentes (incl. `20260602` soft-delete não-aplicada) como efeito colateral.
- **CAT-02 sem código:** Task 3 pulada — dado já correto (D-03 satisfeito na camada de dado, que já estava certa).

## Deviations from Plan
- **Task 2 ([BLOCKING] supabase db push):** não executado como push. Causa: `supabase migration list` revelou histórico divergente — 6 migrations locais pendentes, incluindo `20260602000001` (coluna `ativo`) que NÃO está aplicada em prod. Push aplicaria essas como efeito colateral. Lenny aprovou aplicar só o fix de dados via service role + `migration repair`. Resultado idêntico ao que a migration faria; arquivo .sql preservado como registro.
- **Task 3 (regex MAGNETO):** pulada por decisão (CAT-02 = nenhum fix).

## Issues Encountered
- **Divergência de histórico de migrations (sinalizado ao Lenny):** arquivos locais (`20260512/14/15/0602`) ≠ histórico remoto do CLI; `20260602` (soft-delete `ativo`) não aplicada em prod. **Fora de escopo da Phase 14** — tratar em etapa específica futura.

## Next Phase Readiness
- Catálogo corrigido na DB viva → Plano 03 (Playwright + UAT manual) pode validar os seletores no app real.

---
*Phase: 14-cat-logo-dados*
*Completed: 2026-06-10*
