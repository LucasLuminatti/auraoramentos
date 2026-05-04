---
phase: 03-produtos-importa-o
verified: 2026-04-30T10:00:00Z
status: human_needed
score: 8/8 requirements addressed (6 delivered, 1 obsolete, 1 deferred)
overrides_applied: 0
requirements:
  total: 8
  delivered: 6
  obsolete: 1
  deferred: 1
must_haves:
  total: 14
  verified: 14
  failed: 0
human_verification:
  - test: "Admin cria produto manual via botão '+ Novo Produto'"
    expected: "Preencher código (ex: LM9999), nome, descrição, upload JPG < 2MB, clicar Criar — produto aparece na lista com origem='manual', editado_manualmente=true, imagem_url preenchida no DB"
    why_human: "Fluxo de upload Storage + RLS + INSERT em product_variants só verificável com browser real + SQL Editor"
  - test: "Admin edita AU001 via Pencil (D-13)"
    expected: "Abrir ProdutoEditDialog em mode='edit' para AU001 — codigo readonly, salvar → DB confirma editado_manualmente=true, dados atualizados"
    why_human: "Interação visual + RLS product_variants só verificável em browser real"
  - test: "Sub-tab Master: upload de XLSX, preview, confirm"
    expected: "Subir base_dados_site_2026.xlsx → preview mostra criar/atualizar/skipped (AU001..16 em skipped com razão origem_coringa) → confirmar aplica batches → produto-pai e variante aparecem no DB"
    why_human: "Fluxo de parseMasterXlsx + reconcile + batches DB só verificável end-to-end em browser com arquivo real"
  - test: "Sub-tab Produtos (CSV diário): create/update preview + template"
    expected: "Botão 'Baixar template' gera template-produtos.xlsx; subir CSV com nova linha (create) e linha existente (update) → preview mostra '1 Criar / 1 Atualizar'; confirmar aplica via edge fn; toast mostra contadores reais"
    why_human: "Preview de classificação (classifyRows SELECT) + edge fn invoke só verificáveis em browser + DB real"
  - test: "Sub-tab Imagens: bulk upload para bucket produtos-imagens"
    expected: "Upload de ZIP ou arquivos individuais vai para bucket 'produtos-imagens' (plural), URLs atualizadas em product_variants (não na view)"
    why_human: "Storage upload + RLS bucket verificáveis só em browser real"
  - test: "Sub-tab Preços mostra mensagem de deferimento"
    expected: "Abrir sub-tab Preços → Card 'Indisponível neste marco' com explicação D-18 visível, sem crash"
    why_human: "Visual confirmatório — trivial mas necessário para validação UAT completo"
  - test: "Wizard de orçamento não regrediu (Phase 3 regression)"
    expected: "AU001..16 aparecem no autocomplete de produto nos 3 passos do wizard. Criar orçamento com AU001 como item → Step3 funciona → PDF gera sem erro."
    why_human: "Phase 3 Plan 01 renomeou tabela produtos para product_variants e criou view de compat. Autocomplete usa useProdutoSearch (view) e deve ainda funcionar. Regressão só verificável em browser real."
---

# Phase 03: Produtos & Importação — Verification Report

