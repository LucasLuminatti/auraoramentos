---
phase: 08-cadastros-opcionalizar-imagens-manuais
plan: "03"
subsystem: admin-ui
tags: [form-03, form-04, produtos, imagem-inline, coringa]
dependency_graph:
  requires: []
  provides: [botao-imagem-inline-produtos]
  affects: [src/pages/Admin.tsx]
tech_stack:
  added: []
  patterns: [reuso-dialog-existente, inline-action-button]
key_files:
  created: []
  modified:
    - src/pages/Admin.tsx
decisions:
  - "D-11 (locked): reuso total do ProdutoEditDialog — sem criar modo focused-image"
  - "D-13 (locked): botão funciona para qualquer SKU sem distinção por origem"
  - "D-09 (locked): reconcileProducts não tocado — coringa imunizado via origem='coringa'"
metrics:
  duration: "~8 min"
  completed: "2026-05-11"
  tasks_completed: 1
  files_modified: 1
---

# Phase 8 Plan 3: FORM-03 + FORM-04 — Botão Imagem Inline em Produtos Summary

## One-liner

Botão `ImageIcon` inline adicionado em cada linha da tabela Cadastros > Produtos, abrindo o ProdutoEditDialog existente em modo edit (reuso 100%).

## What Was Built

Adicionado um botão com `ImageIcon` (`title="Anexar/trocar imagem"`) imediatamente antes do botão `Pencil` existente no `TableCell` de ações da tab Cadastros > Produtos em `Admin.tsx`.

**FORM-04:** Admin pode clicar no ícone de imagem em qualquer linha e o `ProdutoEditDialog` abre em modo edit já com os dados do produto preenchidos — incluindo o campo de upload de imagem. Nenhum novo modo de dialog foi criado (D-11).

**FORM-03:** Os 16 coringas AU001..AU016 já apareciam na lista (sem bloqueio técnico). O botão inline aplica-se uniformemente a todos os SKUs (D-13), tornando a ação visualmente explícita para coringas também.

## Diff aplicado em Admin.tsx

Linhas 573–593 (antes): `<TableCell>` com único `<Button> <Pencil/>`.

Linhas 573–613 (depois): `<TableCell>` com `<div className="inline-flex gap-1">` contendo dois buttons — `ImageIcon` (title="Anexar/trocar imagem") seguido de `Pencil` (title="Editar produto"). Ambos com onClick idêntico abrindo o mesmo dialog (D-11: simplicidade sobre DRY local).

## Arquivos protegidos — confirmação

| Arquivo | Status |
|---------|--------|
| `src/components/ProdutoEditDialog.tsx` | Não modificado (D-11) |
| `src/lib/uploadProdutoImagem.ts` | Não modificado (D-08) |
| `src/lib/reconcileProducts.ts` | Não modificado (D-09) |

Coringas AU001..AU016 permanecem com `origem='coringa'` — proteção contra sobrescrita master garantida pelo reconcile (D-10).

## Commits

| Task | Commit | Arquivo |
|------|--------|---------|
| Task 1: Botão ImageIcon inline | `6a38a43` | `src/pages/Admin.tsx` |

## Verification Results

- `npm run lint -- src/pages/Admin.tsx`: exit 0
- `npx tsc --noEmit -p tsconfig.app.json`: zero erros em Admin.tsx (erros pré-existentes em outros arquivos não relacionados)
- Script de verificação: `OK img=1 pencil=3` (1 ImageIcon novo + 3 Pencils preservados: Produtos + Arquitetos + Colaboradores)
- `title="Anexar/trocar imagem"` presente
- `setProdutoEditOpen(true)` chamado no onClick do ImageIcon

## Deviations from Plan

Nenhum — plano executado exatamente como escrito.

## Known Stubs

Nenhum. O botão chama o dialog existente que já tem upload funcional.

## Threat Flags

Nenhum novo. T-08-06, T-08-07, T-08-08 herdados do plan:
- Path traversal em upload bloqueado por regex em `uploadProdutoImagem.ts` (não modificado)
- Botão herda guard `<AdminRoute>` já presente na tab
- MAX_SIZE 2MB enforçado pelo helper (não modificado)

## Self-Check

- [x] `src/pages/Admin.tsx` modificado e commitado em `6a38a43`
- [x] Commit existe: `git log --oneline | grep 6a38a43`
- [x] Arquivos protegidos fora do `git diff`
