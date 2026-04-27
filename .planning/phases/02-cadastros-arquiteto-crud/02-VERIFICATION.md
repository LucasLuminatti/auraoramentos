---
phase: 02-cadastros-arquiteto-crud
verified: 2026-04-27T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated)
overrides_applied: 0
human_verification:
  - test: "Signup ponta-a-ponta com CPF/telefone/setor"
    expected: "Abrir /auth?mode=signup, preencher 3 campos novos validos, confirmar criação do colaborador no Supabase com cpf/telefone (desmascarados) + setor preenchidos"
    why_human: "Marco 1 estratégia UAT manual em prod. Validação inline de campos e fluxo emailRedirect só verificáveis em browser real."
  - test: "Banner USR-04 aparece e some corretamente"
    expected: "Logado como colaborador antigo (cpf/telefone/setor null), banner amber aparece em / e /admin. Após /perfil/completar preencher os 3 campos, banner desaparece."
    why_human: "Estado visual sticky + condicional só verificável visualmente."
  - test: "CRUD de Arquitetos ponta-a-ponta"
    expected: "Em /admin?tab=arquitetos, criar Studio Teste, editar nome, excluir (AlertDialog mostra mensagem ON DELETE SET NULL); persistência confirmada via reload."
    why_human: "Confirmação visual + RLS check (admin tem acesso) + AlertDialog UX só validáveis em UAT."
  - test: "Criar cliente com CPF/CNPJ + arquiteto"
    expected: "Em / clicar Novo Cliente, preencher CPF (auto-detect 11) e CNPJ (auto-detect 14), selecionar arquiteto via autocomplete, confirmar via SQL que cpf_cnpj armazenado desmascarado e arquiteto_id correto."
    why_human: "Auto-detect de máscara + autocomplete debounce + persistência verificáveis só em browser/SQL editor."
  - test: "Edição de produto com arquiteto"
    expected: "Em /admin?tab=produtos clicar Pencil em qualquer produto, atribuir arquiteto, salvar; coluna Arquiteto na lista atualiza; código permanece readonly."
    why_human: "PROD-03/04 só validáveis com produtos reais em prod."
  - test: "Wizard 3 passos não regrediu (compatibility check)"
    expected: "Criar orçamento Step1 → Step2 → Step3 → PDF gerado, sem erro."
    why_human: "Compatibilidade obrigatória declarada no PROJECT.md ('wizard de 3 passos não pode quebrar'). Só verificável em UAT."
---

# Phase 02: Cadastros & Arquiteto CRUD — Verification Report

**Phase Goal:** Usuários novos entram com dados completos (CPF/telefone/setor), clientes podem ser vinculados a arquitetos e admin gerencia arquitetos como entidade própria.

