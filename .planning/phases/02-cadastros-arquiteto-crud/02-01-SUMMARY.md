---
phase: 02-cadastros-arquiteto-crud
plan: 01
subsystem: cadastros-base
tags: [masks, validators, edge-function, signup, pii]
requirements:
  completed: [USR-01, USR-02, USR-03]
dependency_graph:
  requires:
    - "supabase/migrations/20260423000004_colaboradores_cpf_telefone_setor.sql (Phase 1 — schema base com colunas cpf/telefone/setor + CHECK)"
  provides:
    - "src/lib/masks.ts — 4 helpers puros: formatCPF, formatTelefone, formatCpfCnpj, unmask"
    - "src/lib/validators.ts — 2 validadores: validateCPF (algoritmo BR), validateTelefone (DDD 11-99)"
    - "supabase/functions/create-colaborador (deployed) — aceita cpf/telefone/setor + valida setor"
  affects:
    - "src/pages/Auth.tsx (Plan 02-02 — signup expandido vai consumir masks + validators + nova edge)"
    - "src/pages/PerfilCompletar.tsx (Plan 02-02 — backfill USR-04 vai usar mesmos helpers)"
    - "src/components/ClienteList.tsx (Plan 02-04 — formCpfCnpj vai entrar no form de cliente)"
tech_stack:
  added: []
  patterns:
    - "Helpers puros sem dependência externa (D-11) — regex em vez de react-input-mask/imask"
    - "Validador CPF rejeita os 10 casos com dígitos repetidos (000... a 999...) — passam no algoritmo mas inválidos pela Receita"
    - "Defesa em profundidade no edge function: server-side valida setor contra lista fixa antes do DB CHECK pegar"
    - "PII (cpf/telefone) nunca vai pra console.log/error (T-02-02 mitigado)"
key_files:
  created:
    - "src/lib/masks.ts"
    - "src/lib/validators.ts"
  modified:
    - "supabase/functions/create-colaborador/index.ts"
decisions:
  - "Sem deps externas pra máscara/validação — codebase é minimalista e ~80 linhas total não compensa adicionar pacote"
  - "validateCPF rejeita explicitamente os 10 casos de dígitos repetidos — algoritmo padrão sozinho aceitaria"
  - "validateTelefone só celular BR 11 dígitos — fixo 10 dígitos descartado por simplicidade (D-10)"
  - "Edge function valida setor server-side (defesa em profundidade) mesmo com DB CHECK constraint — não confiar só na DB"
  - "Edge function NÃO re-valida CPF — defesa em profundidade aceita risco T-02-03 (CPF inválido = problema de dado, não segurança)"
metrics:
  duration: "~12min"
  completed: "2026-04-27"
  tasks_completed: 3
  files_changed: 3
  commits: 3
---

# Phase 02 Plan 01: Base de Cadastros (Masks + Validators + Edge Function) Summary

Base reusável criada — 4 helpers de máscara puros (CPF/telefone/CPF-CNPJ-auto/unmask), 2 validadores BR (CPF com algoritmo Receita Federal + telefone com DDD), e edge function `create-colaborador` expandida pra aceitar `cpf/telefone/setor` no body com validação server-side de setor; deploy em prod confirmado, sem deps externas, sem PII em log.

## What Was Built

### `src/lib/masks.ts` (novo, 42 linhas, 4 exports)

Helpers puros sem dependência externa, idempotentes:

| Função | Comportamento |
|--------|---------------|
| `formatCPF(value)` | Aplica `000.000.000-00`. `formatCPF("12345678901")` → `"123.456.789-01"`. Aceita string parcial e string já mascarada (idempotente). |
| `formatTelefone(value)` | Aplica `(00) 00000-0000`. Suporta apenas celular BR 11 dígitos. `formatTelefone("11987654321")` → `"(11) 98765-4321"`. |
| `formatCpfCnpj(value)` | Auto-detecta: ≤11 dígitos = CPF (`000.000.000-00`), 12-14 dígitos = CNPJ (`00.000.000/0000-00`). Usado pelo form de cliente (CLI-02). |
| `unmask(value)` | Remove qualquer caractere não-numérico. `unmask("123.456.789-01")` → `"12345678901"`. Use antes de salvar. |

### `src/lib/validators.ts` (novo, 42 linhas, 2 exports)

Validadores BR puros, importam `unmask` via `@/lib/masks`:

| Função | Comportamento |
|--------|---------------|
| `validateCPF(cpf)` | Algoritmo de dígitos verificadores (Receita Federal). Aceita string com ou sem máscara. **Rejeita explicitamente** os 10 casos de dígitos repetidos (`000.000.000-00` a `999.999.999-99`) — passam no algoritmo mas são considerados inválidos. |
| `validateTelefone(tel)` | Exige 11 dígitos após desmascarar e DDD entre 11 e 99. Não valida operadora. |

**Sanidade rodada com node antes do commit**: 9 casos de CPF (3 válidos + 6 inválidos) + 6 casos de telefone (2 válidos + 4 inválidos) — todos bateram com o `<behavior>` do plan (15/15).

### `supabase/functions/create-colaborador/index.ts` (modificado, +22/-2)

Expandido para aceitar 3 campos novos no body, mantendo retrocompat:

- **Body novo**: `{ nome, cargo, departamento, user_id, cpf?, telefone?, setor? }` — todos os 3 novos opcionais (`null` se não enviar).
- **Validação server-side de `setor`**: array fixo `["comercial", "projetos", "logistica", "financeiro"]`, retorna 400 se valor inválido — defesa em profundidade vs CHECK constraint do DB (mitiga **T-02-01**).
- **Insert atualizado**: as 3 colunas novas usam pattern `value || null` igual `cargo`/`departamento`.
- **PII protection**: zero `console.log/error/warn/info/debug` em todo o arquivo — `cpf`/`telefone` não vazam em log do Supabase Functions (mitiga **T-02-02**).
- **Backward-compat**: chamadas legacy `{ nome, user_id, cargo?, departamento? }` continuam funcionando (cpf/telefone/setor viram `null`). **Gap 3 do Phase 1 não regride.**

