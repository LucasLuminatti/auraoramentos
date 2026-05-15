# 09-PREFLIGHT — Callsite Audit (Read-Only)

**Date:** 2026-05-15T12:56:32Z
**Phase:** 09-multi-tenancy-rls
**Plan:** 01
**Goal:** Classificar cada query em `arquitetos` / `clientes` antes do RLS apertar, pra garantir zero quebra silenciosa.

**Methodology:** Cada callsite foi aberto no arquivo:linha indicado, inspecionado o contexto da query (tabela, filtro, surface onde renderiza, perfil que usa a tela) e classificado em uma das três classes abaixo. Numeração de linhas confirmada via leitura direta dos arquivos no commit atual (post-hotfix `71d28d7`).

**Classes:**

- **OK natural** — Tela usada por colab (não-admin) onde RLS filtrar = comportamento desejado.
- **OK admin-only** — Tela só é renderizada para admin (rota /admin protegida via `AdminRoute` ou subtab dela). RLS deixa admin ver tudo via `has_role(admin)`, então comportamento idêntico ao atual.
- **Risk** — Tela é renderizada por colab E precisa ver dados de outros users.

## Callsite Audit

| # | File:Line | Operation | Table | Surface (admin/colab/both) | Class | Justification |
|---|-----------|-----------|-------|----------------------------|-------|---------------|
| 1 | src/components/ArquitetoAutocomplete.tsx:54 | SELECT (`id, nome` ilike) | arquitetos | colab+admin | OK natural | Autocomplete usado dentro de `ClienteDialog` (form de cliente) e `ProdutoEditDialog` (admin). Colab só precisa ver os arquitetos que cadastrou — RLS filtra automaticamente; admin vê todos via `has_role(admin)`. Comportamento desejado em ambos os surfaces |
| 2 | src/components/ClienteList.tsx:53 | SELECT (`id, nome`) | clientes | colab+admin | OK natural | Lista de clientes do user logado (montagem do wizard Step1). RLS-01 filtrar por `user_id = auth.uid()` é exatamente o comportamento desejado: colab só vê seus, admin vê tudo |
| 3 | src/components/ClienteDialog.tsx:45 | SELECT (`.eq id .maybeSingle`) | arquitetos | colab+admin | OK natural | Recupera nome do arquiteto associado ao cliente sendo editado. Cliente RLS-01 garante que `cliente.arquiteto_id` veio de um cliente do user → dono do cliente == dono do arquiteto na prática nova. Caso admin esteja editando cliente alheio, `has_role(admin)` libera SELECT em arquitetos também |
| 4 | src/components/ClienteFilterAutocomplete.tsx:48 | SELECT (`id, nome` ilike) | clientes | colab+admin | OK natural | Filtro de autocomplete em tab Pedidos / outros consumidores. RLS reduz aos clientes do user logado — exatamente o comportamento esperado pra colab; admin vê todos |
| 5 | src/components/DriveSidebar.tsx:39 | SELECT (`id, nome`) | clientes | colab+admin | OK natural | Sidebar do /drive já filtra documentos via `cliente_arquivos.user_id` (Phase 4 D-02). Cliente RLS-01 alinha o root do explorer: colab só lista clientes seus; admin lista todos. Consistência com o resto do Drive |
| 6 | src/components/DriveExplorer.tsx:110 | SELECT (`id, nome`) | clientes | colab+admin | OK natural | Explorer Drive root level — mesmo racional do callsite #5; Drive é per-user, lista de clientes pertinente |
| 7 | src/components/PrecosBatch.tsx:69 | SELECT (`id, nome`) | arquitetos | admin-only | OK admin-only | Componente renderizado dentro de tab Preços do `Admin.tsx` (rota /admin gated por `AdminRoute`). `has_role(admin)` libera SELECT em todos os arquitetos. Comportamento idêntico ao atual |
| 8 | src/components/ProdutoEditDialog.tsx:56 | SELECT (`.eq id .maybeSingle`) | arquitetos | admin-only | OK admin-only | Dialog aberto pela tab Cadastros/Produtos do Admin (rota /admin). Admin vê todos via `has_role(admin)`. Edit produto não é exposto a colab |
| 9 | src/pages/Admin.tsx:341,402,419 | SELECT | arquitetos+clientes | admin-only | OK admin-only | (341) busca pontual `clientes.nome` por id em sync de filtro Pedidos; (402) `fetchClientes(arqFilter)` da tab Cadastros/Clientes; (419) `fetchArquitetos()` da tab Cadastros/Arquitetos. Rota /admin gated por `AdminRoute` (verifica `useUserRole().isAdmin`); `has_role(admin)` na policy libera todo o SELECT |
| 10 | src/pages/Admin.tsx:434,459 | DELETE | arquitetos+clientes | admin-only | OK admin-only | (434) `handleDeleteArquiteto` e (459) `handleDeleteCliente` rodam só pelo admin na tab Cadastros. DELETE policy `(user_id = auth.uid() OR has_role(admin))` libera admin para deletar qualquer arquiteto/cliente. Comportamento idêntico ao atual |
| 11 | src/components/ArquitetoDialog.tsx:84 + ClienteDialog.tsx:85 | INSERT (com `user_id: userData.user.id` manual pós-hotfix `71d28d7`) | arquitetos+clientes | colab+admin | OK natural | Payload injeta `user_id = auth.uid()` em runtime. WITH CHECK strict `(user_id = auth.uid())` passa porque o valor manual == `auth.uid()`. Após DEFAULT `auth.uid()` em D-04 (Phase 7), o payload manual vira redundância segura (cinto-e-suspensórios). UPDATE no mode=edit (88 em ClienteDialog, 87 em ArquitetoDialog) não toca `user_id` e cai na USING policy padrão |

## Risk Callsites (Action Items para 09-03)

Nenhum identificado.

- Todos os callsites em telas colab (#1-#6, #11) querem exatamente o comportamento que RLS-01/RLS-02 entregam: filtro por `user_id = auth.uid()`.
- Todos os callsites admin-only (#7-#10) ficam idênticos porque a policy SELECT inclui `OR has_role(admin)` e o DELETE policy também.
- Nenhum callsite admin-only depende de "ver dado de colab que ele não tenha visibilidade" — admin já tem visibilidade total pelo role.
- Nenhum callsite colab depende de "ver dado de outro user" — RLS é o objetivo.

## Conclusão

Phase 9 NÃO precisa modificar código do client. RLS + DEFAULT `auth.uid()` (Phase 7 → Phase 9-03) cobre todos os 11 callsites. Esta tabela vira baseline pós-migration: se aparecer regressão funcional em prod (ex: autocomplete vazio em tela admin), o callsite #N específico desta tabela é o ponto de partida pra investigação.

**Cross-reference:**
- Decisão D-09 (não modificar callsites em Phase 9) — confirmada por esta auditoria.
- Decisão D-11 (Phase 9 não toca código frontend) — confirmada.
- Hotfix `71d28d7` (payload `user_id` manual em dialogs) — torna-se redundância segura após DEFAULT `auth.uid()` (D-04, Phase 7); não conflita com WITH CHECK strict.
