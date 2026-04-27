---
phase: 02-cadastros-arquiteto-crud
plan: 03
subsystem: admin/arquitetos
tags: [admin, crud, arquitetos, autocomplete]
status: complete
requires:
  - "phase 1: tabela arquitetos com RLS (admin manage, public select)"
provides:
  - "Aba Arquitetos no admin com CRUD completo"
  - "Componente ArquitetoAutocomplete reusável (consumido por Plan 04)"
  - "Componente ArquitetoDialog reusável (mode create/edit)"
affects:
  - "src/pages/Admin.tsx (8 abas agora — adicionada Arquitetos)"
tech-stack:
  added: []
  patterns:
    - "Dialog reusável com mode prop (create | edit)"
    - "AlertDialog (shadcn) para confirmação destrutiva"
    - "Combobox com debounce 300ms espelhando ProdutoAutocomplete"
key-files:
  created:
    - src/components/ArquitetoAutocomplete.tsx
    - src/components/ArquitetoDialog.tsx
  modified:
    - src/pages/Admin.tsx
decisions:
  - "Reaproveitado pattern de ProdutoAutocomplete (debounce + click-outside) em vez de criar hook separado — escopo pequeno"
  - "ArquitetoDialog usa mode prop ao invés de dois componentes (D-20)"
  - "Sem criar arquiteto inline no autocomplete (D-17) — usuário vai em Admin > Arquitetos"
  - "AlertDialog usado pra delete (não Dialog comum) — semântica destrutiva clara"
metrics:
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  duration_minutes: ~15
  completed: "2026-04-27"
---

# Phase 02 Plan 03: Arquitetos Admin CRUD Summary

CRUD completo de arquitetos no admin (8ª aba) + componente `ArquitetoAutocomplete` pronto para a Plan 04 consumir como seletor de arquiteto em forms de cliente.

## Scope Delivered

- **ARQ-02**: Admin agora tem aba "Arquitetos" funcional ponta-a-ponta — listar (ORDER BY nome ASC), criar, editar e excluir.
- **Componentes reusáveis**:
  - `ArquitetoAutocomplete` (combobox com busca ilike, limit 10, opção "Nenhum arquiteto" no topo, sem criar inline)
  - `ArquitetoDialog` (Dialog único com prop `mode` para create e edit)
- **AlertDialog de exclusão** com aviso explícito sobre FK `ON DELETE SET NULL`: "Clientes e produtos vinculados ficarão sem arquiteto".

## Files Created

- `src/components/ArquitetoAutocomplete.tsx` — combobox espelhando `ProdutoAutocomplete` (debounce 300ms, click-outside, dropdown z-50). Export: `default ArquitetoAutocomplete` + interface `ArquitetoOption { id, nome }`.
- `src/components/ArquitetoDialog.tsx` — Dialog reusável com mode `create | edit`. Form `[Nome*, Contato]`. Trim antes de salvar; contato vazio vira `null`. Export: `default ArquitetoDialog` + interface `ArquitetoRow { id, nome, contato }`.

## Files Modified

- `src/pages/Admin.tsx`:
  - Imports: `Plus`, `Pencil` (lucide), `ArquitetoDialog`/`ArquitetoRow`, `AlertDialog*`.
  - `VALID_TABS` agora inclui `"arquitetos"`.
  - State: 6 vars novas (arquitetos list + dialog mode/target/open + delete target/open).
  - Handlers: `fetchArquitetos`, `handleDeleteArquiteto`, `openCreateArquiteto`, `openEditArquiteto`.
  - `useEffect` inicial chama `fetchArquitetos()`.
  - `<TabsTrigger value="arquitetos">` na TabsList.
  - `<TabsContent value="arquitetos">` com Table + botão "+ Novo Arquiteto".
  - `<ArquitetoDialog>` e `<AlertDialog>` montados ao final.

## Commits

- `d228215` feat(02-03): add ArquitetoAutocomplete combobox component
- `ddc2813` feat(02-03): add ArquitetoDialog reusable create/edit dialog (D-20)
- `549de4e` feat(02-03): add Arquitetos tab to Admin with full CRUD (ARQ-02)

## Verification

- `npx tsc --noEmit` — exit 0 (zero erros)
- `npm run build` — exit 0 (apenas warnings pré-existentes: chunk size, logo dynamic+static import)
- `npm run lint` — exit 0 (40 erros pré-existentes em código não tocado: `any` em Produtos/Colaboradores/Orcamentos states e edge functions; tailwind require-import). **Zero erros novos introduzidos** pela Plan 03 (Arquitetos usa `ArquitetoRow[]` tipado).
- Smoke manual: **não executado nesta sessão** (worktree isolado, não conectado ao Supabase prod). Roteiro de 9 passos do `<verification>` do plan permanece válido para o próximo touch manual do usuário.