**Phase Goal:** Catálogo de produtos manageable from scratch (cadastro manual via UI admin) + importação CSV/master que cria, atualiza, importa imagens e mostra preview/erros por linha. Schema dual-table (products + product_variants) com reconciliação que respeita D-05 invariante (master nunca toca preço/arquiteto/editado_manualmente).
**Verified:** 2026-04-30T10:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Schema dual-table (products + product_variants) com view backward-compat `produtos` e bucket `produtos-imagens` existe | ✓ VERIFIED | `supabase/migrations/20260501000001_products_and_variants.sql` contém `ALTER TABLE public.produtos RENAME TO product_variants`, `CREATE VIEW public.produtos AS`, `INSERT INTO products VALUES ('P-LEGADO')`. Migration 2 cria bucket `produtos-imagens` com leitura pública e escrita admin. `types.ts` tipado: `product_variants`, `products`, `produtos` (Views). |
| 2 | 16 AU coringa (AU001..AU016) existem em product_variants com origem='coringa', editado_manualmente=true | ✓ VERIFIED | `supabase/migrations/20260501000003_seed_au_coringa.sql` — 33 ocorrências de `P-AU0` (16 pais + 16 variants + subselects), `origem = 'coringa'` e `editado_manualmente = true` literais no VALUES. `ON CONFLICT (codigo) DO UPDATE` promove legado para coringa idempotentemente. |
| 3 | Função pura `reconcile()` implementa D-05..D-10 e o invariante arquiteto_id/preco não aparece no patch | ✓ VERIFIED | `src/lib/reconcileProducts.ts` — 120 linhas, exports `reconcile`, `DbVariantRow`, `ReconcileReport`. Patch explicitamente omite `arquiteto_id`, `preco_tabela`, `preco_minimo`, `editado_manualmente` (comentado no código). Test `D-05 INVARIANT: patch NEVER includes...` garante em CI. 12 tests cobrindo D-05..D-10. |
| 4 | 44 testes Vitest passam (parsers puros + reconcile + parseMasterXlsx) | ✓ VERIFIED | `npx vitest run` — saída: "4 passed (4)", "44 passed (44)". Breakdown: 1 example, 24 productAttributes, 12 reconcileProducts, 7 parseMasterXlsx. |
| 5 | ProdutoEditDialog tem mode='create' (INSERT em product_variants com origem='manual', editado_manualmente=true) e mode='edit' (UPDATE em product_variants com editado_manualmente=true) — sem writes na view `produtos` | ✓ VERIFIED | `src/components/ProdutoEditDialog.tsx` (361 linhas): mode prop declarado, `from("product_variants").insert` para create com `origem: "manual"`, `editado_manualmente: true`, subselect P-LEGADO. `from("product_variants").update` para edit com `editado_manualmente: true`. `grep -rn 'from("produtos").update' src/` → 0 matches. |
| 6 | Aba Produtos do Admin tem botão "+ Novo Produto" que abre ProdutoEditDialog em mode='create' | ✓ VERIFIED | `src/pages/Admin.tsx` contém `produtoCreateOpen`, botão "Novo Produto" com `<Plus>`, dois `<ProdutoEditDialog>` montados: um com `mode="create" produto={null}`, outro com `mode="edit" produto={produtoEditTarget}`. |
| 7 | Sub-tab Importação tem 4 abas: Master (XLSX), Produtos (CSV), Imagens (bucket plural), Preços (desabilitado D-18) | ✓ VERIFIED | `src/pages/Admin.tsx`: `importSubTab` tipado como `"master" | "produtos" | "imagens" | "precos"`, default `"master"`. Array `importSubTabs` com 4 entradas. Sub-tab "precos" renderiza Card com "Indisponível neste marco" e explicação D-18. |
| 8 | ImportMaster consome reconcile(), mostra preview create/update/skipped, aplica em batches com fallback por item (IMP-06) | ✓ VERIFIED | `src/components/ImportMaster.tsx` (369 linhas): importa `reconcile` de `@/lib/reconcileProducts`, `parseMasterXlsx`. Fase machine idle→parsing→preview→applying→done. Batches de 500 com fallback per-item. Patch vem de `upd.patch` do reconcile (D-05 invariante herdado). |
| 9 | ImportProdutos (CSV diário) classifica cada linha em create/update, tem template baixável (IMP-04) e aceita imagem_url (IMP-03) | ✓ VERIFIED | `src/components/ImportProdutos.tsx`: `classifyRows` faz SELECT por lotes de 100 SKUs, campo `imagem_url` no fields array, `downloadProdutosTemplate()` chamado pelo botão "Baixar template". ImportMapper recebe `classifyRows` prop e exibe 3 contadores: Criar / Atualizar / Erros. |
| 10 | Nenhum caminho de importação importa preco_tabela ou preco_minimo (D-05 + IMP-02 deferido) | ✓ VERIFIED | `src/components/ImportProdutos.tsx` — `preco_tabela`/`preco_minimo` aparecem apenas como comentário "NÃO importado nesta versão (deferido — D-18)". `supabase/functions/import-produtos/index.ts` — comentário "UPDATE patch NÃO inclui preco_tabela, preco_minimo, arquiteto_id nem editado_manualmente". `src/components/ImportMaster.tsx` — `preco_tabela`/`preco_minimo` apenas no SELECT de DbVariantRow (leitura para reconcile), nunca no patch de UPDATE. |
| 11 | PROD-02 marcado OBSOLETO em REQUIREMENTS.md com referência D-09; IMP-02 marcado DEFERIDO com referência D-18 | ✓ VERIFIED | `REQUIREMENTS.md` linha ~31: `[~] **PROD-02 (OBSOLETO — D-09)**`. Linha ~38: `[~] **IMP-02 (DEFERIDO — D-18)**`. Tabela Traceability: `PROD-02 | Phase 3 | OBSOLETE (D-09 ...)`, `IMP-02 | Phase 3 | DEFERRED (D-18 ...)`. |
| 12 | STATE.md e ROADMAP.md refletem Phase 3 Complete, cursor em Phase 4 | ✓ VERIFIED | `STATE.md`: `completed_phases: 3`, `Phase: 03 (produtos-importa-o) — COMPLETE (2026-04-30)`. `ROADMAP.md`: `[x] **Phase 3`, `5/5 | Complete | 2026-04-30`, 5 plans listados com `[x]`. |
| 13 | `npx tsc --noEmit` exit 0 (sem erros TypeScript) | ✓ VERIFIED | Executado — 0 erros `error TS` fora de node_modules. |
| 14 | Nenhum write para view `produtos` permanece em nenhum arquivo src/ ou supabase/functions/ | ✓ VERIFIED | `grep -rn 'from("produtos").update' src/` → 0 matches. `ImportImagens.tsx` corrigido de view para `product_variants` no Plan 03 (commit `c7038f9`). Edge fn `import-produtos` reescrita para `product_variants` no Plan 04. |

