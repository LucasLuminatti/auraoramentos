---
phase: 03-produtos-importa-o
plan: 03
subsystem: ui-produto
tags: [ui, produto-form, image-upload, storage, product_variants, admin]
dependency_graph:
  requires: [03-01]
  provides: [ProdutoEditDialog-create-edit, uploadProdutoImagem, Admin-novo-produto-button]
  affects: [03-04, 03-05]
tech_stack:
  added: []
  patterns: [mode-prop-create-edit, storage-upload-client-side, product_variants-write]
key_files:
  created:
    - src/lib/uploadProdutoImagem.ts
  modified:
    - src/components/ProdutoEditDialog.tsx
    - src/pages/Admin.tsx
    - src/components/ImportImagens.tsx
decisions:
  - "D-08: editado_manualmente=true em qualquer save via UI (mode=create e mode=edit)"
  - "D-13: AU001..16 editáveis via ProdutoEditDialog mode=edit (Pencil no Admin)"
  - "D-14: bucket 'produtos-imagens' (plural) usado em uploadProdutoImagem e corrigido em ImportImagens"
  - "D-16: Upload de imagem via UI admin no ProdutoEditDialog com preview, trocar e remover"
  - "Pitfall 1 resolvido: WRITE migrado de view 'produtos' (somente leitura) para tabela 'product_variants'"
metrics:
  duration_minutes: 18
  completed_date: "2026-05-04"
  tasks_completed: 4
  files_created: 1
  files_modified: 3
---

# Phase 3 Plan 03: ProdutoEditDialog create/edit + uploadProdutoImagem + Admin Novo Produto — Summary

**One-liner:** ProdutoEditDialog estendido com mode='create'|'edit', upload de imagem para bucket 'produtos-imagens', writes migrados de view somente leitura para tabela product_variants (D-08/D-13/D-14/D-16); botão "+ Novo Produto" adicionado ao Admin.

## Tasks Executadas

| Task | Descrição | Commit | Status |
|------|-----------|--------|--------|
| 1 | Criar src/lib/uploadProdutoImagem.ts | `a98b138` | OK |
| 2 | Estender ProdutoEditDialog (mode prop + upload + product_variants write) | `6f8ca6f` | OK |
| 3 | Adicionar botão "+ Novo Produto" no Admin.tsx | `9f67c3a` | OK |
| Desvio | Corrigir ImportImagens.tsx (bucket singular → plural + from("produtos").update → product_variants) | `c7038f9` | OK |

## Detalhes por Arquivo

### src/lib/uploadProdutoImagem.ts (novo)

- Função `uploadProdutoImagem(codigo, file)` — upload para bucket `produtos-imagens` (D-14 lock)
- Validações client-side: tipo (jpg/jpeg/png/webp por extensão E mime), tamanho máx 2MB, codigo via regex `/^[A-Za-z0-9_-]+$/`
- Path derivado do código sanitizado, NÃO do filename do user — defesa em profundidade contra path traversal (T-03-17)
- `upsert: true` — permite admin trocar imagem do mesmo SKU
- `UploadProdutoImagemError` com campo `code` tipado (INVALID_TYPE | TOO_LARGE | INVALID_CODIGO | UPLOAD_FAILED) para caller decidir mensagem

### src/components/ProdutoEditDialog.tsx (modificado)

**Mudanças críticas em relação à versão Phase 2:**

1. **Prop `mode: "create" | "edit"` adicionado** — espelha padrão ClienteDialog/ArquitetoDialog da Phase 2
2. **`ProdutoEditRow` estendido** — campos opcionais `nome?: string | null` e `imagem_url?: string | null` adicionados
3. **Upload de imagem** (D-13/D-16) — botão "Fazer upload", preview `<img>`, botão "Remover", input hidden, integrado com `uploadProdutoImagem`
4. **WRITE migrado** (Pitfall 1 RESEARCH) — `from("produtos").update` removido; INSERT e UPDATE agora em `product_variants`
5. **D-08 implementado** — `editado_manualmente: true` em todo UPDATE (mode='edit') e em todo INSERT (mode='create')
6. **mode='create'** — subselect busca `product_id` de `products WHERE codigo_pai='P-LEGADO'`, insere com `origem='manual'`, `atributos={}`
7. **Validação no create** — codigo obrigatório (editável), nome obrigatório, descrição obrigatória; no edit, codigo disabled (chave fixa)

