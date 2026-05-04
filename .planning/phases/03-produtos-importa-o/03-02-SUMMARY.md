---
phase: 03-produtos-importa-o
plan: 02
subsystem: reconciliation
tags: [seed, reconciliation, pure-functions, tests, au-coringa]
dependency_graph:
  requires: [03-01]
  provides: [au-coringa-seeded, reconcile-function, product-attribute-parsers]
  affects: [03-03, 03-04, 03-05]
tech_stack:
  added: []
  patterns: [pure-functions, vitest-tdd, sql-idempotent-seed]
key_files:
  created:
    - supabase/migrations/20260501000003_seed_au_coringa.sql
    - src/lib/productAttributes.ts
    - src/lib/productAttributes.test.ts
    - src/lib/reconcileProducts.ts
    - src/lib/reconcileProducts.test.ts
  modified: []
decisions:
  - "D-10: AU coringa com editado_manualmente=true desde o seed — master subsequente nunca sobrescreve"
  - "D-05 invariante: patch do reconcile() NUNCA inclui arquiteto_id, preco_tabela, preco_minimo, editado_manualmente — garantido por test"
  - "D-10 precedência: origem='coringa' checado antes de editado_manualmente na lógica de reconcile()"
  - "Pureza: reconcile() e productAttributes parsers sem imports de supabase/fetch — testáveis sem mock"
metrics:
  duration_minutes: 20
  completed_date: "2026-05-04"
  tasks_completed: 3
  files_created: 5
  files_modified: 0
---

# Phase 3 Plan 02: AU Coringa Seed + Funções Puras de Reconciliação — Summary

**One-liner:** 16 AU coringa seedados em prod (origem='coringa', editado_manualmente=true) via migration SQL; parsers puros parseTensao/parsePotencia/mapMasterRow; função reconcile() implementando D-05..D-10 com invariante de preço/arquiteto garantido por teste — 37 testes passando.

## Tasks Executadas

| Task | Descrição | Commit | Status |
|------|-----------|--------|--------|
| 1 | Migration 20260501000003_seed_au_coringa.sql + supabase db push | `5cbcd5f` | OK |
| 2 | src/lib/productAttributes.ts + productAttributes.test.ts (24 tests) | `d761171` | OK |
| 3 | src/lib/reconcileProducts.ts + reconcileProducts.test.ts (12 tests) | `c5ba961` | OK |

## Migration Aplicada

### 20260501000003_seed_au_coringa.sql

Aplicada em `2026-05-01 00:00:03` (remote `jkewlaezvrbuicmncqbj`).

Confirmada via `npx supabase migration list --dns-resolver https`:
```
20260501000003 | 20260501000003 | 2026-05-01 00:00:03  (applied)
```

Operações:
1. `INSERT INTO public.products (codigo_pai, nome, categoria, tipologia)` — 16 pais P-AU001..P-AU016 com categoria='AU Coringa'
2. `INSERT INTO public.product_variants (codigo, descricao, nome, product_id, origem, editado_manualmente, ...)` — 16 variants AU001..AU016 com `origem='coringa'`, `editado_manualmente=true`, `preco_tabela=0`, `preco_minimo=0`, `imagem_url=NULL`
3. `ON CONFLICT (codigo_pai) DO NOTHING` em products (idempotente)
4. `ON CONFLICT (codigo) DO UPDATE SET ... origem = 'coringa', editado_manualmente = true` em product_variants (promove legado AU→coringa se existir — D-13)

### Lista das 16 AU Criadas (D-11 ipsis litteris)

| SKU | Descrição |
|-----|-----------|
| AU001 | Drivers |
| AU002 | Plug para Fita LED |
| AU003 | Amplificador e Controlador Fita LED |
| AU004 | Fita LED |
| AU005 | Lâmpadas LED |
| AU006 | Luminárias |
| AU007 | Luminárias decorativas sem LED integrado |
| AU008 | Luminárias de mesa |
| AU009 | Luminárias de mesa sem LED integrado |
| AU010 | Projetores, Embutidos e Espelhos |
| AU011 | Partes Luminárias Decorativas Vidro - Teto |
| AU012 | Partes Luminárias Decorativas Vidro - Outros |
| AU013 | Partes Luminárias Decorativas Plástico - Teto |
| AU014 | Partes Luminárias Decorativas Plástico - Outros |
| AU015 | Partes Luminárias Decorativas Outros - Teto |
| AU016 | Partes Luminárias Decorativas Outros - Outros |

## Funções Puras Criadas

### src/lib/productAttributes.ts

Exports: `parseTensao`, `parsePotencia`, `mapMasterRow`, `MasterVariantRow`

- **parseTensao**: extrai 12/24/48 de strings "NNV DC"; null para não-DC (ex: 127V/220V, 250V, 36V DC)
- **parsePotencia**: extrai watts de "10W/m", "5W", "38W", "2,5W" (aceita vírgula como decimal)
- **mapMasterRow**: separa typed cols (tensao, watts_por_metro para Fita LED, potencia_watts para outros) de atributos jsonb; implementa Pitfall 4 (tensao_raw sempre preservada em atributos mesmo quando parseTensao retorna null)

### src/lib/reconcileProducts.ts