## Acceptance Criteria — Status

### Task 1 — ArquitetoAutocomplete
- [x] Arquivo existe
- [x] Exporta `ArquitetoOption { id: string; nome: string }`
- [x] Exporta default `ArquitetoAutocomplete`
- [x] Contém `ilike("nome",`
- [x] Contém `.limit(10)`
- [x] Contém `onSelect(null)` (Nenhum arquiteto)
- [x] Contém `setTimeout(..., 300)` (debounce)
- [x] Sem código de criar inline (zero `insert`)
- [x] `tsc --noEmit` passa

### Task 2 — ArquitetoDialog
- [x] Arquivo existe
- [x] Exporta `ArquitetoRow { id, nome, contato: string | null }`
- [x] Prop `mode: "create" | "edit"`
- [x] Prop `onSuccess: () => void`
- [x] Contém `supabase.from("arquitetos").insert(`
- [x] Contém `supabase.from("arquitetos").update(`
- [x] Contém `.eq("id", arquiteto.id)`
- [x] Trim de nome e contato (`contato.trim() || null`)
- [x] Title condicional Novo/Editar
- [x] `tsc --noEmit` passa

### Task 3 — Admin Arquitetos tab
- [x] `VALID_TABS` inclui `"arquitetos"`
- [x] Imports de ArquitetoDialog e AlertDialog presentes
- [x] `<TabsTrigger value="arquitetos">Arquitetos</TabsTrigger>`
- [x] `<TabsContent value="arquitetos">`
- [x] `const fetchArquitetos = async`
- [x] `.from("arquitetos").select`
- [x] `.from("arquitetos").delete()`
- [x] `.order("nome", { ascending: true })`
- [x] Botão criar com `<Plus />` + "Novo Arquiteto"
- [x] AlertDialog com mensagem "vinculados ficarão sem arquiteto"
- [x] `<ArquitetoDialog ... mode={arquitetoDialogMode}` montado
- [x] `tsc --noEmit` passa
- [x] `npm run build` exit 0

## Threat Model — Mitigations Applied

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-02-11 (Elevation) | RLS já em prod (Phase 1) é a defesa primária. UI só carrega via AdminRoute (defesa em camadas). |
| T-02-12 (Tampering) | `nome.trim()` e `contato.trim() || null` aplicados antes do payload. Supabase SDK escapa parâmetros. JSX escapa XSS por padrão. Sem `dangerouslySetInnerHTML`. |
| T-02-13 (DoS delete vinculado) | `accept` — AlertDialog avisa o usuário antes; FK ON DELETE SET NULL é eficiente com índice. |
| T-02-14 (Info disclosure autocomplete) | `accept` — lista de arquitetos não é PII; SELECT aberta é intencional pra forms. |
| T-02-15 (Sem audit log) | `accept` neste marco. |

## Deviations from Plan

**None — plan executado exatamente como escrito.**

A implementação seguiu os snippets do `<action>` letra-por-letra. Zero auto-fixes (Rule 1/2/3) necessários — código compilou e passou lint sem warnings adicionais.

## Known Stubs

Nenhum. ArquitetoAutocomplete e ArquitetoDialog estão totalmente funcionais (não recebem dados mockados — fazem queries reais ao Supabase).

## What This Unlocks (Plan 04)

- **Plan 04 (cliente form)** pode importar `ArquitetoAutocomplete` e usar diretamente para selecionar `arquiteto_id` em CLI-NEW-01 (campo opcional). Pattern de uso:
  ```tsx
  import ArquitetoAutocomplete, { type ArquitetoOption } from "@/components/ArquitetoAutocomplete";
  // ...
  <ArquitetoAutocomplete
    value={arquitetoNome}
    onSelect={(arq) => {
      setArquitetoId(arq?.id ?? null);
      setArquitetoNome(arq?.nome ?? "");
    }}
  />
  ```
- O componente já lida com "Nenhum arquiteto" (passa `null` ao `onSelect`) — Plan 04 só precisa persistir `arquiteto_id` opcional no insert/update de cliente.

## Requirements Marked

- ARQ-02 (ARQ-NEW-01 no PROJECT.md): "Entidade `arquitetos` criada no banco com CRUD no admin" — admin agora tem CRUD ponta-a-ponta na 8ª aba.

## Self-Check: PASSED

- src/components/ArquitetoAutocomplete.tsx — FOUND
- src/components/ArquitetoDialog.tsx — FOUND
- src/pages/Admin.tsx — FOUND (modified)
- Commit d228215 — FOUND
- Commit ddc2813 — FOUND
- Commit 549de4e — FOUND
