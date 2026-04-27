---
phase: 02-cadastros-arquiteto-crud
plan: 04
subsystem: cadastros-cliente-produto
tags: [cliente, produto, arquiteto, dialog, admin]
status: complete
requirements:
  completed: [CLI-01, CLI-02, CLI-03, PROD-03, PROD-04]
dependency_graph:
  requires:
    - "Plan 02-01 (masks/validators — formatCpfCnpj + unmask)"
    - "Plan 02-03 (ArquitetoAutocomplete + ArquitetoDialog)"
  provides:
    - "src/components/ClienteDialog.tsx — Dialog reusável create/edit cliente (4 campos)"
    - "src/components/ProdutoEditDialog.tsx — Dialog edição produto com arquiteto"
  affects:
    - "src/pages/Index.tsx (botão Novo Cliente agora abre ClienteDialog em mode='create')"
    - "src/pages/Admin.tsx (aba Clientes ganha Editar + coluna Arquiteto; aba Produtos ganha Editar + coluna Arquiteto)"
tech-stack:
  added: []
  patterns:
    - "Dialog reusável com mode prop (create | edit) — espelha pattern de ArquitetoDialog (Plan 02-03)"
    - "Mapa id->nome em memória (arquitetosMap) pra exibir nome de arquiteto em listas sem fazer JOIN"
    - "Máscara CPF/CNPJ aplicada no onChange do Input (sem validação semântica per D-12)"
    - "unmask aplicado no payload (banco recebe só dígitos)"
key-files:
  created:
    - src/components/ClienteDialog.tsx
    - src/components/ProdutoEditDialog.tsx
  modified:
    - src/pages/Index.tsx
    - src/pages/Admin.tsx
decisions:
  - "ClienteDialog reusável com mode prop em vez de 2 componentes (D-15) — espelha ArquitetoDialog"
  - "ProdutoEditDialog mantém código readonly (D-23) — chave de correlação com snapshots e CSV import"
  - "CPF/CNPJ no cliente sem validação semântica (D-12) — campo opcional, não vira ID legal nesta fase"
  - "Nome do arquiteto carregado via fetch separado quando dialog abre em mode='edit' (em vez de JOIN) — query pequena, simplifica payload"
  - "Mapa arquitetosMap (Record<id, nome>) populado em fetchArquitetos pra exibir nome em listas sem JOIN — barato (até 100 arquitetos)"
metrics:
  tasks_completed: 4
  files_created: 2
  files_modified: 2
  duration_minutes: ~18
  completed: "2026-04-27"
---

# Phase 02 Plan 04: Cliente Form Expandido + Produto Edit com Arquiteto Summary

Form de cliente expandido com Contato + CPF/CNPJ + Arquiteto (CLI-01..03) e edição de produto com campo Arquiteto (PROD-03, PROD-04) — fechando Phase 2. Dois Dialogs reusáveis novos consomem ArquitetoAutocomplete (Plan 03) e máscaras (Plan 01).

## Scope Delivered

- **CLI-01**: Form de cliente aceita campo Contato (text livre, opcional)
- **CLI-02**: Form de cliente aceita CPF/CNPJ com máscara auto-detect (sem validação per D-12)
- **CLI-03**: Form de cliente aceita Arquiteto via autocomplete (FK opcional)
- **PROD-04**: Admin pode editar produto e atribuir/alterar arquiteto via UI
- **PROD-03**: Viabilizado — admin atribui arquiteto a qualquer produto existente via Pencil → Dialog
- **D-15 (form único create/edit)**: ClienteDialog usa prop `mode` em vez de 2 componentes
- **D-23 (código readonly)**: Código fica disabled em ProdutoEditDialog (chave de CSV/snapshot)

## Files Created

### `src/components/ClienteDialog.tsx` (novo, 160 linhas)

Dialog reusável de cliente com 4 campos na ordem D-14: `[Nome*, Contato, CPF/CNPJ, Arquiteto]`.

