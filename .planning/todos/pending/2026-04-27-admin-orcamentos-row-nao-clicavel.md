---
created: 2026-04-27T18:09:13.967Z
title: Admin > Orçamentos linha da tabela não é clicável
area: ui
files:
  - src/pages/Admin.tsx
---

## Problem

Na aba "Orçamentos" do Admin (`/admin?tab=orcamentos`), a tabela lista os
orçamentos (Data, Cliente, Projeto, Colaborador, Valor, Status, Ações) mas
a coluna **Ações** está vazia e não há `onClick` na `<TableRow>` — então é
impossível abrir/inspecionar um orçamento existente a partir do Admin.

Descoberto durante o smoke test do Phase 1 (Teste 3 — Orçamento antigo + PDF):
queríamos validar que orçamentos pré-Phase 1 continuam abrindo, mas não
conseguimos clicar em nenhuma linha pra testar.

## Solution

Duas opções (escolher uma):

1. Adicionar um botão "Abrir" / ícone de olho na coluna **Ações** que faça
   `navigate("/orcamento/" + id)` (ou rota equivalente — verificar como o
   wizard já navega ao abrir um orçamento existente pelo fluxo Cliente →
   Projeto).
2. Tornar a `<TableRow>` clicável diretamente (`onClick` + `cursor-pointer`)
   com a mesma navegação.

Conferir se a rota `/orcamento/:id` (ou similar) já existe — se não, pode
ser que o wizard só abre via state na navegação do Index.tsx, exigindo
uma rota nova ou ajuste no Step1/2/3 pra hidratar de um id.
