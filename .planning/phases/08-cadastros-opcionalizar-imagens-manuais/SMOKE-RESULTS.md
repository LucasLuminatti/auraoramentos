---
phase: 08-cadastros-opcionalizar-imagens-manuais
plan: 05
artifact: smoke-results
environment: production (https://orcamentosaura.com.br)
executed_by: claude (Playwright MCP + Supabase MCP)
executed_at: 2026-05-14
bundle_sha_before: DyLgUVaE (pre-push, no Phase 8 code)
bundle_sha_after_push: CcWyAkOh (Phase 8 features deployed)
bundle_sha_after_hotfix: EXXbaYnT (user_id regression fix deployed)
result: 5/5 PASS
---

# Phase 08 — Smoke Prod Results

Smoke automatizado via Playwright MCP + verificação SQL via Supabase MCP.
Dados de teste deletados em prod após validação (tabela limpa em cli_left=0, arq_left=0; produtos AU001/LM029 restaurados).

## Sequência executada

1. Push de 10 commits unmerged (`a2da9af..967ff28`) → deploy Vercel `DyLgUVaE → CcWyAkOh`
2. Tentativa de smoke FORM-01 → **400 em `POST /rest/v1/clientes`** descoberto
3. Diagnose: `clientes.user_id NOT NULL` (Phase 7) + dialog nunca envia user_id → regressão Phase 7
4. Hotfix `71d28d7` (`fix(08-05): set user_id on cliente/arquiteto insert`) → deploy `CcWyAkOh → EXXbaYnT`
5. Smoke completo executado sobre bundle `EXXbaYnT` ✅

## Tabela 5-check

| # | Check | Requisito | Como validado | Evidência | Resultado |
|---|-------|-----------|---------------|-----------|-----------|
| 1 | Criar cliente só com Nome | FORM-01 | Playwright: abrir dialog, ver labels `(opcional)` em Contato/CPF/Arquiteto, preencher só `Smoke Cliente FORM-01`, clicar Criar | Labels inspecionados (3 ocorrências `(opcional)`) + linha em prod (`id=1753f611...`, `user_id=5bc17cc7...`, demais campos NULL) | ✅ PASS |
| 2 | Editar arquiteto com 7 campos novos | FORM-02 (UI + DB) | Playwright: dialog "Novo Arquiteto" exibe 9 inputs (`arq-nome` + 8 opcionais), labels com `(opcional)`, preencher todos, salvar, reabrir em edit mode | 9 labels confirmados (`Nome *`, `Contato (opcional)`, `Data de Nascimento (opcional)`, `Endereço`, `Banco`, `Agência`, `Conta`, `Tipo de Conta`, `Pix`); SQL `SELECT * FROM arquitetos WHERE nome='Smoke Arquiteto FORM-02'` retornou todas as 7 colunas com valores | ✅ PASS |
| 3 | Editar AU001 (coringa) | FORM-03 | Playwright: buscar `AU001`, clicar Pencil inline, alterar `descricao` para `Drivers — Smoke FORM-03`, salvar | SQL `SELECT descricao FROM produtos WHERE codigo='AU001'` → `Drivers — Smoke FORM-03` persistido (depois restaurado) | ✅ PASS |
| 4 | ImageIcon inline em SKU master | FORM-04 | Playwright: buscar `LM029` (bulbo LED, não-coringa), clicar ImageIcon inline, dialog abriu em modo edit, upload `smoke-auth.png`, salvar | SQL `SELECT imagem_url FROM produtos WHERE codigo='LM029'` → `https://...storage/.../produtos-imagens/LM029.png` (depois nullado) | ✅ PASS |
| 5 | FORM-02 SQL persistence | FORM-02 (schema gate) | Supabase MCP: `SELECT id, nome, data_nascimento, endereco, banco, agencia, conta, tipo_conta, pix FROM public.arquitetos WHERE banco IS NOT NULL OR endereco IS NOT NULL OR data_nascimento IS NOT NULL` | Row do smoke retornou com 7 colunas preenchidas (data_nascimento `1985-07-22`, banco `Itaú`, agencia `0123`, conta `45678-9`, tipo_conta `corrente`, pix `smoke@form02.test`) | ✅ PASS |

## Console / network

- Zero JS errors após hotfix (`EXXbaYnT`)
- 1 warning recorrente: irrelevante a Phase 8 (preexisting)
- Zero 4xx/5xx em qualquer dos 4 fluxos UI após hotfix

## Bug encontrado e fixado durante o smoke

**Severidade:** P0 (criar cliente/arquiteto não funcionava em prod desde Phase 7)
**Causa raiz:** Phase 7 (`07-01-PLAN`) elevou `arquitetos.user_id` e `clientes.user_id` para `NOT NULL` sem `DEFAULT auth.uid()`. ClienteDialog e ArquitetoDialog nunca injetavam `user_id` no payload de insert (assumiam null permitido, como antes). Toda criação 400.
**Por que não pegamos antes:** Phase 7 não fez smoke de criação pós-push — só verificou DDL. Phase 8 plans assumiam que insert já funcionava.
**Fix:** Commit `71d28d7` — `supabase.auth.getUser()` + `user_id: userData.user.id` no payload de insert (não no update). Padrão idêntico a `DriveExplorer.tsx:226`, `ExceptionChat.tsx:114`, `useColaborador.ts:58`.
**Escopo do fix:** mínimo cirúrgico, 14 linhas em 2 arquivos. Edit path preservado (user_id imutável).

## Limpeza pós-smoke

```sql
DELETE FROM public.clientes WHERE nome='Smoke Cliente FORM-01'; -- 1 row
DELETE FROM public.arquitetos WHERE nome='Smoke Arquiteto FORM-02'; -- 1 row
UPDATE public.produtos SET descricao='Drivers' WHERE codigo='AU001';
UPDATE public.produtos SET imagem_url=NULL WHERE codigo='LM029';
```

Pós-cleanup: `cli_left=0, arq_left=0`. AU001 e LM029 restaurados ao estado pré-smoke.

> O arquivo `LM029.png` continua no bucket `produtos-imagens` mas órfão (url NULL no DB). Não polui UI. Pode ser deletado num housekeeping futuro junto com o cleanup `produto-imagens` singular já listado em [[project_aura_pending_cleanup]].

## Conclusão

Phase 8 features (FORM-01..04) entregues e validadas em prod. **Bonus:** Phase 7 P0 regression encontrada e corrigida no mesmo push.