| Prop | Tipo | Comportamento |
|------|------|---------------|
| `open` | `boolean` | controla visibilidade |
| `onOpenChange` | `(open: boolean) => void` | sync de close |
| `mode` | `"create" \| "edit"` | troca título e payload (insert vs update) |
| `cliente` | `ClienteRow \| null` | dados pré-populados em mode=edit |
| `onSuccess` | `() => void` | callback pós-save (refetch da lista) |

**Comportamento chave:**
- `formatCpfCnpj(e.target.value)` no onChange (auto-detect 11 vs 14 dígitos)
- **SEM `validateCPF`** (D-12 — campo opcional, sem validação semântica neste marco)
- Submit envia `unmask(cpfCnpj)` (só dígitos vão pro banco) ou `null` se vazio
- `arquiteto_id: arquitetoId` no payload — FK direta
- Em mode=edit, faz fetch separado do nome do arquiteto (`select("nome").eq("id", arquiteto_id).maybeSingle()`) pra popular o input do autocomplete

Exporta interface `ClienteRow { id, nome, contato, cpf_cnpj, arquiteto_id }`.

### `src/components/ProdutoEditDialog.tsx` (novo, 158 linhas)

Dialog de edição de produto. **Não cria novo produto** — PROD-01 (cadastro inicial) é Phase 3.

Campos editáveis: `descrição*, preço tabela, preço mínimo, arquiteto`. **Código readonly** (D-23).

| Prop | Tipo | Comportamento |
|------|------|---------------|
| `open` | `boolean` | controla visibilidade |
| `onOpenChange` | `(open: boolean) => void` | sync de close |
| `produto` | `ProdutoEditRow \| null` | dados a editar |
| `onSuccess` | `() => void` | callback pós-update (re-fetch produtos) |

**Comportamento chave:**
- Preço aceita `,` ou `.` como separador decimal (`replace(",", ".")` antes de `Number()`)
- Valida `Number.isNaN(ptNum)` e `Number.isNaN(pmNum)` antes de salvar (toast erro se inválido)
- Preços vazios viram `null` no payload
- UPDATE com `arquiteto_id: arquitetoId` na tabela produtos via Supabase SDK

Exporta interface `ProdutoEditRow { id, codigo, descricao, preco_tabela, preco_minimo, arquiteto_id }`.

## Files Modified

### `src/pages/Index.tsx`

- Removido state `novoClienteNome` e handler `handleCriarCliente` (movidos pro ClienteDialog)
- Removidos imports não-usados: `Input`, `supabase`, `toast`
- Adicionado import: `ClienteDialog`
- Substituído `<Dialog>` inline de "Novo Cliente" por `<ClienteDialog mode="create" onSuccess={listKey++}>`
- Botão "Novo Cliente" agora chama apenas `setClienteDialogOpen(true)` (sem reset de `novoClienteNome`)
- **Wizard 3 passos preservado** — nenhuma mudança em Step1/2/3

### `src/pages/Admin.tsx`

**Imports adicionados:**
```typescript
import ClienteDialog, { type ClienteRow } from "@/components/ClienteDialog";
import ProdutoEditDialog, { type ProdutoEditRow } from "@/components/ProdutoEditDialog";
```

**State adicionado:**
- `clienteCreateOpen`, `clienteEditOpen`, `clienteEditTarget: ClienteRow | null`
- `produtoEditOpen`, `produtoEditTarget: ProdutoEditRow | null`
- `arquitetosMap: Record<string, string>` — cache id→nome pra exibir em listas sem JOIN

**fetchClientes atualizado:** seleciona explicitamente `id, nome, email, telefone, contato, cpf_cnpj, arquiteto_id`

**fetchArquitetos atualizado:** popula `arquitetosMap` em paralelo com `arquitetos[]`

