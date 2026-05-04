---
phase: 03-produtos-importa-o
plan: 04
subsystem: import-ui
tags: [import, master, csv, preview, bulk-image, edge-fn, xlsx, product_variants]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides: [ImportMaster, ImportProdutos-refatorado, ImportImagens-migrado, admin-4-subtabs, parseMasterXlsx, downloadProdutosTemplate, edge-fn-product-variants]
  affects: [03-05]
tech_stack:
  added: []
  patterns: [phase-machine-idle-parsing-preview-applying-done, classify-create-update-preview, batch-insert-fallback-per-item, pure-parser-xlsx]
key_files:
  created:
    - src/lib/parseMasterXlsx.ts
    - src/lib/parseMasterXlsx.test.ts
    - src/lib/downloadProdutosTemplate.ts
    - src/components/ImportMaster.tsx
  modified:
    - src/components/ImportProdutos.tsx
    - src/components/ImportMapper.tsx
    - src/components/ImportImagens.tsx
    - src/pages/Admin.tsx
    - supabase/functions/import-produtos/index.ts
decisions:
  - "D-21: IMP-01/03/04/05/06 implementados — importação CSV diário funcional com preview create/update"
  - "D-22: IMP-02 (preço) NÃO importado — sub-tab Preços mostra explicação D-18 (deferido)"
  - "D-23: Master (XLSX) vira sub-tab dedicada separada do CSV diário"
  - "D-14: bucket plural produtos-imagens confirmado em todos os pontos (zero referências ao singular)"
  - "D-05 invariante propagado para CSV diário: UPDATE patch não inclui preco_tabela/preco_minimo/arquiteto_id/editado_manualmente"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-30"
  tasks_completed: 6
  files_created: 4
  files_modified: 5
---

# Phase 3 Plan 04: ImportMaster + ImportProdutos refatorado + 4 sub-tabs — Summary

**One-liner:** Aba Importação do Admin ganha 4 sub-tabs (Master one-shot, Produtos CSV, Imagens, Preços desabilitado); parseMasterXlsx puro com 7 testes; ImportMaster aplica reconcile() com preview create/update/skipped + erros linha-a-linha; edge fn migrada para product_variants respeitando D-05 invariante.

## Tasks Executadas

| Task | Descrição | Commit | Status |
|------|-----------|--------|--------|
| 1 | parseMasterXlsx.ts + parseMasterXlsx.test.ts (7 tests) | `67a7a2d` | OK |
| 2 | downloadProdutosTemplate.ts (IMP-04) | `26f93e8` | OK |
| 3 | ImportMaster.tsx (one-shot, ~369 linhas) | `892d896` | OK |
| 4 | ImportImagens.tsx migrado: fetchAllCodigos → product_variants | `89d5cf9` | OK |
| 5 | ImportProdutos.tsx reescrito + ImportMapper.tsx (classifyRows) + edge fn refatorada + deploy | `dac57c3` | OK |
| 6 | Admin.tsx — 4 sub-tabs (Master/Produtos/Imagens/Preços) | `0449a3e` | OK |

## Detalhes por Arquivo

### src/lib/parseMasterXlsx.ts (novo)

- Função pura `parseMasterXlsx(buffer: ArrayBuffer): ParsedMaster`
- Lê aba "Variantes" (obrigatória) ou fallback "Base Completa (flat)"
- Lê aba "Produtos" (opcional) para enriquecer nomes dos pais
- Filtra SKUs vazios, deduplica products por produto_id
- Integra `mapMasterRow` do Plan 02 em cada variante
- Lança `ParseMasterError` com codes: MISSING_SHEET, EMPTY_SHEET, PARSE_FAILED
- **Pura**: zero imports supabase/fetch — testável sem mock

### src/lib/parseMasterXlsx.test.ts (novo)

7 testes passando:
- parses workbook with Variantes + Produtos sheets
- falls back to Base Completa (flat) when Variantes is missing
- throws ParseMasterError MISSING_SHEET when no Variantes/Base Completa
- throws EMPTY_SHEET when Variantes is empty
- filters out variants with empty SKU
- derives products from variants when Produtos sheet is absent
- dedupes products by produto_id

