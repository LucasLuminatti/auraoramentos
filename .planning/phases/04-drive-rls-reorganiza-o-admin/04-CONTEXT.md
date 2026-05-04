# Phase 4: Drive RLS & Reorganização Admin - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Drive isolado por colaborador (admin vê tudo, colaborador vê só o seu) + reorganização do painel admin com:
- visualização detalhada de pedido (ADM-01)
- tela dedicada de atualização de preços em batch (ADM-02)
- documentação in-app do fluxo de exceção (ADM-03)
- abas reagrupadas em 4 grupos (ADM-04)
- dashboard avaliada e simplificada (ADM-05)

**Não é escopo:** filtros por arquiteto (Phase 6), PDF redesign (Phase 5), módulo de comissões (Marco 4), fluxo de cálculos (Marco 3). Cleanup do bucket antigo `produto-imagens` (singular) da Phase 3 também NÃO entra aqui.

</domain>

<decisions>
## Implementation Decisions

### Drive RLS — Modelo de Acesso

- **D-01:** Cada colaborador vê apenas seus próprios arquivos e projetos no Drive. Admin vê tudo. Comportamento de "site normal" (não shared/compartilhado).
- **D-02:** Tabelas `cliente_arquivos` e `arquivo_pastas` ganham coluna `colaborador_id uuid` (FK → `colaboradores.id`, nullable durante transição mas backfill faz tudo virar `NOT NULL` antes do final da migration).
- **D-03:** Policies RLS:
  - SELECT: `colaborador_id = auth.uid() OR has_role(auth.uid(), 'admin')`
  - INSERT: `colaborador_id = auth.uid()` (auto-set, não vem do form)
  - UPDATE/DELETE: `colaborador_id = auth.uid() OR has_role(auth.uid(), 'admin')`
- **D-04:** Arquivos legados (sem `colaborador_id`) → atribuídos ao admin (Lenny) via UPDATE no momento da migration. Sem opção "shared".
- **D-05:** Comportamento ao deletar colaborador → arquivos órfãos reatribuídos automaticamente ao admin (não cascade delete).

### Drive Storage — Privacidade do Bucket

- **D-06:** Bucket `cliente-arquivos` vira **privado** (deixa de ser `public read`).
- **D-07:** Acesso aos arquivos via **signed URLs com 24h de expiração**. App gera URL temporária no momento do download.
- **D-08:** URLs públicas antigas (em PDFs gerados anteriormente, links compartilhados externos) **vão quebrar** — decisão consciente. Quem precisar pede de novo dentro do app.
- **D-09:** Storage policies ajustadas para mesmo padrão da RLS de tabela:
  - SELECT (download): só dono ou admin (via path com prefixo `colaborador_id`)
  - INSERT (upload): só authenticated, com path forçado para `${auth.uid()}/...`
  - DELETE: só dono ou admin

### Reorganização do Admin (ADM-04)

- **D-10:** Abas reagrupadas em **4 grupos com sub-tabs** + página "Início" separada:
  - **Início** (página, não aba) — dashboard simplificado
  - **Cadastros** → sub-tabs: Produtos, Arquitetos, Clientes, Colaboradores
  - **Pedidos** → lista de orçamentos (mantém comportamento atual + ADM-01)
  - **Preços** → sub-tabs: Atualização batch (ADM-02), Importação (Master/Produtos/Imagens existentes da Phase 3)
  - **Exceções** → mantém comportamento atual + ADM-03 (documentação in-app)
- **D-11:** URL strategy: `/admin?tab=cadastros&sub=produtos`, `/admin?tab=precos&sub=atualizacao` etc. Sub-tab persistida na URL pra suportar reload e link compartilhado.

### Tela de Atualização de Preços (ADM-02)

- **D-12:** Lista paginada (50 produtos/página) com **inline edit** em `preco_tabela` e `preco_minimo`.
- **D-13:** Filtros disponíveis: arquiteto, categoria/tipo_produto, "sem preço cadastrado" (preco_tabela = 0 OR NULL).
- **D-14:** Botão "Salvar X alterações" no rodapé fixo — faz batch UPDATE de todas as alterações pendentes em uma chamada.
- **D-15:** Sem bulk ops avançadas (multiplicar X%, definir margem mínima) no v1. Se virar dor real depois, vira phase futura.
- **D-16:** Edições em ADM-02 marcam `editado_manualmente=true` (consistente com D-08 da Phase 3) — protege contra sobrescrita por master subsequente.
- **D-17:** Validação inline: preço mínimo ≤ preço tabela. Se violado, bloqueia salvamento com toast.

### Visualização Detalhada de Pedido (ADM-01)

- **D-18:** **Página dedicada** em `/admin/orcamento/:id` (não modal). URL própria → permite compartilhar link.
- **D-19:** Read-only no v1. Sem ações além de "Re-emitir PDF". Edição via reabertura do wizard fica pra phase futura se virar dor.
- **D-20:** Conteúdo mostrado: cliente, arquiteto, colaborador responsável, status, ambientes (com sistemas e itens), totais, histórico de exceções (se houver).
- **D-21:** Botão "Voltar para lista" leva pra aba Pedidos com filtros preservados (URL state).

### Documentação In-App de Exceções (ADM-03)

- **D-22:** Bloco de ajuda fixo no topo da aba Exceções explicando o fluxo: quem solicita (colab), quem aprova (admin), o que acontece com aprovação/rejeição, como o histórico fica visível em ADM-01.
- **D-23:** Texto inline (não modal/tooltip), pra que admin novo veja sem precisar clicar.