**Aba Clientes:**
- Botão "+ Novo Cliente" no topo (alinhado à direita)
- Coluna nova: "Arquiteto" (mostra `arquitetosMap[c.arquiteto_id] || "—"`)
- Botão "Pencil" em cada linha → abre ClienteDialog em mode='edit'
- colSpan empty-state atualizado de 4 para 5
- Coluna "Ações" com `w-28` (cabe Pencil + Trash2)

**Aba Produtos:**
- Coluna nova: "Arquiteto" (mostra `arquitetosMap[p.arquiteto_id] || "—"`)
- Coluna nova: "Ações" com botão "Pencil" → abre ProdutoEditDialog
- colSpan placeholders ("Buscando…" e "Nenhum produto") atualizados de 4 para 6

**Dialogs montados ao final:**
- `<ClienteDialog mode="create">` (criar)
- `<ClienteDialog mode="edit" cliente={clienteEditTarget}>` (editar)
- `<ProdutoEditDialog produto={produtoEditTarget}>` (editar produto)

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Criar `ClienteDialog.tsx` (Dialog reusável create/edit, 4 campos) | `4f51ba2` |
| 2 | Substituir Dialog inline em Index.tsx por `<ClienteDialog>` | `a5bd02e` |
| 3 | Adicionar Editar Cliente em Admin > Clientes (+ coluna Arquiteto) | `ec1bb5e` |
| 4 | Criar `ProdutoEditDialog.tsx` + Editar em Admin > Produtos | `020daa7` |

## Verification

- ✓ `npx tsc --noEmit` — exit 0 (zero erros)
- ✓ `npm run build` — exit 0 (apenas warnings pré-existentes: chunk size, logo dynamic+static import)
- ✓ `npm run lint` — 51 problemas (40 errors + 11 warnings), **TODOS pré-existentes**. Lint count idêntico antes/depois desta plan (verificado via stash). Plan 04 não introduziu erros novos:
  - Erros em Admin.tsx (`any[]` em produtos/colaboradores/orcamentos/clientes states) já existiam antes
  - Erros em supabase/functions/import-* já existiam antes
  - Tailwind `require-import` já existia antes
- Smoke manual: **não executado nesta sessão** — roteiro de 13 passos do `<verification>` do plan permanece válido para o próximo touch manual do usuário (logar como colaborador, testar form de cliente com CPF/CNPJ + arquiteto, logar como admin, editar cliente/produto, confirmar wizard 3 steps intacto).

## Threat Mitigations Applied

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-02-16 (Tampering CPF sem validação) | accept — locked D-12, campo opcional |
| T-02-17 (Info disclosure em toast/log) | mitigate — toast genérico só com `error.message`, sem console.log de payload |
| T-02-18 (Elevation produto UPDATE) | mitigate — RLS de produtos restringe a admin (Phase 1); aba Produtos só carrega via AdminRoute |
| T-02-19 (DoS autocomplete spam) | mitigate — debounce 300ms + limit 10 herdados do ArquitetoAutocomplete (Plan 03) |
| T-02-20 (Preço absurdo) | accept — sem validação de range, decisão de negócio |

## Deviations from Plan

**None — plano executado exatamente como escrito.**

A implementação seguiu os snippets do `<action>` letra-por-letra. Zero auto-fixes (Rule 1/2/3) necessários — código compilou sem erros e build passou na primeira tentativa.

**Único ajuste menor de estilo (não-deviation):**
- Removidos imports `Input`, `supabase`, `toast` em Index.tsx que ficaram unused após substituir Dialog inline. Não estava no plan, mas é limpeza padrão (não deveria ficar warning unused-imports).

## Authentication Gates

Nenhum — todas as queries Supabase feitas via cliente já autenticado (sessão do usuário). Não houve necessidade de deploy de edge function nem credencial adicional.

## Known Stubs

Nenhum. Os 4 campos novos (Contato, CPF/CNPJ, Arquiteto em cliente; Arquiteto em produto) escrevem direto nas colunas reais da tabela. Listas mostram dados reais via `arquitetosMap` populado a partir do fetch da tabela arquitetos.

