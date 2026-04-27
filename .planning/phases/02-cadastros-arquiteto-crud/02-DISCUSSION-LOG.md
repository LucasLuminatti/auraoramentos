# Phase 2: Cadastros & Arquiteto CRUD - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves what happened in the discussion.

**Date:** 2026-04-27
**Phase:** 02-cadastros-arquiteto-crud
**Mode:** delegação ao Claude (usuário escolheu "Other" e respondeu "quero que você decida por mim baseado na situação atual do projeto")

---

## Pergunta inicial

**Question:** Quais gray areas você quer discutir pra Phase 2?

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill USR-04 (colaborador antigo) | Modal forçado, banner sticky, aba opcional, ou bloqueio? | |
| Arquiteto CRUD no admin (UX) | Aba dedicada vs subseção? Inline vs drawer vs modal? | |
| Autocomplete arquiteto no form cliente | shadcn Command, Select com search, ou input + sugestões? | |
| Máscara de CPF/telefone (lib vs manual) | react-input-mask, react-imask, manual, ou brazilian-values? | |
| Other (free text) | | ✓ |

**User's choice:** "quero que você decida por mim baseado na situação atual do projeto"

**Notes:** Usuário delegou todas as decisões pro Claude. Claude analisou o codebase (ProdutoAutocomplete, Auth.tsx, Admin.tsx pós-hotfix, padrão shadcn) + decisões do PROJECT.md/REQUIREMENTS.md/ROADMAP.md e tomou as 27 decisões consolidadas em CONTEXT.md.

---

## Razões das decisões delegadas

### Backfill USR-04 → Banner sticky + página `/perfil/completar`
- Requirement explícito: "sem ser bloqueado". Modal forçado violaria.
- Banner é proativo mas não interrompe fluxo.
- Página dedicada > modal pra preenchimento de CPF (precisa cuidado).

### Arquiteto CRUD → Nova aba "Arquitetos" no Admin com Dialog
- Pattern já estabelecido (Clientes, Colaboradores usam mesma estrutura).
- 8ª aba; URL search param já implementado pelo hotfix `b8dfc40`.
- AlertDialog pra excluir mantém consistência.

### Autocomplete arquiteto → `ArquitetoAutocomplete.tsx` espelhando `ProdutoAutocomplete.tsx`
- Codebase já tem Combobox shadcn rodando produção pra produtos.
- Consistência > novidade. Usuário aprende uma vez.

### Máscaras → Manual em `src/lib/masks.ts`, sem dependência externa
- Codebase é minimalista. ~50 linhas total entre máscaras + validador CPF.
- `react-imask` (~5KB) seria conveniência, não necessidade. Bundle size importa pra quem ainda quer um app rápido.
- Algoritmo CPF brasileiro é trivial de implementar.

---

## Claude's Discretion

- Estilização exata dos campos (paddings, ícones específicos do Lucide).
- Mensagens de erro específicas em PT-BR.
- Estrutura interna dos hooks reusáveis (criar `useArquitetos()` ou call direto).

## Deferred Ideas

- Validação semântica CPF/CNPJ no cliente (locked como out-of-scope).
- Importar arquitetos via CSV (phase futura).
- Comissões por arquiteto (Marco 2).
- Editar arquiteto inline sem modal (descartado).
- Validador de telefone fixo de 10 dígitos (descartado pra simplificar).
- Todo "orçamento não-clicável" (out of scope desta phase — não é cadastros).
- Todo "PDF zuado" (já é Phase 5).