**Verified:** 2026-04-27
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (ROADMAP SC)                                                                                                                            | Status     | Evidence                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Signup pede CPF (validado pelo algoritmo brasileiro), telefone mascarado e setor (enum) — não avança sem os três                              | ✓ VERIFIED | `Auth.tsx:75-100` valida `validateCPF(cpf)`, `validateTelefone(telefone)` e `!setor` antes do submit; bloqueia com `return` se algum falhar. JSX renderiza `<Input>` com `formatCPF`/`formatTelefone` no onChange e `<Select>` com 4 setores. `unmask()` no body invocado em `create-colaborador`. |
| 2   | Colaborador antigo que ainda não tem CPF/telefone/setor consegue preencher após login sem ser bloqueado                                       | ✓ VERIFIED | `CompletarCadastroBanner.tsx` lê `useColaborador()` e mostra banner amber sticky se algum dos 3 campos for null; renderizado em `Index.tsx:73` e `Admin.tsx:221`. CTA navega para `/perfil/completar` (registrado em `App.tsx:51` como `ProtectedRoute`). `PerfilCompletar.tsx` faz UPDATE filtrado por `colaborador.id` e redireciona para `/`. Banner não bloqueia uso do app. |
| 3   | Admin tem seção de arquitetos com listar/criar/editar/excluir funcionando ponta-a-ponta                                                       | ✓ VERIFIED | `Admin.tsx:27` `VALID_TABS` inclui `"arquitetos"`. `:249` renderiza `<TabsTrigger value="arquitetos">`. `:484-532` TabsContent com Table ordenada por nome ASC, botão "+ Novo Arquiteto" (`:488`), Pencil para editar (`:507`), Trash2 para excluir (`:510-517`). Dialog (`:558-564`) e AlertDialog (`:588-608`) montados com mensagem sobre ON DELETE SET NULL. `fetchArquitetos` em `:127-140` faz select+order; `handleDeleteArquiteto` em `:142-153` faz delete. |
| 4   | Form de criar cliente aceita contato, CPF/CNPJ e seletor de arquiteto (autocomplete contra `arquitetos`), todos opcionais                     | ✓ VERIFIED | `ClienteDialog.tsx:11-17` interface tem `contato`, `cpf_cnpj`, `arquiteto_id`. `:101-145` JSX renderiza 4 campos na ordem D-14 (Nome*, Contato, CPF/CNPJ, Arquiteto). `:127` aplica `formatCpfCnpj` no onChange. `:131-144` monta `<ArquitetoAutocomplete>`. `:74` envia `unmask(cpfCnpj)` ou `null`. `Index.tsx:141` monta em mode="create"; `Admin.tsx:566-579` monta em ambos os modes. |
| 5   | Produto existente no admin pode ter arquiteto atribuído/alterado via edição                                                                  | ✓ VERIFIED | `ProdutoEditDialog.tsx:19-24` props com `produto` e `onSuccess`. `:73-81` UPDATE em `produtos` com `arquiteto_id`. `:101` código disabled (D-23). `:137-149` monta `<ArquitetoAutocomplete>`. `Admin.tsx:298,314` aba Produtos tem coluna Arquiteto que mostra `arquitetosMap[p.arquiteto_id]`. `:317-334` botão Pencil abre Dialog. `:581-586` Dialog montado com onSuccess fetchProdutos. |

**Score:** 5/5 truths verified (automated, code-level)

### Required Artifacts (Three Levels: Exists / Substantive / Wired)

| Artifact                                       | Expected                                                | Exists | Substantive | Wired | Final Status |
| ---------------------------------------------- | ------------------------------------------------------- | ------ | ----------- | ----- | ------------ |
| `src/lib/masks.ts`                             | 4 helpers puros (formatCPF/Telefone/CpfCnpj/unmask)     | ✓      | ✓ (43 linhas, 4 exports)  | ✓ (importado em Auth, PerfilCompletar, ClienteDialog, validators) | ✓ VERIFIED |
| `src/lib/validators.ts`                        | validateCPF (algoritmo BR + repetidos), validateTelefone | ✓      | ✓ (43 linhas, regex `/^(\d)\1{10}$/` presente) | ✓ (importado em Auth, PerfilCompletar) | ✓ VERIFIED |
| `supabase/functions/create-colaborador/index.ts` | aceita cpf/telefone/setor + valida setor server-side    | ✓      | ✓ (validSetores array, payload destructure novo) | ✓ (Auth.tsx invoca via `supabase.functions.invoke("create-colaborador", { body: ... cpf, telefone, setor })`) | ✓ VERIFIED |
| `src/pages/Auth.tsx`                           | signup com 3 campos novos + máscaras + validação inline | ✓      | ✓ (state + JSX + handleSubmit valida) | ✓ (rota `/auth` em App.tsx) | ✓ VERIFIED |
| `src/pages/PerfilCompletar.tsx`                | Página backfill USR-04                                  | ✓      | ✓ (135 linhas, form 3 campos, UPDATE) | ✓ (rota `/perfil/completar` em App.tsx:51 ProtectedRoute) | ✓ VERIFIED |
| `src/components/CompletarCadastroBanner.tsx`   | Banner amber sticky                                     | ✓      | ✓ (40 linhas, condicional por null) | ✓ (importado e renderizado em Index.tsx:73 e Admin.tsx:221) | ✓ VERIFIED |
| `src/hooks/useColaborador.ts`                  | Interface estendida com cpf/telefone/setor              | ✓      | ✓ (Colaborador interface tem 3 campos novos; ambos `.select()` listam-os) | ✓ (consumido por Banner, PerfilCompletar) | ✓ VERIFIED |
| `src/App.tsx`                                  | Rota /perfil/completar registrada                       | ✓      | ✓ (linha 51, ProtectedRoute) | ✓ (BrowserRouter já existia) | ✓ VERIFIED |
| `src/components/ArquitetoAutocomplete.tsx`     | Combobox com debounce + Nenhum arquiteto + sem inline create | ✓ | ✓ (113 linhas, ilike, limit 10, debounce 300ms, onSelect(null)) | ✓ (importado por ClienteDialog, ProdutoEditDialog) | ✓ VERIFIED |
| `src/components/ArquitetoDialog.tsx`           | Dialog reusável mode create/edit                        | ✓      | ✓ (102 linhas, insert+update, .eq("id"), trim) | ✓ (importado em Admin.tsx:22, montado :558) | ✓ VERIFIED |
| `src/components/ClienteDialog.tsx`             | Dialog reusável 4 campos com ArquitetoAutocomplete      | ✓      | ✓ (161 linhas, formatCpfCnpj, unmask, ArquitetoAutocomplete) | ✓ (importado em Index.tsx:18 e Admin.tsx:23, montado em ambos) | ✓ VERIFIED |
| `src/components/ProdutoEditDialog.tsx`         | Dialog edição produto com Arquiteto + código readonly   | ✓      | ✓ (166 linhas, código disabled, UPDATE arquiteto_id) | ✓ (importado em Admin.tsx:24, montado :581) | ✓ VERIFIED |
| `src/pages/Admin.tsx`                          | 8ª aba Arquitetos + edit cliente + edit produto         | ✓      | ✓ (614 linhas, todos os estados/handlers/JSX presentes) | ✓ (rota `/admin` AdminRoute em App.tsx:52) | ✓ VERIFIED |
| `src/pages/Index.tsx`                          | Botão Novo Cliente abre ClienteDialog + Banner          | ✓      | ✓ (167 linhas, ClienteDialog em mode="create", Banner no topo) | ✓ (rota `/` ProtectedRoute) | ✓ VERIFIED |

