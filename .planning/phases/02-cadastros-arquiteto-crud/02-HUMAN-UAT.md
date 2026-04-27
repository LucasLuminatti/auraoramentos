---
status: partial
phase: 02-cadastros-arquiteto-crud
source: [02-VERIFICATION.md]
started: 2026-04-27
updated: 2026-04-27
---

## Current Test

[awaiting human testing]

## Tests

### 1. Signup ponta-a-ponta com CPF/telefone/setor (USR-01..03)
expected: Abrir `/auth?mode=signup`. CPF "111.111.111-11" deve mostrar erro inline (texto vermelho, sem toast por campo). Telefone "(00) 12345-6789" deve mostrar erro DDD inválido. Setor sem selecionar deve mostrar erro inline. Após submit válido com cpf=12345678909, telefone=11987654321, setor=comercial: conta criada em auth.users e linha em colaboradores com cpf="12345678909" (sem máscara), telefone="11987654321", setor="comercial".
result: [pending]

### 2. Banner USR-04 em colaborador antigo
expected: Banner amber sticky aparece no topo de `/` e `/admin` quando colaborador tem cpf IS NULL. Clicar "Completar agora" navega para `/perfil/completar`. Preencher 3 campos válidos + Salvar redireciona para `/` e banner some.
result: [pending]

### 3. CRUD de Arquitetos ponta-a-ponta (ARQ-02)
expected: `/admin?tab=arquitetos` permite criar/editar/excluir arquitetos. AlertDialog de exclusão mostra "Clientes e produtos vinculados ficarão sem arquiteto". Lista mantém ordem alfabética. URL com search param persiste F5. Exclusão não cascata para clientes/produtos vinculados (FK SET NULL).
result: [pending]

### 4. Cliente com CPF/CNPJ + arquiteto (CLI-01..03)
expected: ClienteDialog mostra máscara progressiva durante digitação (5 dígitos parcial, 11 dígitos `123.456.789-01`, 14 dígitos auto-detect CNPJ `12.345.678/0001-90`). ArquitetoAutocomplete tem opção "Nenhum arquiteto" fixa no topo. Após submit, `clientes.cpf_cnpj` armazenado desmascarado (apenas dígitos) e `arquiteto_id` preenchido com FK válida.
result: [pending]

### 5. Edição de produto com arquiteto (PROD-03, PROD-04)
expected: `/admin?tab=produtos` Pencil abre ProdutoEditDialog. Campo código é disabled (readonly). Atribuir arquiteto via autocomplete + salvar persiste `arquiteto_id`. Coluna "Arquiteto" da tabela atualiza com nome via arquitetosMap.
result: [pending]

### 6. Wizard 3 passos não regrediu (compatibility check)
expected: Fluxo completo de orçamento (criar cliente → criar projeto → Step1 tipo → Step2 ambiente com fita+driver+perfil → Step3 revisão + gerar PDF) flui sem erros. PDF gera. Constraint explícita do PROJECT.md ("o wizard de 3 passos já em uso não pode quebrar"). Plan 02-04 modificou Index.tsx — risco de regressão.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