Exports: `reconcile`, `DbVariantRow`, `Origem`, `ReconcileReport`, `ReconcileUpdate`, `ReconcileSkipped`, `SkippedReason`

- **reconcile(master, db)**: O(n+m) com Map lookup; produz 4 buckets:
  - `creates`: SKUs só na master (D-07)
  - `updates`: SKUs em ambos, não editados, não coringa (D-05)
  - `skipped`: editado_manualmente (D-08) ou origem_coringa (D-10)
  - `legados_preserved`: SKUs só no DB (D-06)

## Cobertura de Testes por Regra

**Total: 37 testes passando (24 productAttributes + 12 reconcileProducts + 1 example.test.ts)**

| Regra | Tests | Descrição |
|-------|-------|-----------|
| D-02 (atributos jsonb) | 3 | mapMasterRow preserva lumens, IRC, outros em atributos |
| D-05 (master sobrescreve unedited) | 2 | SKU em ambos → update; patch contém nome/atributos/typed |
| **D-05 INVARIANTE** | 1 | patch NUNCA inclui arquiteto_id/preco_tabela/preco_minimo/editado_manualmente |
| D-06 (legado preservado) | 2 | SKU só no DB → legados_preserved |
| D-07 (master cria novo) | 2 | SKU só na master → creates |
| D-08 (editado_manualmente skipped) | 1 | editado_manualmente=true → reason='editado_manualmente' |
| D-10 (coringa skipped) | 2 | origem='coringa' → reason='origem_coringa'; precedência sobre editado_manualmente |
| Pitfall 4 (tensao_raw) | 2 | tensao_raw em atributos mesmo com parseTensao=null |
| Cenário misto | 1 | 1 create + 1 update + 1 skipped + 1 legado |
| Edge cases | 3 | empty/empty, empty db, empty master |
| parseTensao | 11 | 12/24/48 DC, 24VDC sem espaço, null para não-DC, 36V DC fora da lista, null/undefined/empty |
| parsePotencia | 8 | 10W/m, 5W, 38W, 2,5W, 2.5W, null/empty/abc |

## Decisões Executadas

| Decisão | Resultado |
|---------|-----------|
| D-09 | PROD-02 obsoleto (DB não tinha produtos sem descrição — verificado no CONTEXT) |
| D-10 | 16 AU coringa criados com `editado_manualmente=true` no seed; reconcile() checa origem='coringa' antes de tudo |
| D-11 | Lista D-11 copiada ipsis litteris (16 descrições com acentos: "Lâmpadas", "Luminárias", "Plástico") |
| D-12 | AU001..16 na view `produtos` (backward-compat) → aparecem no autocomplete do orçamento |
| D-13 | `ON CONFLICT DO UPDATE` promove legado AU para coringa; admin pode editar normalmente via ProdutoEditDialog |

## Invariante D-05 — Verificação

O test "D-05 INVARIANT: patch NEVER includes arquiteto_id, preco_tabela, preco_minimo, editado_manualmente" (reconcileProducts.test.ts linha 61) verifica explicitamente:

```typescript
expect("arquiteto_id" in patch).toBe(false);
expect("preco_tabela" in patch).toBe(false);
expect("preco_minimo" in patch).toBe(false);
expect("editado_manualmente" in patch).toBe(false);
```

Se esse teste quebrar, o build CI falha — garantia estrutural do invariante.

## Pureza das Funções

Verificado com `grep -E "^import.*supabase|fetch\(" src/lib/reconcileProducts.ts src/lib/productAttributes.ts` → 0 matches.

Apenas comentário em bloco doc menciona "supabase" como referência — não como import.

## Deviations from Plan

None — plano executado exatamente conforme especificado. Todos os 3 arquivos de source + 2 de test criados verbatim do plan. Migration SQL aplicada com sucesso. 37 testes passando (> 35 exigidos).

## Known Stubs

None — plano não cria UI. Funções são puras e completas. Migration seed é completa.

## Threat Flags

None — ameaças previstas no threat model do plan (T-03-11..T-03-16) foram mitigadas conforme especificado:
- T-03-11: invariante D-05 coberto por test explícito
- T-03-12: mapMasterRow tolera null/undefined/missing fields (test "returns sensible defaults")
- T-03-14: migration versionada em git com comentários D-09..D-13

## Self-Check: PASSED

Arquivos verificados:
- `supabase/migrations/20260501000003_seed_au_coringa.sql` — FOUND
- `src/lib/productAttributes.ts` — FOUND, exports parseTensao + parsePotencia + mapMasterRow
- `src/lib/productAttributes.test.ts` — FOUND, 24 tests passando
- `src/lib/reconcileProducts.ts` — FOUND, exports reconcile + interfaces
- `src/lib/reconcileProducts.test.ts` — FOUND, 12 tests passando

Commits verificados:
- `5cbcd5f` feat(03-02): migration seed 16 AU coringa — FOUND
- `d761171` feat(03-02): parsers puros productAttributes — FOUND
- `c5ba961` feat(03-02): função pura reconcile() — FOUND

Migration aplicada:
- `20260501000003 | 20260501000003 | 2026-05-01 00:00:03` — confirmed via `supabase migration list`

Suite completa: 37/37 tests passing, `npx tsc --noEmit` exit 0
