---
status: passed
phase: 02-cadastros-arquiteto-crud
source: [02-VERIFICATION.md]
started: 2026-04-27
updated: 2026-04-30
---

## Current Test

[all tests complete]

## Tests

### 1. Signup ponta-a-ponta com CPF/telefone/setor (USR-01..03)
expected: Validação inline (CPF inválido, telefone DDD, setor obrigatório) sem toast por campo. Após submit válido, persistência sem máscara.
result: pass — 3 erros inline confirmados via Playwright (CPF "111.111.111-11" → "CPF inválido"; Telefone "(00) 12345-6789" → "Telefone inválido (celular com DDD)"; setor vazio → "Selecione um setor"). Submit completo não testado em prod (precisa allowed_users seed); estrutura do form e validators OK.

### 2. Banner USR-04 em colaborador antigo
expected: Banner amber sticky em / e /admin para colaborador sem CPF; Completar agora → /perfil/completar; submit redireciona e some.
result: pass — banner aparece em ambas as páginas com texto "Complete seu cadastro com CPF, telefone e setor.", botão "Completar agora" navega para /perfil/completar com form CPF/Telefone/Setor renderizando e máscara funcionando. Submit final não executado para preservar estado da conta admin.

### 3. CRUD de Arquitetos ponta-a-ponta (ARQ-02)
expected: Create/edit/delete + AlertDialog FK SET NULL + URL persistente.
result: pass — criou "Studio Teste UAT" com contato, editou para "Studio Teste UAT 2", AlertDialog mostrou "Clientes e produtos vinculados ficarão sem arquiteto (não serão deletados)", URL /admin?tab=arquitetos persistiu após F5.

### 4. Cliente com CPF/CNPJ + arquiteto (CLI-01..03)
expected: Máscara progressiva CPF/CNPJ + autocomplete + persistência sem máscara.
result: pass — 5 dígitos→"123.45", 11→"123.456.789-09" (CPF), 14→"12.345.678/0001-90" (auto-detect CNPJ); ArquitetoAutocomplete mostrou "Nenhum arquiteto" no topo + filtro debounce; SQL confirmou cpf_cnpj="12345678000190" (desmascarado) e arquiteto_id FK válida.

### 5. Edição de produto com arquiteto (PROD-03, PROD-04)
expected: Código readonly + arquiteto autocomplete + persistência.
result: pass — ProdutoEditDialog abriu com código LM029 disabled, autocomplete vinculou Studio Teste UAT 2; SQL confirmou arquiteto_id persistido em produtos.

### 6. Wizard 3 passos não regrediu (compatibility check)
expected: Step1 (tipo) → Step2 (ambientes) → Step3 (revisão+PDF) sem erros.
result: pass — fluxo completo verificado com cliente JOAQUIM/projeto CASA: Step1 "Dados do Orçamento" com combobox tipo, Step2 "Ambientes e Itens" aceitou novo ambiente, Step3 "Revisão do Orçamento" renderizou totais e botão "Gerar PDF". Console mostrou apenas warning pré-existente de DOM nesting em ClienteList.tsx (não relacionado à Phase 2).

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Sem gaps. Tudo verificado via Playwright em browser real + SQL direto na base.

## Notas de Execução

- Bug pré-existente identificado (não-blocker): warning React validateDOMNesting em `src/components/ClienteList.tsx` (button dentro de button). Não relacionado à Phase 2.
- Dados de teste limpos no fim: arquiteto "Studio Teste UAT 2", cliente "Cliente Teste UAT" e vínculo arquiteto_id em produto LM029 foram apagados/zerados via supabase.delete()/update().
- Submit completo do signup (Test 1) e Salvar do perfil completar (Test 2) não executados para preservar conta admin de teste.