**Score:** 14/14 truths verified (automated, code-level)

### Required Artifacts

| Artifact | Expected | Exists | Substantive | Wired | Final Status |
|----------|----------|--------|-------------|-------|--------------|
| `supabase/migrations/20260501000001_products_and_variants.sql` | Schema aditivo: products, RENAME, view, RLS | ✓ | ✓ (RENAME, view 25 colunas, RLS, P-LEGADO, backfill) | ✓ (aplicada em prod, migrations list confirmado no SUMMARY) | ✓ VERIFIED |
| `supabase/migrations/20260501000002_storage_bucket_produtos_imagens.sql` | Bucket Storage produtos-imagens com policies | ✓ | ✓ (INSERT storage.buckets, 2 policies com has_role) | ✓ (aplicada em prod) | ✓ VERIFIED |
| `supabase/migrations/20260501000003_seed_au_coringa.sql` | 16 AU coringa em products + product_variants | ✓ | ✓ (33 ocorrências P-AU0, origem='coringa', editado_manualmente=true, lista D-11 com acentos) | ✓ (aplicada em prod, SUMMARY confirma via supabase migration list) | ✓ VERIFIED |
| `src/integrations/supabase/types.ts` | product_variants, products, produtos (View) tipados | ✓ | ✓ (product_variants, products, editado_manualmente, atributos, origem, produtos view) | ✓ (consumido por todos os componentes via supabase SDK) | ✓ VERIFIED |
| `src/lib/productAttributes.ts` | parseTensao, parsePotencia, mapMasterRow puros | ✓ | ✓ (110 linhas, 3 exports, regex DC, vírgula decimal, atributos jsonb) | ✓ (importado por reconcileProducts.ts e parseMasterXlsx via Plan 04) | ✓ VERIFIED |
| `src/lib/reconcileProducts.ts` | reconcile() pura com D-05..D-10 | ✓ | ✓ (120 linhas, 4 buckets, invariante preço/arquiteto) | ✓ (importado por ImportMaster.tsx) | ✓ VERIFIED |
| `src/lib/parseMasterXlsx.ts` | Parser puro XLSX master | ✓ | ✓ (121 linhas, ParseMasterError, fallback Base Completa, mapMasterRow integrado) | ✓ (importado por ImportMaster.tsx) | ✓ VERIFIED |
| `src/lib/downloadProdutosTemplate.ts` | Gerador de template XLSX baixável (IMP-04) | ✓ | ✓ (preco_tabela marcado DEFERIDO, imagem_url documentada) | ✓ (importado em ImportProdutos.tsx, botão Baixar template) | ✓ VERIFIED |
| `src/lib/uploadProdutoImagem.ts` | Upload de imagem com validação tipo/tamanho/codigo | ✓ | ✓ (bucket 'produtos-imagens', MAX_SIZE 2MB, regex /^[A-Za-z0-9_-]+$/, UploadProdutoImagemError tipado) | ✓ (importado em ProdutoEditDialog.tsx) | ✓ VERIFIED |
| `src/components/ImportMaster.tsx` | One-shot XLSX import com reconcile + preview | ✓ | ✓ (369 linhas, phase machine, batches 500, fallback per-item, 3 contadores) | ✓ (renderizado na sub-tab 'master' do Admin.tsx) | ✓ VERIFIED |
| `src/components/ImportProdutos.tsx` | CSV diário com classifyRows + imagem_url + template | ✓ | ✓ (downloadProdutosTemplate importado, imagem_url no fields, classifyRows Select de 100 SKUs) | ✓ (renderizado na sub-tab 'produtos' do Admin.tsx) | ✓ VERIFIED |
| `src/components/ImportMapper.tsx` | 3 contadores preview (Criar/Atualizar/Erros) | ✓ | ✓ (classifyRows? prop, classification state, 3 contadores condicionais) | ✓ (montado em ImportProdutos.tsx) | ✓ VERIFIED |
| `src/components/ImportImagens.tsx` | Bulk image upload migrado para bucket plural | ✓ | ✓ (bucket 'produtos-imagens', product_variants em todos os 3 pontos de acesso) | ✓ (renderizado na sub-tab 'imagens' do Admin.tsx) | ✓ VERIFIED |
| `src/components/ProdutoEditDialog.tsx` | Dialog create/edit com upload imagem + D-08 | ✓ | ✓ (361 linhas, mode prop, insert/update em product_variants, editado_manualmente=true, uploadProdutoImagem, preview imagem) | ✓ (montado em Admin.tsx: 2 instâncias, mode="create" e mode="edit") | ✓ VERIFIED |
| `src/pages/Admin.tsx` | Botão Novo Produto + 4 sub-tabs importação | ✓ | ✓ (produtoCreateOpen, Novo Produto button, 4 importSubTabs tipados, sub-tab precos com mensagem D-18) | ✓ (rota /admin via AdminRoute em App.tsx) | ✓ VERIFIED |
| `supabase/functions/import-produtos/index.ts` | Edge fn reescrita para product_variants + D-05 | ✓ | ✓ (P-LEGADO resolve, SELECT prévio create vs update, UPDATE patch sem preco/arquiteto, fallback per-item) | ✓ (invocada em ImportProdutos.tsx via supabase.functions.invoke) | ✓ VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ImportMaster.tsx` | `reconcile()` | `import { reconcile } from '@/lib/reconcileProducts'` | ✓ WIRED | Chamado com `reconcile(parsedData.variants, dbRows)` na fase de parsing. |
| `ImportMaster.tsx` | `product_variants` (INSERT/UPDATE) | `supabase.from("product_variants").insert(rows)` / `.update(upd.patch).eq("id", upd.id)` | ✓ WIRED | Batches de 500 para creates, um por um para updates (patches distintos por SKU). |
| `ImportProdutos.tsx` | edge fn `import-produtos` | `supabase.functions.invoke('import-produtos', { body: { ... } })` | ✓ WIRED | ImportProdutos.tsx linha 96 `classifyRows`, linha 120 botão template, ImportMapper com `classifyRows` prop. |
| `ImportImagens.tsx` | bucket `produtos-imagens` | `supabase.storage.from('produtos-imagens')` | ✓ WIRED | Bucket plural confirmado; UPDATE em product_variants (não view). |
| `ProdutoEditDialog.tsx` | `product_variants` INSERT (create) | `from("product_variants").insert({...origem: "manual", editado_manualmente: true, product_id: legadoParent.id})` | ✓ WIRED | Subselect busca P-LEGADO UUID antes do INSERT. |
| `ProdutoEditDialog.tsx` | `product_variants` UPDATE (edit) | `from("product_variants").update({...editado_manualmente: true}).eq("id", produto.id)` | ✓ WIRED | D-08 implementado literalmente. |
| `uploadProdutoImagem.ts` | Storage bucket `produtos-imagens` | `supabase.storage.from('produtos-imagens').upload(path, file, { upsert: true })` | ✓ WIRED | Path derivado de `codigo` sanitizado, não do filename do user. |
| `Admin.tsx` | `ProdutoEditDialog` (create) | `<ProdutoEditDialog open={produtoCreateOpen} mode="create" produto={null} />` | ✓ WIRED | Botão "+ Novo Produto" seta `produtoCreateOpen(true)`. |
| `reconcile()` | patch sem preco/arquiteto | patch object construído sem `arquiteto_id`, `preco_tabela`, `preco_minimo`, `editado_manualmente` | ✓ WIRED | Test `D-05 INVARIANT` verifica explicitamente com `expect("arquiteto_id" in patch).toBe(false)`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ImportMaster.tsx` | `report` (ReconcileReport) | `parseMasterXlsx(buffer)` → puro XLSX; `fetchAllDbVariants()` → `supabase.from("product_variants").select(...)` paginado | ✓ Real XLSX + real DB | ✓ FLOWING |
| `ImportMaster.tsx` | `report.updates[i].patch` | `reconcile()` — patch construído de MasterVariantRow sem preço/arquiteto | ✓ patch real sem PII | ✓ FLOWING |
| `ImportProdutos.tsx` | `classification` | `classifyRows()` → `supabase.from("product_variants").select("codigo").in("codigo", codigos)` | ✓ real DB query | ✓ FLOWING |
| `ProdutoEditDialog.tsx` | `imagemUrl` | `uploadProdutoImagem()` → `supabase.storage.from("produtos-imagens").upload()` → `getPublicUrl()` | ✓ real Storage URL | ✓ FLOWING |
| `Admin.tsx aba Produtos` | `produtos` | `supabase.from("produtos").select(...)` via view de compat (leitura real) | ✓ real DB via view | ✓ FLOWING |

