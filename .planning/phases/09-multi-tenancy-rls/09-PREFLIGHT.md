# 09-PREFLIGHT — Callsite Audit (Read-Only)

**Date:** 2026-05-14
**Phase:** 09-multi-tenancy-rls
**Plan:** 01
**Goal:** Classificar cada query em `arquitetos` / `clientes` antes do RLS apertar, pra garantir zero quebra silenciosa.

## Callsite Audit

| # | File:Line | Operation | Table | Surface (admin/colab/both) | Class | Justification |
|---|-----------|-----------|-------|----------------------------|-------|---------------|
| 1 | src/components/ArquitetoAutocomplete.tsx:54 | SELECT | arquitetos | colab+admin | OK natural | Autocomplete dentro de ClienteDialog e Admin tab Cadastros; colab só precisa ver os arquitetos que cadastrou; RLS filtra para o user logado — comportamento desejado |
| 2 | src/components/ClienteList.tsx:58 | SELECT | clientes | colab+admin | OK natural | Lista usada no wizard (Index.tsx) por colab e admin; RLS filtra para clientes do user logado — colab vê só os seus, admin vê todos via has_role(admin) |
| 3 | src/components/ClienteDialog.tsx:45 | SELECT (.eq id) | arquitetos | colab+admin | OK natural | SELECT por id específico (.eq("id", arquiteto_id).maybeSingle()) ao abrir dialog de edit; o id veio do próprio registro de cliente do user; como RLS-01 garante que o cliente é do user, o arquiteto_id referenciado também pertence ao mesmo user — dono do cliente == dono do arquiteto |
| 4 | src/components/ClienteFilterAutocomplete.tsx:48 | SELECT | clientes | admin-only | OK admin-only | Usado exclusivamente em Admin.tsx (grep: 2 arquivos, nenhum fora de admin); admin vê todos os clientes via has_role(admin) |
| 5 | src/components/DriveSidebar.tsx:39 | SELECT | clientes | colab+admin | OK natural | Sidebar Drive lista clientes do user logado; Drive já tem RLS por user_id (Phase 4); consistência — colab vê seus clientes, admin vê todos |
| 6 | src/components/DriveExplorer.tsx:110 | SELECT | clientes | colab+admin | OK natural | Mesmo contexto do DriveSidebar; Drive é per-user; lista de clientes para navegação de arquivos é restrita ao user logado via RLS |
| 7 | src/components/PrecosBatch.tsx:69 | SELECT | arquitetos | admin-only | OK admin-only | Tab Preços fica dentro da rota /admin protegida por AdminRoute; admin vê todos os arquitetos via has_role(admin) |
| 8 | src/components/ProdutoEditDialog.tsx:56 | SELECT (.eq id) | arquitetos | admin-only | OK admin-only | SELECT por arquiteto_id específico (.eq("id", arquiteto_id).maybeSingle()) ao abrir dialog de edição de produto; dialog chamado de Admin.tsx (tab Cadastros > Produtos); admin vê todos via has_role(admin) |
| 9 | src/pages/Admin.tsx:286,347,364 | SELECT | arquitetos+clientes | admin-only | OK admin-only | Linha 286: SELECT clientes por id (filtro Pedidos); linha 347: fetchClientes com arqFilter; linha 364: fetchArquitetos; rota /admin protegida por AdminRoute; admin tem has_role(admin) — policies liberam visão completa |
| 10 | src/pages/Admin.tsx:379,404 | DELETE | arquitetos+clientes | admin-only | OK admin-only | DELETE de arquiteto (379) e cliente (404) executados em Admin.tsx; DELETE policy tem OR has_role(admin) → admin pode deletar qualquer registro |
| 11 | src/components/ArquitetoDialog.tsx:84 + ClienteDialog.tsx:85 | INSERT (com user_id manual pós-hotfix 71d28d7) | arquitetos+clientes | colab+admin | OK natural | INSERT carrega user_id: userData.user.id explicitamente; WITH CHECK strict (user_id = auth.uid()) passa porque user_id no payload == auth.uid() em runtime; DEFAULT auth.uid() do D-04 vira redundância segura — não remover o hotfix (defesa em camadas) |

## Risk Callsites (Action Items para 09-03)

Nenhum identificado — RLS filtra naturalmente, e nenhum callsite admin-only depende de dados de colab que ele não tenha visibilidade. Todos os callsites colab+admin ou recebem RLS como comportamento desejado (colab vê só o seu), ou são de admin que tem has_role(admin) liberando visão completa.

## Conclusão

Phase 9 NÃO precisa modificar código do client. RLS + DEFAULT auth.uid() cobre todos os 11 callsites. Auditoria confirmou 0 callsites Risk — baseline documentado para comparação pós-migration.