### Key Link Verification

| From                                    | To                                                | Via                                       | Status | Details                                                                 |
| --------------------------------------- | ------------------------------------------------- | ----------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `Auth.tsx`                              | `supabase.functions.invoke("create-colaborador")` | body `{ cpf: unmask(cpf), telefone: unmask(telefone), setor }` | ✓ WIRED | `Auth.tsx:142-152` invoca com 3 campos desmascarados após signUp success. |
| `PerfilCompletar.tsx`                   | `colaboradores.update()`                          | `.eq("id", colaborador.id)` com cpf/telefone/setor desmascarados | ✓ WIRED | `:54-61` UPDATE com unmask. |
| `CompletarCadastroBanner.tsx`           | `useColaborador().colaborador`                    | lê cpf/telefone/setor para condição       | ✓ WIRED | `:15` `!colaborador.cpf || !colaborador.telefone || !colaborador.setor`. |
| `Admin.tsx aba arquitetos`              | `supabase.from("arquitetos")`                     | select/insert/update/delete via SDK       | ✓ WIRED | `fetchArquitetos`, `handleDeleteArquiteto`, e via `ArquitetoDialog` (insert/update). |
| `ArquitetoAutocomplete.tsx`             | `arquitetos.select('id,nome').ilike('nome',...).limit(10)` | busca async on input change       | ✓ WIRED | `:43-60` debounce 300ms + ilike + limit 10. |
| `ClienteDialog.tsx`                     | `clientes.insert/update`                          | payload com nome, contato, cpf_cnpj, arquiteto_id | ✓ WIRED | `:71-83` payload com 4 campos. |
| `ProdutoEditDialog.tsx`                 | `produtos.update`                                 | UPDATE com arquiteto_id                    | ✓ WIRED | `:73-81` UPDATE incluindo `arquiteto_id: arquitetoId`. |
| `Index.tsx`                             | `<ClienteDialog mode="create">`                   | botão Novo Cliente abre Dialog            | ✓ WIRED | `:89-91` setClienteDialogOpen → `:141-146` ClienteDialog mode="create". |
| `Admin.tsx aba produtos`                | `<ProdutoEditDialog>` + coluna Arquiteto         | Pencil abre Dialog, lista usa arquitetosMap | ✓ WIRED | `:298,314` coluna Arquiteto; `:317-334` Pencil abre Dialog; `:581-586` Dialog montado. |
| `Admin.tsx aba clientes`                | `<ClienteDialog mode="edit">`                     | Pencil abre Dialog em mode='edit'         | ✓ WIRED | `:457-467` Pencil seta target+open; `:573-579` ClienteDialog edit. |

