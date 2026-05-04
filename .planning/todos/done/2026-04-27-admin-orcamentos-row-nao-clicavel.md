---
created: 2026-04-27T18:09:13.967Z
title: Orçamento existente não é clicável em nenhum lugar
area: ui
files:
  - src/pages/Admin.tsx
  - src/pages/Index.tsx
---

## Problem

**Não é possível abrir um orçamento já criado em nenhuma rota do sistema.**

Descoberto no smoke do Phase 1 (Teste 3 — orçamento antigo + PDF) em
2026-04-27. Dois caminhos quebrados:

1. **Admin > aba Orçamentos** (`/admin?tab=orcamentos`):
   tabela lista (Data, Cliente, Projeto, Colaborador, Valor, Status, Ações)
   mas a coluna "Ações" está vazia e a `<TableRow>` não tem `onClick`.

2. **Home `/` > Cliente > Projeto > orçamento listado**:
   dentro do projeto, o card "26/04/2026 · Rascunho · R$ 25,41" também é
   estático — sem `onClick`, sem botão de abrir/editar.

Resultado: o orçamento criado existe no banco (`orcamentos` table tem o row),
aparece nos dois lugares, mas não tem como visualizar/editar/duplicar.
Bloqueia validação de regressão de orçamentos antigos no smoke.

## Solution

Investigar primeiro:
- Existe rota `/orcamento/:id` ou equivalente? (`grep` em `App.tsx`/`Routes`)
- Se não existir, o wizard precisa ser adaptado pra hidratar de um ID,
  ou criar rota nova que carrega orçamento + ambientes + sistemas e
  monta o state inicial do wizard no Step 3.

Implementar nos 2 lugares:
1. `Admin.tsx` aba orçamentos — botão "Abrir" na coluna Ações (ícone
   `Eye` do lucide-react).
2. `Index.tsx` (home/projeto view) — `onClick` + `cursor-pointer` no card
   do orçamento.

Ambos navegam pra mesma rota de visualização.

Considerar se faz sentido permitir só visualização (read-only) pra
orçamentos `fechado`/`perdido` e edição pra `rascunho`/`enviado`.