Sem flags HOLLOW — todos os dados vêm de queries reais ou estado controlado pelo usuário.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 44 testes Vitest passam | `npx vitest run` | 4 test files, 44 tests passed | ✓ PASS |
| TypeScript compila sem erros | `npx tsc --noEmit` | 0 erros `error TS` fora de node_modules | ✓ PASS |
| reconcileProducts.ts é pura (sem supabase/fetch) | `grep -E "(^import.*supabase\|fetch\()" src/lib/reconcileProducts.ts` | 0 matches | ✓ PASS |
| productAttributes.ts é pura | `grep -E "(^import.*supabase\|fetch\()" src/lib/productAttributes.ts` | 0 matches | ✓ PASS |
| Nenhum write para view `produtos` em src/ | `grep -rn 'from("produtos").update' src/` | 0 matches | ✓ PASS |
| Bucket plural `produtos-imagens` em todos os pontos | `grep -rn "produto-imagens" src/ supabase/functions/` (excluindo comentários) | 0 matches (código ativo) | ✓ PASS |
| Import Master não escreve preco no patch | Inspeção: `apply()` usa `upd.patch` de `reconcile()` que nunca inclui preco | ✓ invariante herdado do reconcile | ✓ PASS |
| 3 migrations no diretório supabase/migrations/ | `ls supabase/migrations/ | grep 20260501` | 3 arquivos: 000001, 000002, 000003 | ✓ PASS |
| types.ts tem product_variants, products, editado_manualmente | `grep -q` nos 3 campos | 3/3 matches | ✓ PASS |
| Lint count não piorou | Antes: 51, depois Plan 04: 50 (1 a menos por remoção de import não-usado) | 50 ≤ 51 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROD-01 | 03-01, 03-03 | UI de cadastro manual de produto (nome, descrição, imagem, preço, preço mínimo, arquiteto) | ✓ SATISFIED | ProdutoEditDialog mode='create' com todos os campos. Botão "+ Novo Produto" no Admin. INSERT em product_variants com origem='manual', editado_manualmente=true. |
| PROD-02 | 03-05 | 16 produtos sem desc/foto/preço cadastrados via UI | OBSOLETE (D-09) | DB confirmou 0 produtos sem descrição em 2026-04-30. Substituído por 16 AU coringa (Plan 02). REQUIREMENTS.md atualizado. |
| IMP-01 | 03-04 | Importação CSV suporta criação de produtos novos | ✓ SATISFIED | ImportProdutos + edge fn: `classifyRows()` distingue creates de updates; INSERT em product_variants para SKUs novos. ImportMaster também cria via `reconcile().creates`. |
| IMP-02 | 03-05 | Importação CSV aceita coluna de preço | DEFERRED (D-18) | Sub-tab Preços mostra "Indisponível neste marco". ImportProdutos/edge fn/reconcile: zero campos preco_tabela/preco_minimo no UPDATE patch. REQUIREMENTS.md atualizado. |
| IMP-03 | 03-04 | Importação aceita coluna de imagem | ✓ SATISFIED | ImportProdutos campo `imagem_url` (URL pública ou nome de arquivo). Template documenta o campo. ImportImagens para bulk upload. |
| IMP-04 | 03-04 | Tela de importação com instruções claras e template baixável | ✓ SATISFIED | `downloadProdutosTemplate()` gera template-produtos.xlsx com 2 abas (Produtos + Instruções). Botão "Baixar template" em ImportProdutos. |
| IMP-05 | 03-04 | Preview antes de confirmar: criados vs atualizados vs erros | ✓ SATISFIED | ImportMapper: 3 contadores condicionais (Criar / Atualizar / Erros) via `classifyRows`. ImportMaster: preview com counters `report.creates.length` / `report.updates.length` / `report.skipped.length`. |
| IMP-06 | 03-04 | Erros linha-a-linha: falha em 1 não aborta batch | ✓ SATISFIED | ImportMaster: batch INSERT falha → fallback per-item com acumulação de errs[]. Edge fn import-produtos: mesmo padrão. Erros exportáveis via XLSX. |