## SQL Alternativo para PROD-03 em Massa (D-24)

Caso o Lenny precise vincular muitos produtos (50+) ao mesmo arquiteto sem clicar Pencil em cada um, rodar no **Supabase SQL Editor**:

```sql
-- 1. Vincular todos os produtos com prefixo "MK27" ao Studio MK27
UPDATE produtos
SET arquiteto_id = (SELECT id FROM arquitetos WHERE nome = 'Studio MK27')
WHERE codigo LIKE 'MK27%';

-- 2. Vincular produtos de uma família/aplicação específica
UPDATE produtos
SET arquiteto_id = (SELECT id FROM arquitetos WHERE nome = 'Estudio Bola Arquitetura')
WHERE familia_perfil = 'PROFILE-LINEAR-12';

-- 3. Listar quem está vinculado vs sem vínculo (sanity check antes de UPDATE em massa)
SELECT
  p.codigo,
  p.descricao,
  COALESCE(a.nome, '— sem arquiteto —') AS arquiteto
FROM produtos p
LEFT JOIN arquitetos a ON a.id = p.arquiteto_id
ORDER BY a.nome NULLS LAST, p.codigo;

-- 4. Remover vínculo de um lote (set null)
UPDATE produtos
SET arquiteto_id = NULL
WHERE codigo LIKE 'MK27%';
```

**Importante:** rodar como `service_role` ou via Dashboard (SQL Editor já roda com privilégio elevado). RLS de produtos não bloqueia, mas confirmar via Dashboard com login admin.

## Phase 2 Closure

Esta plan fecha a Phase 02 — Cadastros & Arquiteto CRUD.

**Phase 2 Requirements completed (10/10):**

| Plan | Requirements |
|------|--------------|
| 02-01 (masks/validators/edge fn) | USR-01, USR-02, USR-03 |
| 02-02 (signup expandido + perfil completar) | USR-04 |
| 02-03 (Arquitetos admin CRUD) | ARQ-02 |
| 02-04 (Cliente form + Produto edit) | CLI-01, CLI-02, CLI-03, PROD-03, PROD-04 |

**Total Phase 2:** 10/10 requirements deliverables (USR-01..04, CLI-01..03, ARQ-02, PROD-03, PROD-04). Próxima fase: Phase 03 — Produtos & Importação.

## Self-Check: PASSED

**Files verified to exist:**
- ✓ `src/components/ClienteDialog.tsx`
- ✓ `src/components/ProdutoEditDialog.tsx`
- ✓ `src/pages/Index.tsx` (modified)
- ✓ `src/pages/Admin.tsx` (modified)

**Commits verified to exist (via `git log --oneline -8`):**
- ✓ `4f51ba2` — feat(02-04): add ClienteDialog reusable create/edit dialog
- ✓ `a5bd02e` — feat(02-04): replace inline cliente Dialog in Index.tsx with ClienteDialog
- ✓ `ec1bb5e` — feat(02-04): add cliente edit + arquiteto column to Admin clientes tab
- ✓ `020daa7` — feat(02-04): add ProdutoEditDialog + edit button on Admin produtos tab

**Truths from must_haves:**
- ✓ Form de criar cliente aceita Contato (text livre), CPF/CNPJ (mascarado auto-detect, sem validação), Arquiteto (autocomplete) — todos opcionais
- ✓ Form de editar cliente expõe os mesmos 3 campos novos pré-populados (mode=edit em Admin > Clientes)
- ✓ Submit do cliente envia CPF/CNPJ desmascarado (`unmask(cpfCnpj)` no payload)
- ✓ Admin > Produtos tem Dialog de edição com campo Arquiteto via ArquitetoAutocomplete
- ✓ Atribuir arquiteto a produto existente é possível ponta-a-ponta via UI (PROD-03 manual)
- ✓ Admin > Produtos lista mostra coluna Arquiteto (mostra nome via `arquitetosMap`)