### src/lib/downloadProdutosTemplate.ts (novo)

- Função `downloadProdutosTemplate()` — IMP-04
- Gera template-produtos.xlsx com 2 abas: "Produtos" (1 linha exemplo) e "Instruções" (13 linhas)
- preco_tabela/preco_minimo marcados como "DEFERIDO" (D-18)
- imagem_url documentada como aceitar URL ou nome de arquivo (IMP-03)

### src/components/ImportMaster.tsx (novo, 369 linhas)

- Phase machine: idle → parsing → preview → applying → done
- `fetchAllDbVariants()`: paginação 1000 rows por query (evita timeout)
- `ensureProducts()`: upsert products com `onConflict: "codigo_pai"` (idempotente)
- `apply()`: INSERT em batches de 500 com fallback item-a-item (IMP-06)
- UPDATE de reconcile.updates um por um (patches distintos por SKU)
- Preview com 3 contadores: criar / atualizar / skipped (IMP-05)
- Skipped expandido mostra razão: editado_manualmente (D-08) vs origem_coringa (D-10)
- Erros exportáveis via "Baixar XLSX de erros"
- D-05 invariante: reconcile() garante que patch nunca inclui preço/arquiteto

### src/components/ImportImagens.tsx (modificado)

- `fetchAllCodigos()` migrado de `from("produtos")` para `from("product_variants")`
- Bucket e UPDATE já estavam corretos desde Plan 03 (c7038f9)
- Agora todos os 3 pontos de acesso à base usam a tabela direta

### src/components/ImportProdutos.tsx (reescrito)

- Fields renovados: remove campos legados (wm, voltagem, passadas, familia_perfil, etc.)
- Adiciona campo `imagem_url` (IMP-03)
- Remove `preco_tabela` e `preco_minimo` dos fields (D-18)
- Botão "Baixar template" chama `downloadProdutosTemplate()` (IMP-04)
- `classifyRows()` faz SELECT por página de 100 SKUs e retorna Map<codigo, 'create' | 'update'>
- Passa `classifyRows` para `ImportMapper` (IMP-05)
- Toast mostra `${inserted} criados, ${updated} atualizados` (contadores reais)

### src/components/ImportMapper.tsx (modificado)

- `import { useState, useRef, useEffect }` — adicionado useEffect
- Interface `ImportMapperProps` ganha prop opcional `classifyRows?`
- State: `classification` + `classifying` adicionados
- useEffect dispara classificação quando allRequiredMapped + rawRows + !importResult
- 3 contadores no preview: Criar / Atualizar / Erros (IMP-05)
- Contadores são condicionais: só renderizam se `classifyRows` prop fornecida

### supabase/functions/import-produtos/index.ts (reescrito + deployed)

**Antes:** UPSERT cego em `produtos` (view — quebrava após Plan 01)

**Depois:**
- Resolve P-LEGADO UUID uma vez
- SELECT prévio para distinguir creates vs updates
- CREATE: insere em `product_variants` com `product_id=legadoId`, `origem='manual'`, `editado_manualmente=false`
- UPDATE: patch explícito (descricao, nome, tensao, watts_por_metro, potencia_watts, cor, imagem_url) — **NÃO inclui** preco_tabela, preco_minimo, arquiteto_id, editado_manualmente (D-05 invariante comentado no código)
- Fallback per-item em batch INSERT (IMP-06)
- Retorna `{ inserted, updated, failed[] }` — UI mostra contadores reais
- Deployada via `npx supabase functions deploy --project-ref jkewlaezvrbuicmncqbj`

### src/pages/Admin.tsx (modificado)

