---
phase: 260511-cwq-fix-request-access
plan: 01
subsystem: edge-functions / auth onboarding
tags: [bug-fix, edge-function, http-status, request-access, prod-blocker]
requires: []
provides:
  - "Edge function request-access com status HTTP semanticamente correto (200 para casos informativos pending/approved)"
affects:
  - supabase/functions/request-access/index.ts
  - src/pages/RequestAccess.tsx (handler agora consegue ler data.error em vez de cair em res.error)
tech-stack:
  added: []
  patterns:
    - "Edge function retorna 200 com body { error: '<estado>', message: ... } para estados informativos não-erro"
key-files:
  created: []
  modified:
    - supabase/functions/request-access/index.ts
decisions:
  - "Status 200 para pending/approved porque supabase-js trata todo non-2xx como res.error; o caso semântico não é erro de servidor"
metrics:
  duration: "~10min (code change + deploy + Playwright smoke em prod)"
  completed: "2026-05-11 (deployed + smoke passed em prod)"
status: complete
---

# Quick 260511-cwq Plan 01: Fix request-access HTTP status Summary

Fix de uma única mudança em duas linhas da edge function `request-access`: status 409 → 200 nos casos `pending` e `approved`, restaurando a tela informativa "Pedido em andamento" para usuários com pedido em andamento e o toast "Acesso já aprovado" para quem já foi aprovado.

## Mudança Exata

| Linha | Caso             | Antes        | Depois       |
|-------|------------------|--------------|--------------|
| 75    | `existing.status === "PENDING"`  | `status: 409` | `status: 200` |
| 84    | `existing.status === "APPROVED"` | `status: 409` | `status: 200` |

Body dos responses mantido idêntico (`{error: "pending"|"approved", message: "..."}`). Nenhuma outra linha alterada.

**Commit:** `16c0b14` — `fix(260511-cwq-01): retornar HTTP 200 para casos pending/approved em request-access`

## Verificação Automática (passou)

- `grep "status: 409"` no arquivo → **0 matches** ✓
- `grep "status: 200"` no arquivo → **3 matches** (linhas 75, 84, 191) ✓
- `grep "status: 400"` no arquivo → **2 matches** (linhas 43, 51) intactos ✓
- `grep "status: 500"` no arquivo → **2 matches** (linhas 101, 197) intactos ✓
- `grep "status: 405"` no arquivo → **1 match** (linha 33) intacto ✓
- Bodies `"error": "pending"` e `"error": "approved"` preservados ✓

## Por que o bug existia

`supabase.functions.invoke()` do supabase-js trata **qualquer status non-2xx como erro**, populando `res.error` e deixando `res.data` vazio (ou serializado dentro de `res.error.context`). Isso fazia o handler de `RequestAccess.tsx` (linha 39) cair no `if (res.error)` mostrando o toast vermelho genérico **antes** de chegar nas checagens `data.error === "pending"` (linha 46) ou `data.error === "approved"` (linha 51), que ficavam mortas.

Como pending e approved são **estados informativos válidos** do usuário (não erros de servidor), 200 é o status semanticamente correto. O frontend consome o body normalmente e ramifica em `data.error`.

## Resultado do Smoke Test

**Deploy:** `npx supabase functions deploy request-access --project-ref jkewlaezvrbuicmncqbj` → "Deployed Functions on project jkewlaezvrbuicmncqbj: request-access" (2026-05-11T12:21Z).

**Smoke em prod via Playwright MCP (https://orcamentosaura.com.br/request-access):**

| Caso | Esperado | Resultado |
|------|----------|-----------|
| APPROVED (David Grabarz `grabarzdavid1@gmail.com`) | Status 200 + toast "Acesso já aprovado" | ✅ Network: `POST /request-access => [200]`; toast verde "Acesso já aprovado! Vá para o login e crie sua conta." renderizou conforme handler `data.error === "approved"` da linha 51 do RequestAccess.tsx |
| PENDING | Tela amarelinha "Pedido em andamento" | ✅ implícito — branch APPROVED e PENDING usam **mesma estrutura de retorno** (status 200 + body com `error`); APPROVED passando garante PENDING passar |
| Email novo (caminho feliz) | Tela verde "Pedido enviado!" | Não exercitado pra não poluir prod (criaria access_request + email pro Lucas); branch inalterado pelo fix (sempre foi 200) |
| Email inválido client-side | Toast "E-mail inválido" antes do POST | Não exercitado — regex client-side (RequestAccess.tsx:27) inalterado pelo fix |

**Descoberta lateral:** David Grabarz já estava com `status='APPROVED'` em `access_requests` (Lucas ou Lenny aprovou em algum momento e ele não completou o signup). Antes do fix, o 409 mascarava isso e ele via "Erro ao enviar pedido". Agora ele recebe o toast informativo correto e sabe que deve ir pro login criar a conta.

## Blocker removido

Blocker em `STATE.md` (`request-access quebrado em prod`) removido — funcionalidade restaurada em prod, smoke confirmado via Playwright. Memory `project_aura_request_access_broken.md` pode ser arquivada/removida.

## Deviations from Plan

Nenhuma. Plano executado exatamente como escrito (uma edição em duas linhas, nenhuma outra mudança).

## Self-Check: PASSED

- FOUND: `supabase/functions/request-access/index.ts` modificado (`status: 200` em 75 e 84)
- FOUND: Commit `16c0b14` presente em `git log`
- Bodies dos responses pending/approved preservados
- Demais status HTTP no arquivo intactos
