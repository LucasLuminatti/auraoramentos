# Roadmap: AURA — Marco 1 (Melhorias v1)

**Defined:** 2026-04-23
**Granularity:** coarse
**Coverage:** 42/42 v1 requirements mapped
**Mode:** yolo (parallelization enabled)

> **Contexto:** AURA em produção (Vercel kappa). Marco 1 = primeiro ciclo estruturado de melhorias pós-lançamento. Todas as mudanças de schema são aditivas — nada destrutivo em dados de produção.

## Phases

- [ ] **Phase 1: Schema & Prep** — Limpar git pendente e aplicar todas as migrations aditivas (arquitetos, FKs, campos novos) que desbloqueiam as fases seguintes
- [ ] **Phase 2: Cadastros & Arquiteto CRUD** — Signup expandido (CPF/telefone/setor), form de cliente com arquiteto, CRUD de arquitetos no admin e vinculação dos produtos existentes
- [ ] **Phase 3: Produtos & Importação** — UI de cadastro manual de produto, cadastro dos 16 itens faltantes e importação CSV completa (create + preços + imagens + preview + erros por linha)
- [ ] **Phase 4: Drive RLS & Reorganização Admin** — RLS do Drive por colaborador, visualização detalhada de pedido, tela de preços, docs de exceção e reorganização das abas
- [ ] **Phase 5: PDF Redesign** — Reconstrução do PDF com layout tipográfico limpo, remoção das 4 caixas e texto final formatado
- [ ] **Phase 6: Filtros & Smoke** — Filtros por arquiteto (clientes/produtos/pedidos), filtros combináveis e smoke test manual em prod

## Phase Details

### Phase 1: Schema & Prep
**Goal**: Base de dados pronta para receber todas as features do marco — com git limpo e migrations aditivas aplicadas em produção sem quebrar nada existente
**Depends on**: Nothing (primeira fase)
**Requirements**: PREP-01, ARQ-01, ARQ-03, ARQ-04, ARQ-05
**Success Criteria** (what must be TRUE):
  1. `git status` limpo — edge functions `request-access`/`review-access` e `supabase/config.toml` commitados ou revertidos com decisão explícita
  2. Tabela `arquitetos` existe em produção com colunas `id`, `nome`, `contato` (nullable), `created_at`
  3. Coluna `arquiteto_id` (nullable, FK) existe em `clientes` e `produtos`
  4. Colunas `cpf`, `telefone`, `setor` (nullable) existem em `colaboradores`; `contato` e `cpf_cnpj` existem em `clientes`
  5. Wizard de orçamento, login e admin continuam funcionando em produção sem regressão visível (colunas novas vazias não quebram render)
**Plans**: 3 plans
- [ ] 01-01-PLAN.md — PREP-01 preflight + git cleanup (config.toml, edge functions decision, .gitignore)
- [ ] 01-02-PLAN.md — 4 aditive migrations (arquitetos, FKs in clientes/produtos, cols in colaboradores/clientes) + db push + types regen
- [ ] 01-03-PLAN.md — Smoke test in prod (wizard, admin, PDF, dashboard) — Phase 1 closure

### Phase 2: Cadastros & Arquiteto CRUD
**Goal**: Usuários novos entram com dados completos (CPF/telefone/setor), clientes podem ser vinculados a arquitetos e admin gerencia arquitetos como entidade própria
**Depends on**: Phase 1
**Requirements**: USR-01, USR-02, USR-03, USR-04, CLI-01, CLI-02, CLI-03, ARQ-02, PROD-03, PROD-04
**Success Criteria** (what must be TRUE):
  1. Signup pede CPF (validado pelo algoritmo brasileiro), telefone mascarado e setor (enum) — não avança sem os três
  2. Colaborador antigo que ainda não tem CPF/telefone/setor consegue preencher após login sem ser bloqueado
  3. Admin tem seção de arquitetos com listar/criar/editar/excluir funcionando ponta-a-ponta
  4. Form de criar cliente aceita contato, CPF/CNPJ e seletor de arquiteto (autocomplete contra `arquitetos`), todos opcionais
  5. Produto existente no admin pode ter arquiteto atribuído/alterado via edição
**Plans**: TBD
**UI hint**: yes

### Phase 3: Produtos & Importação
**Goal**: Catálogo de produtos é gerenciável do zero (cadastro manual claro) e importação CSV passa a ser ferramenta de verdade (create/update/imagens/preview/erros)
**Depends on**: Phase 2 (arquiteto precisa estar selecionável no form de produto)
**Requirements**: PROD-01, PROD-02, IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-06
**Success Criteria** (what must be TRUE):
  1. Admin tem formulário manual de produto com nome, descrição, upload de imagem, preço, preço mínimo e seletor de arquiteto — salva e aparece no catálogo
  2. Os 16 produtos atuais sem descrição/foto/preço estão cadastrados em produção via UI
  3. CSV importado cria produtos novos (não só atualiza) e atualiza preços via SKU/código
  4. CSV aceita coluna de imagem (URL ou caminho) e correlaciona automaticamente ao produto correto
  5. Tela de importação mostra instruções, exemplo baixável, preview (created vs updated vs erros por linha) e falha em 1 linha não aborta o batch