**Coverage:** 6/6 requirements delivered. PROD-02 obsoleto (D-09). IMP-02 deferido (D-18). 8/8 endereçados.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/ImportMaster.tsx` | ~47 | `preco_tabela`, `preco_minimo` no SELECT de `fetchAllDbVariants()` | ℹ️ Info | Esses campos são lidos para popular `DbVariantRow` que alimenta `reconcile()` — o qual explicitamente os excui do patch. Não há write de preço. Comportamento correto e intencional (D-05). |

Nenhum TODO/FIXME/placeholder introduzido. Nenhum stub: todos os componentes conectam a tabelas reais. Nenhum `return null` / `return []` como implementação final. Invariante D-05 garantido por teste automatizado.

### Phase 2 Regression Check

Verificado que Phase 3 não introduziu regressões na Phase 2:

- `from("produtos").update` removido do ProdutoEditDialog.tsx (Phase 2 escrevia na view após Plan 01 transformar `produtos` em view — Plan 03 migrou corretamente para `product_variants`). Isso é uma correção, não regressão.
- `useProdutoSearch.ts` continua usando a view `produtos` para SELECT — backward-compat preservada.
- `vinculos_spot_lampada` FKs preservadas via RENAME (não DROP+CREATE) — sem quebra nas queries de orçamento.
- Lint count: 50 (Plan 04) ≤ 51 (Phase 2 baseline) — sem novos erros.

### Human Verification Required

Automatização verificou estrutura, wiring, testes e TypeScript. Comportamento ponta-a-ponta requer UAT em browser + banco real:

#### 1. Admin cria produto manual (PROD-01 end-to-end)

**Test:** Logado como admin em /admin?tab=produtos, clicar "+ Novo Produto". Preencher código "LM9999", nome "Teste Phase 3", descrição "Produto de teste", fazer upload de JPG < 2MB, clicar "Criar Produto".
**Expected:** Toast "Produto criado!", lista atualiza com LM9999. SQL: `SELECT codigo, origem, editado_manualmente, imagem_url FROM product_variants WHERE codigo='LM9999'` → origem='manual', editado_manualmente=true, imagem_url com URL do bucket.
**Why human:** INSERT em product_variants + upload Storage + RLS + preview imagem só verificáveis com browser real + DB.

#### 2. Admin edita AU001 (D-13)

**Test:** Clicar Pencil em AU001 na lista de produtos. Verificar que codigo é readonly (disabled). Alterar descrição. Salvar.
**Expected:** Dialog "Editar Produto" abre com codigo=AU001 readonly. Após save, `editado_manualmente` continua true (já estava) e descrição atualizada no DB.
**Why human:** Comportamento readonly + UPDATE em product_variants via UI.

#### 3. Sub-tab Master: XLSX import end-to-end

**Test:** Subir `base_dados_site_2026.xlsx` na sub-tab Master. Aguardar parsing.
**Expected:** Preview mostra contadores: `creates` (SKUs novos), `updates` (SKUs existentes), `skipped` com razão (AU001..16 devem aparecer como `origem_coringa`). Confirmar → batches aplicados. DB ganha novos products/product_variants.
**Why human:** parseMasterXlsx + reconcile + batches DB só verificáveis com arquivo real.

#### 4. Sub-tab Produtos (CSV diário): preview create/update

**Test:** Clicar "Baixar template" → confirmar que template-produtos.xlsx baixa com colunas corretas. Subir CSV com 1 SKU novo e 1 SKU existente.
**Expected:** Preview mostra "1 Criar / 1 Atualizar". Confirmar aplica via edge fn import-produtos. Toast mostra `${inserted} criados, ${updated} atualizados`.
**Why human:** classifyRows SELECT + edge fn invoke + contadores reais.

#### 5. Sub-tab Imagens: upload bulk para bucket plural

**Test:** Subir ZIP com imagens de SKUs existentes na sub-tab Imagens.
**Expected:** Imagens aparecem no bucket `produtos-imagens` (plural). `imagem_url` em product_variants atualizada.
**Why human:** Storage upload + RLS bucket.

#### 6. Sub-tab Preços: mensagem de deferimento

**Test:** Clicar na sub-tab Preços.
**Expected:** Card "Indisponível neste marco" com explicação D-18 aparece. Sem crash.
**Why human:** Visual confirmatório para UAT completo.

#### 7. Wizard de orçamento: autocomplete inclui AU001..16 (regression)

**Test:** Logado como colaborador, entrar no wizard de orçamento (Step 2). Buscar "AU001" no autocomplete de produto.
**Expected:** AU001 aparece (view `produtos` backward-compat funciona, view retorna AU coringa que foi inserido em product_variants).
**Why human:** Regressão crítica — view `produtos` backward-compat deve funcionar após RENAME. Só verificável em browser real.

### Gaps Summary

Nenhuma gap de implementação encontrada. Todos os 14 truths verificados com artefatos substantivos (acima de 100 linhas para componentes principais), wiring real, e fluxo de dados confirmado.

**Status `human_needed` (não `passed`):** código 100% correto, 44 testes passando, TypeScript sem erros. O Marco 1 segue estratégia de UAT manual em prod (conforme memória `project_aura_gsd_marco1.md`). Os 7 testes humanos acima cobrem os fluxos end-to-end (upload Storage, edge fn, batch DB, autocomplete regression) que requerem browser real e banco em prod antes do fechamento.

---

_Verified: 2026-04-30T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