### src/pages/Admin.tsx (modificado)

Mudanças cirúrgicas na aba Produtos:

1. State `produtoCreateOpen` adicionado (boolean, controla dialog de criação)
2. Botão "+ Novo Produto" adicionado à direita do search bar, com ícone `<Plus>`
3. `fetchProdutos` agora faz SELECT explícito incluindo `nome` e `imagem_url` (necessário para alimentar ProdutoEditDialog)
4. Pencil onClick populado com campos `nome` e `imagem_url` para `produtoEditTarget`
5. Dois `<ProdutoEditDialog>` montados: um com `mode="create" produto={null}`, outro com `mode="edit" produto={produtoEditTarget}`

### src/components/ImportImagens.tsx (corrigido — desvio Rule 1)

- Bucket corrigido de `"produto-imagens"` (singular) para `"produtos-imagens"` (plural, D-14)
- UPDATE corrigido de `from("produtos").update(...)` (view somente leitura) para `from("product_variants").update(...)`
- Cast `as any` removido — `product_variants.imagem_url` é propriamente tipado após Plan 01

## Confirmação: WRITE migrado de view → tabela

**Zero referências a `from("produtos").update` em todo o código** — verificado via grep em `src/`.

| Componente | Antes | Depois |
|-----------|-------|--------|
| ProdutoEditDialog (edit) | `from("produtos").update` (view — quebrava) | `from("product_variants").update` |
| ImportImagens (bulk) | `from("produtos").update` (view — quebrava) | `from("product_variants").update` |
| ProdutoEditDialog (create) | N/A (não existia) | `from("product_variants").insert` |

## Decisões Executadas

| Decisão | Resultado |
|---------|-----------|
| D-08 | `editado_manualmente: true` setado em todo UPDATE e INSERT via UI |
| D-13 | AU001..16 (criados em Plan 02) editáveis via Pencil → Dialog no Admin |
| D-14 | Bucket `produtos-imagens` (plural) usado em uploadProdutoImagem; ImportImagens corrigido de singular para plural |
| D-16 | Upload de imagem via botão no ProdutoEditDialog, path derivado do código (não do filename) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrigido ImportImagens.tsx: bucket singular + from("produtos").update**
- **Found during:** Verificação final pós-Task 3 (critério "zero from(produtos).update")
- **Issue:** `ImportImagens.tsx` usava bucket `"produto-imagens"` (singular, incorreto per D-14) e `from("produtos").update(...)` (view somente leitura após Plan 01 migration)
- **Fix:** Bucket corrigido para `"produtos-imagens"` (plural); UPDATE migrado para `from("product_variants").update(...)`; cast `as any` removido (product_variants é tipado)
- **Files modified:** `src/components/ImportImagens.tsx`
- **Commit:** `c7038f9`

## Known Stubs

None — todos os campos são escritos e lidos de tabelas reais. Upload de imagem funcional via Supabase Storage. Nenhum placeholder de dado.

## Threat Flags

None — superfícies de segurança exatamente conforme o threat model do plan:
- Path traversal mitigado: path derivado do codigo sanitizado (T-03-17)
- SVG bloqueado: whitelist de tipo em uploadProdutoImagem (T-03-18)
- DoS mitigado: MAX_SIZE = 2MB validado client-side (T-03-19)
- Elevação de privilégio: AdminRoute já protege /admin; RLS no Storage reforça (T-03-20)

## Lint Count

- **Antes do Plan 03:** 51 problemas (40 errors, 11 warnings) — pré-existentes do Phase 2
- **Depois do Plan 03:** 51 problemas (40 errors, 11 warnings) — sem novos erros introduzidos

## Self-Check: PASSED

- `src/lib/uploadProdutoImagem.ts` — FOUND
- `src/components/ProdutoEditDialog.tsx` — FOUND, contém mode prop, product_variants write, editado_manualmente, uploadProdutoImagem
- `src/pages/Admin.tsx` — FOUND, contém produtoCreateOpen, Novo Produto button, dois ProdutoEditDialog
- `src/components/ImportImagens.tsx` — FOUND, bucket plural, product_variants update
- Commits: `a98b138`, `6f8ca6f`, `9f67c3a`, `c7038f9` — todos no git log
- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0 (`✓ built`)
- `npm run lint` — 51 problemas (idêntico ao pré-existente)
- `grep -rn 'from("produtos").update' src/` — zero ocorrências