## Public API Exported (para Plans 02-02 e 02-04 consumirem)

```typescript
// src/lib/masks.ts
export function formatCPF(value: string): string;
export function formatTelefone(value: string): string;
export function formatCpfCnpj(value: string): string;
export function unmask(value: string): string;

// src/lib/validators.ts
export function validateCPF(cpf: string): boolean;
export function validateTelefone(tel: string): boolean;
```

Importar via `@/lib/masks` e `@/lib/validators` (alias, nunca path relativo — convenção do projeto).

## Edge Function Deploy

**Comando executado:**
```
supabase functions deploy create-colaborador --project-ref jkewlaezvrbuicmncqbj
```

**Resultado:**
```
Uploading asset (create-colaborador): supabase/functions/create-colaborador/index.ts
Deployed Functions on project jkewlaezvrbuicmncqbj: create-colaborador
```

Deploy bem-sucedido em prod (`jkewlaezvrbuicmncqbj`). Dashboard: https://supabase.com/dashboard/project/jkewlaezvrbuicmncqbj/functions

Warning de Docker não-rodando é esperado/inofensivo (Supabase CLI usa Docker só pra `serve` local — `deploy` faz upload direto e não precisa).

## Threat Mitigations Applied

| Threat | Disposition | Status |
|--------|-------------|--------|
| **T-02-01** Tampering em body do edge function | mitigate | ✓ Server-side valida `setor` contra lista fixa antes do insert; `nome`/`user_id` continuam obrigatórios. |
| **T-02-02** PII em logs | mitigate | ✓ Zero `console.*` no arquivo — confirmado por `grep`. Apenas `error.message` do Supabase é repassado ao client (não inclui body). |
| **T-02-03** Client-side validators bypass | accept | Aceito por design — CPF inválido = problema de dado, não de segurança. |
| **T-02-04** Spoofing de signup | accept | Reusa pattern existente: `allowed_users` gate + `user_id` legítimo do `auth.signUp`. |
| **T-02-05** DoS no edge function público | accept | Marco focado em features. Supabase rate-limita 100 req/min por padrão. |

## Smoke Tests

**Smoke manual fica pra Plan 02-02** que vai consumir tudo (signup expandido) — a maneira mais natural de smokear a stack inteira é abrir o form de signup com os campos novos, validar inline, submeter, ver o registro no banco com cpf/telefone/setor preenchidos. Smokear isolado nesta plan exigiria curl artificial.

**Sanidade dos validadores** já foi rodada (15/15 casos do `<behavior>` — ver acima na seção `validators.ts`).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Criar `src/lib/masks.ts` com 4 helpers puros | `336b95c` |
| 2 | Criar `src/lib/validators.ts` com `validateCPF` + `validateTelefone` | `d08510e` |
| 3 | Expandir edge function `create-colaborador` para aceitar cpf/telefone/setor + redeploy em prod | `26a372d` |

## Deviations from Plan

None — plano executado exatamente como escrito. As 3 tasks foram concluídas sem auto-fix nem checkpoint.

Único ajuste menor de estilo (não-deviation): strings em `masks.ts` usam single-quotes (`'\D'`, `''`) em vez das duplas do exemplo — alinhado à convenção do CLAUDE.md root ("Single quotes for string literals in TypeScript/TSX"). Comportamento e API são idênticos.

## Authentication Gates

Nenhum — Supabase CLI já estava autenticado nesta máquina, deploy passou direto sem prompt.

## Verification Results

Todos os 8 critérios do `<verification>` block passaram:

- [x] `npx tsc --noEmit` exit 0
- [x] `grep "export function" src/lib/masks.ts | wc -l` → 4
- [x] `grep "export function" src/lib/validators.ts | wc -l` → 2
- [x] `grep "cpf || null" supabase/functions/create-colaborador/index.ts` → 1 match
- [x] `grep "telefone || null" supabase/functions/create-colaborador/index.ts` → 1 match
- [x] `grep "setor || null" supabase/functions/create-colaborador/index.ts` → 1 match
- [x] `grep "validSetores" supabase/functions/create-colaborador/index.ts` → 3 matches
- [x] Deploy `supabase functions deploy create-colaborador --project-ref jkewlaezvrbuicmncqbj` exit 0

## Self-Check: PASSED

**Files verified to exist:**
- ✓ `src/lib/masks.ts`
- ✓ `src/lib/validators.ts`
- ✓ `supabase/functions/create-colaborador/index.ts` (modificado)

**Commits verified to exist (via `git log --oneline -5`):**
- ✓ `336b95c` — feat(02-01): add CPF/telefone/CNPJ mask helpers
- ✓ `d08510e` — feat(02-01): add validateCPF (BR algorithm) and validateTelefone
- ✓ `26a372d` — feat(02-01): expand create-colaborador to accept cpf/telefone/setor

**Truths from must_haves:**
- ✓ Frontend tem helpers puros formatCPF, formatTelefone, formatCpfCnpj, unmask em src/lib/masks.ts
- ✓ Frontend tem validateCPF (algoritmo BR) e validateTelefone em src/lib/validators.ts
- ✓ validateCPF rejeita os 10 casos com dígitos repetidos
- ✓ Edge function create-colaborador aceita cpf, telefone, setor no body e grava nas colunas novas
- ✓ Edge function valida setor contra a lista (comercial|projetos|logistica|financeiro) antes do insert
