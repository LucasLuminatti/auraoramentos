---
phase: 19-funda-o-compostos
plan: 02
subsystem: database
tags: [catalogo, busca, migration, conector, kit_fixacao, tipo_produto, useProdutoSearch]

# Dependency graph
requires:
  - phase: 19-funda-o-compostos/plan-01
    provides: ItemComposicao data model and calcularSubtotalComposicao foundation

provides:
  - ProdutoFiltro type extended with 'conector' and 'kit_fixacao' values
  - useProdutoSearch query builder routes conector/kit_fixacao via .eq('tipo_produto', filtro)
  - Migration SQL (not yet applied) to fix tipo_produto for LM2338/LM3168/LM3169 (conector) and LM2987 (kit_fixacao)
  - check_tipo_produto constraint extended to include 'kit_fixacao'

affects: [19-03, 20-fluxos-magneticos, Phase 20 checklist de componentes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration aditiva de tipo_produto via UPDATE escopado por codigo IN (...) — padrão CAT-01 Phase 14 reutilizado"
    - "ProdutoFiltro union estendida com valores dedicados por tipo de componente; query builder usa .eq() direto"

key-files:
  created:
    - supabase/migrations/20260612000001_cat03_tipo_produto_conector_kit.sql
  modified:
    - src/hooks/useProdutoSearch.ts

key-decisions:
  - "Auditoria DB ao vivo deferida ao Plan 03 [BLOCKING]: executor sem credencial service role; lista-semente LM2338/LM3168/LM3169/LM2987 confirmada por contexto D-08 mas deve ser expandida pela query de auditoria antes do apply"
  - "check_tipo_produto constraint re-declarado com 'kit_fixacao' adicionado; ALTER idempotente (DROP IF EXISTS + ADD)"
  - "filtro='luminaria' OR clause mantém 'conector' para compatibilidade com busca de luminária avulsa (não alterado)"

patterns-established:
  - "Filtro dedicado por tipo de componente: ProdutoFiltro + .eq('tipo_produto', filtro) — extensível para novos tipos sem alterar query builder"

requirements-completed: [CAT-03]

# Metrics
duration: 8min
completed: 2026-06-12
---

# Phase 19 Plan 02: CAT-03 Catalog Fix Summary

**`ProdutoFiltro` estendida com `'conector'`/`'kit_fixacao'` + migration SQL aditiva para corrigir `tipo_produto` dos SKUs MAGNETO/TINY/kit (LM2338, LM3168, LM3169, LM2987) — aplicacao deferida ao Plan 03**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-12T17:50:00Z
- **Completed:** 2026-06-12T17:56:57Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- `ProdutoFiltro` union agora inclui `'conector' | 'kit_fixacao'`; query builder roteia ambos via `.eq('tipo_produto', filtro)` (CAT-03 código completo)
- Migration SQL escrita com `BEGIN/COMMIT`, `IS DISTINCT FROM` (idempotência), `WHERE codigo IN (...)` escopado (PITFALLS C-1), constraint `check_tipo_produto` estendido para aceitar `'kit_fixacao'`
- `filtro='luminaria'` OR clause preservada intacta (compatibilidade com busca de luminária avulsa)
- Build verde (`✓ built in 9.06s`)

## Task Commits

1. **Task 1: Adicionar filtros 'conector' e 'kit_fixacao' ao ProdutoFiltro e à query builder** - `be457cd` (feat)
2. **Task 2: Escrever a migration de UPDATE aditiva de tipo_produto (CAT-03)** - `92ffa4f` (feat)

## Files Created/Modified

- `src/hooks/useProdutoSearch.ts` - ProdutoFiltro union + query builder condition estendidos com 'conector' e 'kit_fixacao'
- `supabase/migrations/20260612000001_cat03_tipo_produto_conector_kit.sql` - Migration aditiva CAT-03 (escrita, não aplicada)

## Decisions Made

- **Auditoria DB deferida ao Plan 03 [BLOCKING]:** executor não tem credencial de service role em runtime; lista-semente (LM2338/LM3168/LM3169 → conector; LM2987 → kit_fixacao) vem do contexto D-08 e é suficiente para a migration, mas deve ser confirmada e expandida pela query de auditoria antes do apply no Plan 03.
- **constraint re-declarado de forma aditiva:** `DROP CONSTRAINT IF EXISTS check_tipo_produto` + `ADD CONSTRAINT` com o conjunto completo incluindo `'kit_fixacao'`; o `IF EXISTS` protege contra o caso de o nome divergir (a migration inclui instrução para confirmar via `pg_constraint`).
- **filtro='luminaria' OR preservado:** o bloco `tipo_produto.in.(spot,lampada,acessorio,conector,suporte)` não foi alterado — `conector` nesse OR é para luminária avulsa (compat UX existente); o novo filtro dedicado `'conector'` é para seleção de componente de sistema composto.

## DB Audit Result (CAT-03 — SKUs semente)

**Auditoria ao vivo não executada neste plano** (executor sem credencial de service role).

Lista-semente derivada do contexto D-08 / 19-CONTEXT.md:

| Codigo | Descricao esperada | tipo_produto esperado | Acao na migration |
|--------|-------------------|----------------------|------------------|
| LM2338 | CONECTOR MAGNETO 48V | null ou errado | → 'conector' |
| LM3168 | CONECTOR TINY 24V | null ou errado | → 'conector' |
| LM3169 | CONECTOR TINY 24V (variante) | null ou errado | → 'conector' |
| LM2987 | KIT FIXACAO | null ou errado | → 'kit_fixacao' |

**ACAO OBRIGATORIA no Plan 03 [BLOCKING] antes de aplicar a migration:**

```sql
SELECT codigo, descricao, tipo_produto, sistema
FROM public.product_variants
WHERE codigo IN ('LM2338','LM3168','LM3169','LM2987')
   OR descricao ILIKE '%CONECTOR%MAGNETIC%'
   OR descricao ILIKE '%CONECTOR%TINY%'
   OR descricao ILIKE '%KIT%FIXA%'
ORDER BY codigo;
```

- SKUs ausentes do DB → não há o que corrigir (remover da lista)
- SKUs já com tipo_produto correto → migration idempotente cobre (`IS DISTINCT FROM`)
- SKUs adicionais da mesma família com tipo_produto divergente → adicionar ao `WHERE codigo IN (...)`

## Deviations from Plan

None - plan executed exactly as written. Auditoria DB deferida ao Plan 03 conforme instrucao explícita do plano ("se a auditoria não puder rodar agora... escrever a migration com a lista-semente").

## Issues Encountered

None.

## User Setup Required

None - migration escrita mas não aplicada. Apply via Plan 03 [BLOCKING] task (service role + migration repair — padrao deste projeto per memory `project_aura_migration_divergence`).

## Next Phase Readiness

- CAT-03 código completo: `useProdutoSearch` aceita `filtro='conector'` e `filtro='kit_fixacao'`
- Migration SQL pronta em `supabase/migrations/20260612000001_cat03_tipo_produto_conector_kit.sql`
- Plan 03 deve: (1) rodar auditoria de SKUs, (2) expandir lista se necessário, (3) aplicar ambas as migrations (19-01 `produto_composicao` + 19-02 CAT-03) via service role
- Phase 20 pode usar `filtro='conector'` e `filtro='kit_fixacao'` no seletor de componentes assim que as migrations forem aplicadas

---
*Phase: 19-funda-o-compostos*
*Completed: 2026-06-12*
