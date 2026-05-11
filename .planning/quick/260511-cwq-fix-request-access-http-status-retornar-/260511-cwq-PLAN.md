---
phase: 260511-cwq-fix-request-access
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/functions/request-access/index.ts
autonomous: false
requirements:
  - QUICK-FIX-REQUEST-ACCESS-HTTP
must_haves:
  truths:
    - "Usuário com email PENDING em access_requests vê a tela amarelinha 'Pedido em andamento' ao submeter /request-access"
    - "Usuário com email APPROVED em access_requests vê o toast informativo 'Acesso já aprovado' (não toast de erro genérico)"
    - "Validações de input (nome curto, email inválido) continuam retornando status 400 + toast de erro"
    - "Erros internos do servidor continuam retornando status 500"
    - "Frontend supabase-js NÃO trata mais os casos pending/approved como erro (res.error fica vazio, res.data populado)"
  artifacts:
    - path: "supabase/functions/request-access/index.ts"
      provides: "Edge function de pedido de acesso com status HTTP correto para casos informativos"
      contains: "status: 200"
  key_links:
    - from: "supabase/functions/request-access/index.ts (caso PENDING)"
      to: "RequestAccess.tsx handler data.error === 'pending'"
      via: "HTTP 200 + body {error: 'pending', message: ...}"
      pattern: "status: 200.*error.*pending"
    - from: "supabase/functions/request-access/index.ts (caso APPROVED)"
      to: "RequestAccess.tsx handler data.error === 'approved'"
      via: "HTTP 200 + body {error: 'approved', message: ...}"
      pattern: "status: 200.*error.*approved"
---

<objective>
Corrigir bug em prod onde usuários com pedido de acesso PENDING ou APPROVED veem toast vermelho genérico "Erro ao enviar pedido" em vez da tela informativa correta ("Pedido em andamento" amarelinha ou toast "Acesso já aprovado").

Purpose: A edge function `request-access` retorna HTTP 409 nos casos `pending` e `approved`, e o `supabase.functions.invoke()` do supabase-js trata qualquer status non-2xx como erro — populando `res.error` e curto-circuitando o handler do frontend ANTES de chegar nas checagens `data.error === "pending"` / `data.error === "approved"`. Esses dois casos não são erros de servidor — são estados informativos válidos do usuário e devem retornar 200.

Output: Edge function deployada em prod com status 200 nos dois casos informativos. Body do response mantido idêntico (`{error: "pending"|"approved", message: ...}`). Validações 400 e erros 500 inalterados.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@supabase/functions/request-access/index.ts
@src/pages/RequestAccess.tsx

<interfaces>
<!-- Frontend handler that already exists in RequestAccess.tsx — após o fix, esse caminho passa a ser executado -->

From src/pages/RequestAccess.tsx (handleSubmit, linhas 39-62):
```typescript
if (res.error) {
  // Caminho atual (BUG): cai aqui hoje porque 409 vira res.error
  toast({ title: "Erro ao enviar pedido", ... });
  return;
}

const data = res.data as { success?: boolean; error?: string; message?: string };

if (data?.error === "pending") {
  setState("pending"); // ← Renderiza tela amarelinha "Pedido em andamento"
  return;
}

if (data?.error === "approved") {
  toast({ title: "Acesso já aprovado", description: "..." });
  return;
}
```

From supabase/functions/request-access/index.ts (linhas 68-86 — atual):
```typescript
if (existing) {
  if (existing.status === "PENDING") {
    return new Response(
      JSON.stringify({ error: "pending", message: "..." }),
      { status: 409, headers: {...} }  // ← BUG: deve ser 200
    );
  }
  if (existing.status === "APPROVED") {
    return new Response(
      JSON.stringify({ error: "approved", message: "..." }),
      { status: 409, headers: {...} }  // ← BUG: deve ser 200
    );
  }
}
```