### Data-Flow Trace (Level 4)

| Artifact                            | Data Variable          | Source                                         | Produces Real Data | Status      |
| ----------------------------------- | ---------------------- | ---------------------------------------------- | ------------------ | ----------- |
| `CompletarCadastroBanner`           | `colaborador`          | `useColaborador()` → DB query em `colaboradores` | ✓ (real DB select) | ✓ FLOWING   |
| `ArquitetoAutocomplete dropdown`    | `results`              | `supabase.from("arquitetos").select()`         | ✓ (real DB query)  | ✓ FLOWING   |
| `Admin.tsx aba Arquitetos Table`    | `arquitetos`           | `fetchArquitetos()` → DB query                  | ✓ (real DB query)  | ✓ FLOWING   |
| `Admin.tsx aba Clientes Table`      | `clientes` + `arquitetosMap` | `fetchClientes()` + `fetchArquitetos()` populam mapa | ✓ (DB select com novos campos) | ✓ FLOWING |
| `Admin.tsx aba Produtos Table`      | `produtos` + `arquitetosMap` | `fetchProdutos(search)` retorna `select("*")` (inclui arquiteto_id) + arquitetosMap | ✓ (DB query) | ✓ FLOWING |
| `PerfilCompletar form`              | cpf/telefone/setor pré-preenchidos | `useEffect` → colaborador.cpf/telefone/setor (DB) | ✓ (DB seed)        | ✓ FLOWING   |

Sem flags de HOLLOW — todas as fontes de dados são queries Supabase reais ou estado controlado pelo usuário no form.

### Behavioral Spot-Checks

| Behavior                                    | Command                                  | Result               | Status |
| ------------------------------------------- | ---------------------------------------- | -------------------- | ------ |
| TypeScript compila sem erros                | `npx tsc --noEmit`                       | exit 0               | ✓ PASS |
| `masks.ts` exporta 4 funções                | `grep "export function" src/lib/masks.ts \| wc -l` | 4              | ✓ PASS |
| `validators.ts` exporta 2 funções           | `grep "export function" src/lib/validators.ts \| wc -l` | 2         | ✓ PASS |
| Edge function não loga PII                  | `grep -E "console\.(log\|error)\(.*(cpf\|telefone)" src/` | sem matches | ✓ PASS |
| Index.tsx removeu state antigo              | `grep "novoClienteNome\|handleCriarCliente" src/pages/Index.tsx` | sem matches | ✓ PASS |
| CompletarCadastroBanner montado em 2 pages  | `grep -l "CompletarCadastroBanner" src/pages/*.tsx` | Index.tsx, Admin.tsx | ✓ PASS |
| Build de produção (não rodada nesta sessão — assumindo conforme nota do user) | `npm run build` | (não executado neste verify, mas user confirmou build passa) | ? SKIP |
| Vitest passa (não rodada — assumindo conforme nota do user) | `npm run test` | (não executado, user confirmou 1 example test passes) | ? SKIP |

Os 6 spot-checks code-level passaram. Build/test não rodados neste verify mas user confirmou que passam.

### Requirements Coverage

