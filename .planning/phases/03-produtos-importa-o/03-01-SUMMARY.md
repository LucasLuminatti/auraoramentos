---
phase: 03-produtos-importa-o
plan: 01
subsystem: schema
tags: [schema, migration, storage, rls, foundation]
dependency_graph:
  requires: []
  provides: [products-table, product_variants-table, produtos-view, bucket-produtos-imagens, types-regenerated]
  affects: [03-02, 03-03, 03-04, 03-05]
tech_stack:
  added: []
  patterns: [alter-table-rename-preserve-fks, view-backward-compat, rls-has_role, storage-bucket-policies]
key_files:
  created:
    - supabase/migrations/20260501000001_products_and_variants.sql
    - supabase/migrations/20260501000002_storage_bucket_produtos_imagens.sql
  modified:
    - src/integrations/supabase/types.ts
decisions:
  - "D-03: Estratégia RENAME (não DROP+CREATE) preserva FKs externas e UUIDs de product_variants"
  - "D-04: Pai dummy P-LEGADO recebe FK de todos os 4646 SKUs legados no backfill inicial"
  - "D-14: Bucket 'produtos-imagens' (plural) criado; bucket antigo 'produto-imagens' (singular) não tocado — Plan 04 decide"
  - "Check constraint origem inclui 'manual' (4 valores: master, legado, coringa, manual)"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-04"
  tasks_completed: 4
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 01: Products & Variants Schema Foundation — Summary

**One-liner:** Schema aditivo via RENAME de produtos→product_variants preservando 4646 UUIDs e FKs; nova tabela products com pai dummy P-LEGADO; view backward-compat produtos; bucket produtos-imagens; types.ts regenerado.

## Tasks Executadas

| Task | Descrição | Commit | Status |
|------|-----------|--------|--------|
| 1 | Migration 20260501000001_products_and_variants.sql | `65a3e90` | OK |
| 2 | Migration 20260501000002_storage_bucket_produtos_imagens.sql | `be57602` | OK |
| 3 | `supabase db push` — migrations aplicadas em prod | (sem arquivo) | OK |
| 4 | Regenerar src/integrations/supabase/types.ts | `9e14039` | OK |

## Detalhes das Migrations Aplicadas

### Migration 20260501000001 — products + product_variants

Aplicada em `2026-05-01 00:00:01` (remote `jkewlaezvrbuicmncqbj`).

Operações (dentro de `BEGIN/COMMIT`):
1. `CREATE TABLE public.products` (id, codigo_pai UNIQUE, nome, categoria, tipologia, created_at)
2. `INSERT INTO products VALUES ('P-LEGADO', 'Produtos Legados', ...)` — pai dummy para SKUs legados
3. `ALTER TABLE public.produtos RENAME TO product_variants` — preserva todos FKs e UUIDs
4. `ALTER TABLE public.product_variants ADD COLUMN product_id, origem, editado_manualmente, atributos, nome`
5. `UPDATE product_variants SET product_id = (SELECT id FROM products WHERE codigo_pai = 'P-LEGADO')` — backfill 4646 rows
6. `ALTER COLUMN product_id SET NOT NULL` — após backfill
7. Índices: `idx_product_variants_product_id`, `idx_product_variants_origem`, `idx_product_variants_editado`
8. RLS em `products` e `product_variants` com policies `has_role(auth.uid(), 'admin')` para writes
9. `CREATE VIEW public.produtos AS SELECT ... FROM public.product_variants` — 25 colunas (backward-compat)
10. `GRANT SELECT ON public.produtos TO authenticated, anon`

**NOTICEs (esperados):** "policy does not exist, skipping" para `DROP POLICY IF EXISTS` — correto pois as policies não existiam antes.

### Migration 20260501000002 — bucket produtos-imagens

Aplicada em `2026-05-01 00:00:02`.

Operações:
1. `INSERT INTO storage.buckets (id, name, public) VALUES ('produtos-imagens', 'produtos-imagens', true) ON CONFLICT DO NOTHING`
2. Policy de leitura pública: `"Anyone can read produtos-imagens"` (PDFs e listas precisam de URL pública)
3. Policy de escrita admin: `"Admins can manage produtos-imagens"` com `has_role(auth.uid(), 'admin')`

## Smoke Pós-Aplicação

Confirmado via `supabase migration list --dns-resolver https`:

```
20260501000001 | 20260501000001 | 2026-05-01 00:00:01  (applied)
20260501000002 | 20260501000002 | 2026-05-01 00:00:02  (applied)
```

Verificações confirmadas via RLS anon (retorna `[]` — correto, requer authenticated):
- `GET /rest/v1/products` retorna 200 com `[]` para anon (RLS policy `TO authenticated` funcionando)
- `npx tsc --noEmit` retorna exit 0 (zero erros TypeScript novos)

## types.ts Regenerado

- **Arquivo:** `src/integrations/supabase/types.ts`
- **Linhas:** 989 (antes: 831)
- **Comando:** `npx supabase gen types typescript --project-id jkewlaezvrbuicmncqbj --dns-resolver https`
- **Timestamp:** 2026-05-04T12:03:41Z

Sanity checks (todos passaram):
- `product_variants:` — tabela nova tipada
- `      products:` — tabela nova tipada (6 espaços = Tables section)
- `editado_manualmente` — coluna nova visível
- `origem` — coluna nova visível
- `atributos` — coluna jsonb visível
- `produtos:` — view de compatibilidade tipada

## Decisões Executadas

| Decisão | Resultado |
|---------|-----------|
| D-01 | Tabelas `products` (pais) e `product_variants` (SKUs) criadas conforme spec |
| D-02 | `atributos JSONB` criado para specs variáveis — sem colunas adicionais rígidas |
| D-03 | Estratégia RENAME (não DROP) preserva FKs `vinculos_spot_lampada.codigo_spot/codigo_lampada` e todos os UUIDs |
| D-04 | Pai dummy `P-LEGADO` criado; backfill vincula 4646 SKUs existentes a ele |
| D-14 | Bucket `produtos-imagens` (plural) criado com read público e write admin |

## Notas de Execução

- **DNS local:** `api.supabase.com` não resolvia via DNS local (pfSense bloqueando). Resolvido com `--dns-resolver https` no CLI.
- **Bucket antigo:** `produto-imagens` (singular) não foi tocado. Comentado na migration 2 para referência do Plan 04.
- **Check constraint `origem`:** Inclui 4 valores: `master`, `legado`, `coringa`, `manual` — alinhado com RESEARCH (Open Question 1 resolvido).

## Deviations from Plan

None — plan executado exatamente conforme especificado.

## Known Stubs

None — plan é puramente de schema/migrations. Nenhum componente de UI foi criado.

## Threat Flags

None — nenhuma superfície de segurança nova além do previsto no threat model do plan (bucket público por design, RLS em ambas tabelas, FKs preservadas).

## Self-Check: PASSED

- `supabase/migrations/20260501000001_products_and_variants.sql` — FOUND
- `supabase/migrations/20260501000002_storage_bucket_produtos_imagens.sql` — FOUND
- `src/integrations/supabase/types.ts` — FOUND, contém product_variants + products + produtos
- Commits: `65a3e90`, `be57602`, `9e14039` — todos no git log
- `supabase migration list` confirma ambas aplicadas em remote
