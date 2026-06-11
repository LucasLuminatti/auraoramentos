---
phase: 16-c-lculo-metragem
plan: 01
subsystem: database
tags: [supabase, migration, postgres, passadas_padrao, product_variants]

# Dependency graph
requires:
  - phase: 14
    provides: "Procedimento aprovado de aplicação manual de migration (service role + migration repair, sem db push) por divergência de histórico"
provides:
  - "Migration idempotente 20260611000001_sync_passadas_padrao.sql (sync product_variants.passadas_padrao ← regras_compatibilidade_perfil)"
  - "Confirmação de que os dados de produção já estão sincronizados com as regras (UPDATE = no-op)"
  - "Diagnóstico de divergências de dados que impactam o Plano 02 (light_50 ausente; light_30/12/15 sem regra)"
affects: [16-02, 16-03, passadas, plano-02-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sync de coluna via UPDATE ... FROM regra, idempotente com IS DISTINCT FROM (aditivo, sem DDL)"

key-files:
  created:
    - supabase/migrations/20260611000001_sync_passadas_padrao.sql
  modified: []

key-decisions:
  - "Aplicação via service role (caminho B aprovado) em vez de db push — histórico de migrations diverge do repo"
  - "Aceitar Wave 1 como concluída mesmo com UPDATE no-op: objetivo (passadas em sync com regras) já satisfeito no estado atual do banco (decisão do Lenny)"
  - "Histórico reconciliado via migration repair --status applied 20260611000001 (sem db push)"

patterns-established:
  - "Migration de sync de passadas_padrao: idempotente (IS DISTINCT FROM), aditiva (só UPDATE em product_variants tipo_produto='perfil'), join por familia_perfil"

requirements-completed: [CALC-03]

# Metrics
duration: ~15min
completed: 2026-06-11
---

# Phase 16 / Plano 01: Sync passadas_padrao Summary

**Migration idempotente de sync `product_variants.passadas_padrao` ← `regras_compatibilidade_perfil` criada e aplicada; produção já estava sincronizada (UPDATE no-op), com divergências de dados documentadas para o Plano 02.**

## Performance

- **Duration:** ~15 min (incl. checkpoint manual + investigação de divergência)
- **Completed:** 2026-06-11T17:15Z
- **Tasks:** 2 (Task 1 auto + Task 2 checkpoint:human-action)
- **Files modified:** 1 (migration criada)

## Accomplishments
- Migration `20260611000001_sync_passadas_padrao.sql` criada — idempotente (`IS DISTINCT FROM`), aditiva (apenas `UPDATE` em `product_variants` onde `tipo_produto = 'perfil'`), join por `familia_perfil`.
- Sync aplicado em produção via **service role** (caminho aprovado B — `db push` é inseguro pela divergência de histórico). Resultado: **0 linhas afetadas** — os dados já estavam alinhados com as regras.
- Histórico de migrations reconciliado: `supabase migration repair --status applied 20260611000001` → `applied`.

## Task Commits

1. **Task 1: Escrever a migration de sync passadas_padrao** — `51a84be` (chore)
2. **Task 2: [BLOCKING] Aplicar em produção + reconciliar histórico** — aplicação via service role (sem commit de código; UPDATE no-op) + `migration repair`

## Files Created/Modified
- `supabase/migrations/20260611000001_sync_passadas_padrao.sql` — UPDATE idempotente de sync de `passadas_padrao` por família de perfil.

## Decisions Made
- **Aplicação por service role** em vez de `supabase db push`: o histórico de migrations do projeto diverge do repo; um push re-aplicaria migrations locais já presentes em prod (ex.: `20260602000001`, que recria a view `produtos`) e quebraria `useProdutoSearch`.
- **Wave 1 aceita como concluída apesar do UPDATE no-op** (decisão do Lenny): o objetivo da migration — `passadas_padrao` em sync com as regras — **já está satisfeito** no estado atual do banco. Não havia nada a corrigir.

## Deviations from Plan

### ⚠️ Divergência de dados — premissa do plano contrariada pela produção

O plano assumia que `passadas_padrao` estava no DEFAULT 1 para todas as famílias ("a sync nunca foi feita") e que `light_50` mostraria 1 passada em vez de 3. **Os dados reais de produção contradizem isso:**

**1. `light_50` NÃO existe em `product_variants` (produção).**
Zero linhas com `familia_perfil = 'light_50'` e `tipo_produto = 'perfil'`. O critério de verificação do plano ("SELECT retorna `light_50 → passadas_padrao = 3`") é **impossível de satisfazer** — não há esse dado no catálogo (provavelmente perfis light_50 ainda não foram carregados; bate com a carga de dados incompleta do projeto).

**2. Os dados já estão sincronizados.** Toda família de perfil que tem regra correspondente **já tem `passadas_padrao` correto**:

| familia_perfil | passadas_padrao (prod) | regra | status |
|---|---|---|---|
| light_mini | 1 | 1 | ✓ |
| light_nano_12 | 1 | 1 | ✓ |
| light_nano_30 | 2 | 2 | ✓ |
| no_frame_bilateral | 2 | 2 | ✓ |
| no_frame_unilateral | 1 | 1 | ✓ |

**3. Famílias em produção SEM regra em `regras_compatibilidade_perfil`** (⚠️ impacta o Plano 02 — Select de passadas "restrito por família" não encontrará regra para elas):

| familia_perfil | itens | passadas_padrao atual | regra? |
|---|---|---|---|
| light_30 | 96 | 2 | ❌ ausente |
| light_12 | 61 | 1 | ❌ ausente |
| light_15 | 3 | 1 | ❌ ausente |

**4.** 428 perfis com `familia_perfil = NULL` (todos `passadas_padrao = 1`) — sem família, não casam com nenhuma regra; permanecem 1.

**Impacto no plano:** A migration está correta e idempotente; o objetivo (dados em sync) está atendido. Porém o critério de verificação específico de `light_50` não é verificável. O Plano 02 deve tratar famílias sem regra (`light_30`, `light_12`, `light_15`) — defina o range/fallback de passadas para elas, senão o Select editável ficará sem limite definido por família.

## Issues Encountered
- A premissa de dados do plano estava desatualizada (ver Divergência acima). Investigado via consulta direta com service role; decisão de seguir tomada pelo Lenny com a divergência documentada.

## User Setup Required
None — aplicação manual da migration já realizada (service role + migration repair).

## Next Phase Readiness
- ✅ Pré-requisito de schema/dados do Plano 02 resolvido: `passadas_padrao` em sync com as regras.
- ⚠️ **Para o Plano 02:** tratar famílias sem regra (`light_30`, `light_12`, `light_15`) no Select de passadas editável — definir fallback de range. light_50 não existe no catálogo atual.

---
*Phase: 16-c-lculo-metragem*
*Completed: 2026-06-11*