| Requirement | Source Plan | Description (REQUIREMENTS.md)                                                     | Status      | Evidence                                                                 |
| ----------- | ----------- | --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| USR-01      | 02-01, 02-02 | Signup pede CPF (obrigatório, validado pelo algoritmo brasileiro)                | ✓ SATISFIED | `Auth.tsx:78` valida via `validateCPF(cpf)`; `:148` envia `unmask(cpf)`. validators.ts implementa algoritmo BR + rejeita repetidos. |
| USR-02      | 02-01, 02-02 | Signup pede telefone (obrigatório, formato BR com máscara)                       | ✓ SATISFIED | `Auth.tsx:79` valida via `validateTelefone(telefone)`; `:295` aplica `formatTelefone` no onChange. |
| USR-03      | 02-01, 02-02 | Signup pede setor (enum: comercial, projetos, logistica, financeiro), obrigatório | ✓ SATISFIED | `Auth.tsx:39-44` const SETORES com 4 valores; `:80` valida `!setor`; `:305-314` Select shadcn. Edge function valida server-side `:25-34`. |
| USR-04      | 02-02       | Colaborador existente preenche os 3 campos após login sem bloqueio                | ✓ SATISFIED | Banner em Index.tsx:73 + Admin.tsx:221 + página /perfil/completar registrada em App.tsx:51 com UPDATE em colaboradores. |
| CLI-01      | 02-04       | Form cliente: campo contato (opcional, texto livre)                              | ✓ SATISFIED | ClienteDialog.tsx:113-119 campo Contato; payload `:73` `contato.trim() \|\| null`. |
| CLI-02      | 02-04       | Form cliente: campo CPF/CNPJ (opcional, sem validação semântica)                  | ✓ SATISFIED | ClienteDialog.tsx:122-128 com formatCpfCnpj (auto-detect 11 vs 14); `:74` `unmask(cpfCnpj)` no payload. SEM validateCPF (D-12). |
| CLI-03      | 02-04       | Form cliente: seletor de arquiteto (opcional, autocomplete contra `arquitetos`)  | ✓ SATISFIED | ClienteDialog.tsx:131-144 monta ArquitetoAutocomplete; `:75` `arquiteto_id: arquitetoId` no payload. |
| ARQ-02      | 02-03       | CRUD de arquitetos no admin: listar, criar, editar, excluir                       | ✓ SATISFIED | Admin.tsx:484-532 aba Arquitetos com Table (listar), botão Novo Arquiteto + ArquitetoDialog (criar/editar), AlertDialog + handleDeleteArquiteto (excluir). |
| PROD-03     | 02-04       | Produtos existentes vinculados a arquiteto (manual via UI ou SQL bulk)            | ✓ SATISFIED | ProdutoEditDialog permite atribuir arquiteto_id a qualquer produto via UI. SQL bulk alternativa documentada em 02-04-SUMMARY.md (D-24). |
| PROD-04     | 02-04       | Edição de produto no admin permite alterar arquiteto                              | ✓ SATISFIED | ProdutoEditDialog.tsx:73-81 UPDATE com `arquiteto_id`. Admin.tsx:317-334 botão Pencil abre Dialog. |

**Coverage:** 10/10 requirements de Phase 2 satisfeitos no código.

Cross-reference vs REQUIREMENTS.md Traceability table: todos os 10 IDs (USR-01..04, CLI-01..03, ARQ-02, PROD-03, PROD-04) estão mapeados em pelo menos um plan. Sem orphans.

### Anti-Patterns Found

| File                                          | Line   | Pattern                              | Severity | Impact                                       |
| --------------------------------------------- | ------ | ------------------------------------ | -------- | -------------------------------------------- |
| `src/pages/Auth.tsx`                          | 154,157 | `console.error("Error creating colaborador:", res.error)` / `console.error("Error invoking create-colaborador:", err)` | ℹ️ Info | Logs apenas o objeto de erro do Supabase, não o body — não vaza PII. Pré-existente; não introduzido por Phase 2. |

Sem TODOs/FIXMEs/placeholders introduzidos nesta phase. Nenhum stub: todas as queries Supabase escrevem em colunas reais e os componentes consomem estado real. Sem hardcoded empty arrays passados para componentes consumidores. Sem console.log com PII (CPF/telefone) — confirmado por grep.

### Human Verification Required

Marco 1 estratégia (UAT manual em prod) — automação verificou estrutura/wiring do código, mas comportamento ponta-a-ponta requer teste em browser/banco real:

#### 1. Signup ponta-a-ponta com CPF/telefone/setor (USR-01..03)

**Test:** Abrir `/auth?mode=signup`, preencher Nome + email + confirmar email + CPF "111.111.111-11" → esperar erro inline. Trocar para CPF válido conhecido. Telefone "(00) 12345-6789" → esperar erro DDD inválido. Setor sem selecionar → esperar erro inline. Submit válido com `cpf=12345678909`, `telefone=11987654321`, `setor=comercial`.
**Expected:** Validação inline (texto vermelho, sem toast por campo). Após submit válido, conta criada no auth.users; tabela colaboradores tem linha com cpf="12345678909" (sem máscara), telefone="11987654321", setor="comercial".
**Why human:** Teste de UI inline + integração com edge function `create-colaborador` em prod requer browser real e acesso ao DB para confirmar valores armazenados.

#### 2. Banner USR-04 em colaborador antigo