**Plans**: TBD
**UI hint**: yes

### Phase 4: Drive RLS & Reorganização Admin
**Goal**: Drive isolado por colaborador (admin vê tudo, colab só o seu) e painel admin reorganizado com visualização de pedido, tela de preços e docs de exceção
**Depends on**: Phase 2 (admin já tem arquiteto e cadastros novos; reorg precisa desses blocos existirem)
**Requirements**: ACC-01, ACC-02, ACC-03, ACC-04, ADM-01, ADM-02, ADM-03, ADM-04, ADM-05
**Success Criteria** (what must be TRUE):
  1. Colaborador autenticado vê e grava apenas arquivos onde `colaborador_id = auth.uid()`; admin vê todos os arquivos de todos
  2. Upload no Drive associa automaticamente ao `colaborador_id` do usuário logado (sem campo manual)
  3. Admin tem visualização detalhada de pedido mostrando cliente, arquiteto, ambientes, sistemas, itens e totais
  4. Admin tem tela dedicada de atualização de preços com edição inline e salvamento em batch
  5. Abas do admin reorganizadas em agrupamentos claros (Cadastros / Pedidos / Preços / Exceções) e existe ajuda in-app explicando o fluxo de exceção
  6. Dashboard inicial do admin decidida (mantida simplificada ou removida) — decisão implementada, não pendente
**Plans**: TBD
**UI hint**: yes

### Phase 5: PDF Redesign
**Goal**: PDF do orçamento reconstruído com layout tipográfico profissional, sem as 4 caixas atuais e com texto final formatado — sem quebrar snapshots antigos
**Depends on**: Phase 1 (campos novos de cliente já precisam estar renderizáveis quando presentes; orçamentos antigos sem esses campos continuam ok)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05
**Success Criteria** (what must be TRUE):
  1. PDF gerado tem layout tipográfico limpo (tipografia, margens, hierarquia visual) — não parece screenshot de HTML
  2. As 4 caixas abaixo do Total geral (Prazo de entrega, Garantia, Condições de pagamento, Observações) foram removidas
  3. Conteúdo dessas caixas reaparece como texto formatado ao final do PDF (parágrafos/lista legível)
  4. Card "TOTAL GERAL" revisto visualmente e consistente com o novo design
  5. Orçamento antigo (snapshot já persistido em `orcamentos`) continua renderizando no novo PDF sem crash nem campos quebrados
**Plans**: TBD
**UI hint**: yes

### Phase 6: Filtros & Smoke
**Goal**: Listas do admin passam a ser filtráveis por arquiteto (e combinações) e marco fecha com smoke test manual em produção cobrindo todos os fluxos afetados
**Depends on**: Phase 2 (arquiteto precisa existir), Phase 3 (produtos vinculados), Phase 4 (reorganização admin), Phase 5 (PDF novo)
**Requirements**: FIL-01, FIL-02, FIL-03, FIL-04, WRAP-01
**Success Criteria** (what must be TRUE):
  1. Lista de clientes, produtos e orçamentos no admin têm filtro por arquiteto funcional
  2. Filtros combináveis (arquiteto + cliente, arquiteto + período, arquiteto + status) retornam resultado coerente
  3. Smoke test em produção executado cobrindo: signup novo, criar cliente com arquiteto, criar orçamento completo, gerar PDF novo, importar CSV e Drive isolado por colaborador
  4. Nenhum bug visível ou regressão encontrada no smoke — ou, se encontrada, registrada e corrigida antes do fechamento do marco
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema & Prep | 0/3 | Planned | - |
| 2. Cadastros & Arquiteto CRUD | 0/0 | Not started | - |
| 3. Produtos & Importação | 0/0 | Not started | - |
| 4. Drive RLS & Reorganização Admin | 0/0 | Not started | - |
| 5. PDF Redesign | 0/0 | Not started | - |
| 6. Filtros & Smoke | 0/0 | Not started | - |

## Coverage Summary

- **Total v1 requirements:** 42
- **Mapped to phases:** 42
- **Orphaned:** 0
- **Coverage:** 100%

### Distribution

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1 | PREP-01, ARQ-01, ARQ-03, ARQ-04, ARQ-05 | 5 |
| 2 | USR-01, USR-02, USR-03, USR-04, CLI-01, CLI-02, CLI-03, ARQ-02, PROD-03, PROD-04 | 10 |
| 3 | PROD-01, PROD-02, IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-06 | 8 |
| 4 | ACC-01, ACC-02, ACC-03, ACC-04, ADM-01, ADM-02, ADM-03, ADM-04, ADM-05 | 9 |
| 5 | PDF-01, PDF-02, PDF-03, PDF-04, PDF-05 | 5 |
| 6 | FIL-01, FIL-02, FIL-03, FIL-04, WRAP-01 | 5 |

---
*Roadmap created: 2026-04-23 (pivô — escopo UAT descartado, melhorias v1 em vigor)*