- Import `ImportMaster` adicionado; `ImportPrecos` removido (substituído por Card inline)
- `importSubTab` tipo atualizado: `"master" | "produtos" | "imagens" | "precos"`
- Default value: `"master"` (one-shot aparece primeiro)
- Array `importSubTabs` com 4 entries
- Renderização condicional cobre os 4 sub-tabs
- Sub-tab "precos": Card com "Indisponível neste marco" + explicação D-18
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` adicionados ao import

## Invariantes Verificados

| Invariante | Verificação |
|-----------|-------------|
| D-05 (preço/arquiteto intocados na master) | reconcile() (Plan 02 test explícito) garante; ImportMaster usa o patch do reconcile diretamente |
| D-05 propagado para CSV diário | edge fn UPDATE patch construído explicitamente sem preco_tabela/preco_minimo/arquiteto_id/editado_manualmente; comentário no código |
| D-14 bucket plural | `! grep -qE 'from("produto-imagens")' src/` → 0 matches confirmado |
| D-10 AU coringa | reconcile() coloca AU em skipped (origin_coringa) — test existente no Plan 02 garante |
| IMP-06 erros linha-a-linha | Batch INSERT falha → fallback per-item em ImportMaster E edge fn; ImportMapper expõe XLSX de erros |

## Deviations from Plan

None — plano executado exatamente conforme especificado.

### Observação Task 4

ImportImagens.tsx já tinha bucket plural e UPDATE em product_variants desde o commit `c7038f9` do Plan 03 (desvio Rule 1 aplicado lá). Neste Plan 04, apenas a linha do `fetchAllCodigos` (SELECT em `from("produtos")`) precisava migrar para `from("product_variants")`. Mudança cirúrgica de 1 linha aplicada.

## Lint Count

- **Antes do Plan 04:** 51 problemas (40 errors, 11 warnings)
- **Depois do Plan 04:** 50 problemas (39 errors, 11 warnings) — 1 problema a menos (remoção do import não-usado `ImportPrecos`)

## Known Stubs

None — todos os fluxos conectados a tabelas reais. parseMasterXlsx é puro (sem IO). ImportMaster busca DB real. Edge fn acessa product_variants real.

## Threat Flags

None — superfícies de segurança exatamente conforme o threat model do plan:
- T-03-27: edge fn UPDATE patch sem preço/arquiteto (D-05 invariante) — mitigado conforme spec
- T-03-28: AU coringa preservados via reconcile() — mitigado via test Plan 02
- T-03-30: edge fn não loga rows, apenas mensagens curtas em catch — mitigado
- T-03-33: AdminRoute protege /admin; RLS em product_variants/products — mitigado

## Self-Check: PASSED

Arquivos verificados:
- `src/lib/parseMasterXlsx.ts` — FOUND, exports parseMasterXlsx + ParsedMaster + ParsedMasterProduct + ParseMasterError
- `src/lib/parseMasterXlsx.test.ts` — FOUND, 7 tests passando
- `src/lib/downloadProdutosTemplate.ts` — FOUND, export downloadProdutosTemplate, contém DEFERIDO + imagem_url
- `src/components/ImportMaster.tsx` — FOUND, 369 linhas, contém parseMasterXlsx + reconcile + product_variants + onConflict:codigo_pai + BATCH_SIZE
- `src/components/ImportProdutos.tsx` — FOUND, contém downloadProdutosTemplate + imagem_url + classifyRows
- `src/components/ImportMapper.tsx` — FOUND, contém classifyRows? prop + useEffect + 3 contadores Criar/Atualizar/Erros
- `src/components/ImportImagens.tsx` — FOUND, bucket plural + product_variants em todos os 3 pontos
- `src/pages/Admin.tsx` — FOUND, ImportMaster importado, tipo master|produtos|imagens|precos, default "master", 4 sub-tabs
- `supabase/functions/import-produtos/index.ts` — FOUND, product_variants, P-LEGADO, sem from("produtos").upsert

Commits verificados:
- `67a7a2d` feat(03-04): parseMasterXlsx — FOUND
- `26f93e8` feat(03-04): downloadProdutosTemplate — FOUND
- `892d896` feat(03-04): ImportMaster — FOUND
- `89d5cf9` fix(03-04): ImportImagens fetchAllCodigos — FOUND
- `dac57c3` feat(03-04): ImportProdutos + ImportMapper + edge fn — FOUND
- `0449a3e` feat(03-04): Admin.tsx 4 sub-tabs — FOUND

Suite completa: 44/44 tests passing, `npx tsc --noEmit` exit 0, `npm run build` exit 0 (✓ built)
Edge fn deployada: `supabase functions deploy import-produtos` sucesso
Lint: 50 problemas (sem novos erros; 1 a menos por remoção de import não-usado)