### Dashboard (ADM-05)

- **D-24:** **Simplificar** o dashboard atual. Manter as 6 métricas de topo (Receita Efetiva, Receita Prevista, Pipeline, Ticket Médio, Conversão, Ciclo Médio) + gráfico Receita Mensal + seletor de período.
- **D-25:** **Remover** o gráfico "Distribuição por Status" (redundante com Pipeline).
- **D-26:** Dashboard vira **página "Início"** separada do tab strip (rota `/admin` ou `/admin/inicio`). As 4 abas (Cadastros/Pedidos/Preços/Exceções) ficam abaixo.

### Claude's Discretion

- Escolha entre router `?tab=X&sub=Y` query param vs. nested route `/admin/cadastros/produtos` — Claude decide com base no que mantém o código mais limpo (provavelmente mantém o `?tab=` que já existe e adiciona `&sub=`).
- Estilo visual da página `/admin/orcamento/:id` — segue padrão das outras páginas admin (Card + Table) com decisão de Claude sobre seções colapsáveis ou tudo expandido.
- Componente da inline edit de preços — pode reusar o ProdutoEditDialog em mode='inline' ou criar componente novo, conforme análise do researcher.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisões de phases anteriores

- `.planning/phases/03-produtos-importa-o/03-CONTEXT.md` D-08 — `editado_manualmente=true` em qualquer save UI (vai aplicar em ADM-02)
- `.planning/phases/03-produtos-importa-o/03-CONTEXT.md` D-14 — bucket plural `produtos-imagens` (referência de naming pra `cliente-arquivos`)
- `.planning/phases/03-produtos-importa-o/03-RESEARCH.md` — patterns de migration aditiva e RLS

### Migrações que estabeleceram o estado atual

- `supabase/migrations/20260302192445_503d0a52-6648-487a-bc49-5ade350105cc.sql` — criou bucket `cliente-arquivos` (público) + policies abertas. Phase 4 vai SUBSTITUIR essas policies.

### Código existente relevante

- `src/components/DriveExplorer.tsx` — toda a lógica de upload/download/listing (precisa migrar pra signed URLs)
- `src/components/DriveSidebar.tsx` — navegação por cliente/projeto
- `src/pages/Drive.tsx` — wrapper da página Drive
- `src/pages/Admin.tsx` — estrutura atual de 8 abas flat (vai virar 4 grupos + sub-tabs)
- `src/hooks/useUserRole.ts` — already returns `isAdmin`, usado em policies via `has_role()`

### Storage e RLS patterns Supabase

- Sem ADRs internos do projeto. Researcher consulta docs Supabase Storage RLS + Signed URLs durante research phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Card / Dialog / Table / Tabs / Badge** (shadcn-ui): toda a UI nova reusa
- **ProdutoEditDialog** (Phase 3): pode informar pattern de inline-edit pra ADM-02
- **ProdutoAutocomplete** (Phase 2): pra ADM-01 mostrar info de produto sem refetch
- **useColaborador** hook: já retorna o colaborador do user logado — usado pra setar `colaborador_id` em INSERTs
- **has_role(uuid, role)** RPC já existe no DB (usado em RLS de produtos/exceções)

### Established Patterns

- **RLS aditiva via migration**: `ALTER TABLE ... ENABLE RLS; CREATE POLICY ...` — padrão das phases 1-3
- **TanStack Query**: cache local — admin precisa invalidar quando deleta um arquivo de colab pra refletir
- **Toast feedback**: `sonner` toast.success / toast.error — padrão consistente
- **URL state**: `useSearchParams` pra `?tab=X&sub=Y` — já tem precedente em `Admin.tsx`

### Integration Points

- **Drive page** (`src/pages/Drive.tsx`): point de troca de URL pública → signed URL no `<a href>` ou `window.open`
- **Admin tabs** (`src/pages/Admin.tsx`): refator do TabsList / TabsContent pra hierarquia de 2 níveis
- **PDF generator** (`src/lib/gerarPdfHtml.ts`): se gera link pra arquivo do Drive, precisa ir via signed URL agora (verificar)

</code_context>

<specifics>
## Specific Ideas

- Lenny quer **comportamento de "site normal"** — explícito na resposta D-01. Sem cinza, sem shared, sem "vamos pensar depois".
- Edge case do drive: PDFs antigos podem ter URLs hardcoded — Lenny aceita quebra (D-08).
- Inline-edit de preço deve ter UX clara de "tem mudança não salva" — visual cue (ex: destacar linha, mostrar contador no botão de salvar).

</specifics>

<deferred>
## Deferred Ideas

- **Bulk ops avançadas em ADM-02** (multiplicar X%, definir margem mínima) — só implementa se virar dor real depois. Marco 2 ou Marco 3.
- **Edição inline de pedido em ADM-01** — admin reabrindo wizard com dados do pedido. Phase futura, não Phase 4.
- **Limpeza do bucket antigo `produto-imagens` (singular)** da Phase 3 — Lenny pediu pra deixar pra depois (memória `project_aura_pending_cleanup`).
- **Migration de URLs antigas em PDFs gerados antes da Phase 4** — quebrar é OK no v1.
- **Edge function proxy pro Storage** (alternativa rejeitada em D-07) — só se signed URL provar dor.

### Reviewed Todos (not folded)

[Nenhum todo cross-reference identificado pra esta phase]

</deferred>

---

*Phase: 04-drive-rls-reorganiza-o-admin*
*Context gathered: 2026-05-04*