Demais status (não mexer):
- Linha 42-45: status 400 (Nome inválido) — manter
- Linha 49-53: status 400 (E-mail inválido) — manter
- Linha 99-103: status 500 (insertError) — manter
- Linha 196-199: status 500 (catch err) — manter
- Linha 190-193: status 200 (success path) — manter
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Trocar status 409 → 200 nos casos pending e approved</name>
  <files>supabase/functions/request-access/index.ts</files>
  <action>
Editar duas linhas no arquivo `supabase/functions/request-access/index.ts`:

1. **Linha 75** — dentro do bloco `if (existing.status === "PENDING")`:
   - DE: `{ status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }`
   - PARA: `{ status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }`

2. **Linha 84** — dentro do bloco `if (existing.status === "APPROVED")`:
   - DE: `{ status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }`
   - PARA: `{ status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }`

NÃO mexer em:
- Body dos responses (manter `{error: "pending", message: "..."}` e `{error: "approved", message: "..."}` exatamente como estão)
- Status 400 das validações (Nome inválido linha 43, E-mail inválido linha 51)
- Status 500 do insertError (linha 101) e do catch (linha 197)
- Status 200 do success path (linha 191)
- Status 405 do method not allowed (linha 33)
- Qualquer outra parte do arquivo (HMAC, Resend email template, CORS headers, etc.)

Justificativa do fix: o `supabase.functions.invoke()` do supabase-js trata qualquer status non-2xx como `res.error`, populando `res.error` e deixando `res.data` vazio. Isso faz o frontend cair no `if (res.error)` da linha 39 de `RequestAccess.tsx` ANTES de conseguir checar `data.error === "pending"` (linha 46) ou `data.error === "approved"` (linha 51). Os casos pending/approved não são erros de servidor — são estados informativos válidos do usuário, então retornar 200 com `{error: "pending"|"approved"}` no body é semanticamente correto e permite o frontend reagir adequadamente.
  </action>
  <verify>
    <automated>powershell -NoProfile -Command "Select-String -Path 'supabase/functions/request-access/index.ts' -Pattern 'status: 200' | Measure-Object | Select-Object -ExpandProperty Count"</automated>
    Deve retornar pelo menos 3 (linha 75 nova, linha 84 nova, linha 191 success path original).

    Conferir manualmente também:
    - `grep -n "status: 409" supabase/functions/request-access/index.ts` → deve retornar ZERO matches
    - `grep -n "status: 400" supabase/functions/request-access/index.ts` → deve retornar 2 matches (validações intactas)
    - `grep -n "status: 500" supabase/functions/request-access/index.ts` → deve retornar 2 matches (erros intactos)
    - Body dos responses pending/approved permanece `{error: "pending"|"approved", message: "..."}` (não foi tocado)
  </verify>
  <done>
- Linhas 75 e 84 de `supabase/functions/request-access/index.ts` agora têm `status: 200`
- Nenhum outro status HTTP no arquivo foi alterado
- Bodies dos responses pending/approved permanecem idênticos
- Arquivo continua compilando (sintaxe TypeScript válida)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Deploy da edge fn em prod + smoke test manual</name>
  <what-built>
Edge function `request-access` com a correção de status HTTP (409 → 200 nos casos pending/approved). Mudança de uma única linha em dois lugares; comportamento das demais branches inalterado.

Deploy precisa ser feito manualmente pelo Lenny porque não há CI configurado pra edge functions no projeto AURA (apenas o frontend Vercel sobe automaticamente via git push). O Supabase CLI exige login interativo e seleção de projeto, o que não dá pra automatizar de dentro do agente.
  </what-built>
  <how-to-verify>
**Passo 1 — Deploy da edge function:**

Opção A (Supabase CLI, preferida se o CLI já estiver autenticado localmente):
```bash
cd C:/Users/lenny/Desktop/Luminatti/automa_aura/auraoramentos
npx supabase functions deploy request-access --project-ref jkewlaezvrbuicmncqbj
```