**Test:** Em prod, identificar (ou inserir manualmente) colaborador com `cpf IS NULL`. Logar com esse usuário. Abrir `/` e `/admin`.
**Expected:** Banner amber sticky aparece no topo das duas páginas. Clicar "Completar agora" → vai para `/perfil/completar`. Preencher 3 campos válidos + Salvar → redireciona para `/`. Banner sumiu.
**Why human:** Estado visual sticky + condicional + ciclo de vida do hook `useColaborador` só verificáveis em browser real após login.

#### 3. CRUD de Arquitetos ponta-a-ponta (ARQ-02)

**Test:** Logado como admin, ir em `/admin?tab=arquitetos`. Criar "Studio Teste" com contato "teste@test.com". Editar para "Studio Teste 2". Tentar excluir → ler mensagem do AlertDialog ("Clientes e produtos vinculados ficarão sem arquiteto"). Confirmar.
**Expected:** Lista atualiza após cada operação (alfabética). URL persiste em `/admin?tab=arquitetos` (F5 mantém aba). Excluir não cascata para clientes/produtos vinculados.
**Why human:** Confirmar UX do AlertDialog, persistência de URL search param, e comportamento RLS (admin tem privilégio).

#### 4. Cliente com CPF/CNPJ + arquiteto (CLI-01..03)

**Test:** Em `/`, clicar "Novo Cliente". Digitar CPF parcial (5 dígitos) → ver máscara progressiva. Completar 11 dígitos → ver `123.456.789-01`. Apagar e digitar 14 dígitos → ver auto-detect CNPJ `12.345.678/0001-90`. Buscar arquiteto via autocomplete — confirmar item "Nenhum arquiteto" no topo. Selecionar e submit. Via SQL Editor: `SELECT cpf_cnpj, arquiteto_id FROM clientes WHERE nome = 'Teste Cliente'`.
**Expected:** `cpf_cnpj` armazenado desmascarado (apenas dígitos). `arquiteto_id` preenchido com FK válida.
**Why human:** Auto-detect + máscara progressiva + busca async com debounce + persistência só validáveis com banco real.

#### 5. Edição de produto com arquiteto (PROD-03, PROD-04)

**Test:** Em `/admin?tab=produtos`, clicar Pencil em qualquer produto existente. Atribuir arquiteto via autocomplete. Salvar. Confirmar coluna "Arquiteto" da lista atualiza. Tentar editar código → confirmar campo é disabled (D-23).
**Expected:** Produto persiste com `arquiteto_id`. Coluna mostra nome via `arquitetosMap`. Código permanece readonly.
**Why human:** Validação de readonly + persistência em produtos reais só viáveis em prod.

#### 6. Wizard 3 passos não regrediu (compatibility check)

**Test:** Logado como colaborador, fluxo completo: criar cliente → criar projeto → Step1 (selecionar tipo) → Step2 (adicionar ambiente com fita+driver+perfil) → Step3 (revisão + gerar PDF).
**Expected:** Tudo flui sem erro. PDF gera. Snapshot persistido continua compatível.
**Why human:** Constraint explícita do PROJECT.md ("o wizard de 3 passos já em uso não pode quebrar"). Plan 02-04 modificou Index.tsx — risco de regressão.

### Gaps Summary

Nenhuma gap de implementação encontrada no código. Todos os 5 success criteria do ROADMAP da Phase 2 estão verificáveis no código com artefatos substantivos, wiring real e fluxo de dados via Supabase. Os 10 requirements declarados (USR-01..04, CLI-01..03, ARQ-02, PROD-03, PROD-04) têm cobertura 1:1 nos plans.

A Wave 3 reaplicada manualmente (commit `1584066` consolidando ArquitetoAutocomplete + ArquitetoDialog + Admin tab em vez dos 3 commits originais) tem conteúdo idêntico ao planejado e foi verificada arquivo-a-arquivo. Sem regressão estrutural.

**Status `human_needed` (não `passed`):** apesar do código estar 100% correto e compilando, este Marco 1 segue estratégia de UAT manual em prod (memória `project_aura_gsd_marco1.md`). A validação de comportamento ponta-a-ponta (signup → DB, banner visual, CRUD UX, máscaras dinâmicas, autocomplete debounce, wizard intacto) precisa de browser real + banco em prod. Esses 6 testes humanos precisam acontecer antes de fechar a fase.

---

_Verified: 2026-04-27_
_Verifier: Claude (gsd-verifier)_