Opção B (Supabase Dashboard, se o CLI não estiver autenticado):
1. Abrir https://supabase.com/dashboard/project/jkewlaezvrbuicmncqbj/functions
2. Clicar em `request-access`
3. Substituir o conteúdo pelo arquivo local `supabase/functions/request-access/index.ts`
4. Salvar e deployar

**Passo 2 — Smoke test em prod (https://auraoramentos-kappa.vercel.app/request-access):**

Caso 1 — email PENDING (David Grabarz já tem registro PENDING):
1. Abrir https://auraoramentos-kappa.vercel.app/request-access em janela anônima
2. Preencher Nome: "David Grabarz" / E-mail: o e-mail do David (já em PENDING no DB)
3. Clicar "Solicitar Acesso"
4. **Esperado:** tela amarelinha aparece com ícone de relógio (Clock), título "Pedido em andamento" e texto "Seu pedido para [email] já está aguardando aprovação..."
5. **Console DevTools:** NÃO deve mais aparecer erro 409 com `non-2xx status`. A request deve responder 200.

Caso 2 — email novo (caminho feliz, pra garantir que não quebrou nada):
1. Mesma página, preencher com um e-mail novo qualquer
2. **Esperado:** tela verde "Pedido enviado!" (state="success") e e-mail chega no `ADMIN_EMAIL` (Lenny) via Resend
3. **Console DevTools:** request retorna 200

Caso 3 — validação (não regrediu):
1. Submeter form com email inválido (ex: "naoehemail")
2. **Esperado:** toast vermelho "E-mail inválido" — comportamento atual mantido (400)

**Console JS:** verificar que NÃO aparece mais `request-access...status of 409` em Caso 1.
  </how-to-verify>
  <resume-signal>
Digite "approved" se:
- Caso 1 mostrou tela amarelinha "Pedido em andamento" para o David (sem toast vermelho)
- Caso 2 (novo email) ainda funciona (caminho feliz íntegro)
- Caso 3 (email inválido) ainda mostra toast de erro de validação

Ou descreva qual caso falhou + screenshot do console.
  </resume-signal>
</task>

</tasks>

<verification>
**Verificação automática:**
- `supabase/functions/request-access/index.ts` não contém mais `status: 409` em nenhum lugar
- Os strings `"error": "pending"` e `"error": "approved"` continuam presentes no body
- Demais status (400 x2, 500 x2, 200 success x1, 405 x1) intactos

**Verificação manual (Task 2):**
- Smoke test em prod com email já PENDING renderiza tela amarelinha
- Smoke test com email novo continua funcionando (sucesso + e-mail admin)
- Smoke test com email inválido continua exibindo toast de validação
- Console DevTools sem erros 409
</verification>

<success_criteria>
- David Grabarz (e Lenny, e qualquer outro usuário com pedido PENDING) submetem o form de `/request-access` em prod e veem a tela informativa correta ("Pedido em andamento" amarelinha) em vez do toast vermelho genérico "Erro ao enviar pedido"
- Usuários com email já APPROVED veem o toast "Acesso já aprovado" (não toast de erro)
- Caminho feliz (email novo) continua disparando o e-mail pro admin e mostrando a tela verde de sucesso
- Validações de input (nome curto, email inválido) e erros internos do servidor continuam comportando-se como erros (toast vermelho), com status HTTP correspondente (400 e 500)
- Blocker do STATE.md "(fora do marco) `request-access` quebrado em prod desde 2026-05-11" pode ser removido
</success_criteria>

<output>
After completion, create `.planning/quick/260511-cwq-fix-request-access-http-status-retornar-/260511-cwq-SUMMARY.md` documenting:
- Mudança exata (linhas 75 e 84: 409 → 200)
- Resultado do smoke test nos 3 casos (PENDING / novo / inválido)
- Confirmação de que blocker em STATE.md pode ser fechado
</output>
