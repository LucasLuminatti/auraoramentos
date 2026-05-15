# Roadmap: AURA

> Roadmap ativo do AURA. Marcos completos ficam em `.planning/milestones/`.

## Active Milestone

> **v1.1 archived 2026-05-15** — todas as 7 phases concluídas, 18/18 reqs delivered (1 deviation: AUTO-02 multi-admin via `has_role`). Archive completo em [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) + [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md). Próximo marco TBD — definir via `/gsd-new-milestone`.

**v1.1 — Polimento UAT + Multi-tenancy + Automação** (ARCHIVED 2026-05-15)

**Defined:** 2026-05-11
**Shipped:** 2026-05-15
**Granularity:** coarse
**Coverage:** 18/18 v1.1 requirements mapped
**Mode:** yolo (parallelization enabled)
**Phase numbering:** continua a partir da Phase 7 (v1.0 terminou na Phase 6)

> **Contexto:** AURA em produção (https://orcamentosaura.com.br). v1.1 = ciclo de polimento pós-UAT real do v1.0, multi-tenancy aditivo replicando padrão Drive D-02 (user_id), e primeira automação assíncrona (aniversário via pg_cron + Resend). Todas as mudanças de schema continuam aditivas — zero destrutivas em dados de produção.

### Phases

- [x] **Phase 7: Schema & Prep v1.1** — Migrations aditivas (`user_id` em arquitetos/clientes, `data_nascimento` em clientes, `status` em orçamentos se faltar, campos de descrição rica em product_variants se faltarem) — desbloqueia 9, 10 e 12 sem mexer em UI
- [x] **Phase 8: Cadastros — Opcionalizar + Imagens Manuais** — Cliente com campos opcionais, arquiteto expandido (nascimento/endereço/banco), produtos coringa AU001..AU016 editáveis, anexo de imagem manual por SKU
- [x] **Phase 9: Multi-tenancy RLS** — Policies de `arquitetos` e `clientes` replicando padrão Drive v1.0 (D-02) + queries dos componentes ajustadas — colaborador só vê o próprio, admin vê tudo (completed 2026-05-15)
- [x] **Phase 10: Wizard — Edição + Status + Descrição rica** — Step 3 editar preço (≥ mínimo) + quantidade, reabrir rascunho, marcar status (aprovado/perdido/pendente), descrição puxando temperatura(K)+potência+IRC+nicho da ImportMaster
 (completed 2026-05-14)
- [x] **Phase 11: PDF v2 + Dashboard** — PDF sem bloco "Sistemas" vazio, "Prazo de Entrega" com texto adicional, tab Início substituindo 6 cards por somatório de orçamentos em aberto (completed 2026-05-15)
- [x] **Phase 12: Automação Aniversário** — pg_cron diário + edge function Resend disparando email 5d antes do aniversário do cliente para o colab dono + admin David Grabarz (completed 2026-05-15)
- [x] **Phase 13: Smoke & UAT Closure** — Smoke prod 4/4 cenários integration PASS + 1 bug crítico (BUG-13-01) fixed inline + archive formal do marco em `.planning/milestones/v1.1-*.md` + MILESTONES.md (completed 2026-05-15)

## Phase Details

### Phase 7: Schema & Prep v1.1
**Goal**: Base de dados pronta para receber multi-tenancy, edição de wizard, descrição rica e automação — todas as migrations aditivas aplicadas em produção sem quebrar nada existente
**Depends on**: Nothing (primeira fase do v1.1; v1.0 já shipped)
**Requirements**: RLS-03, AUTO-03
**Success Criteria** (what must be TRUE):
  1. Tabelas `arquitetos` e `clientes` têm coluna `user_id UUID NOT NULL` em produção (FK `auth.users.id` ON DELETE RESTRICT) — D-01/D-03 elevou para NOT NULL após backfill
  2. Tabela `clientes` tem coluna `data_nascimento DATE NULL` em produção
  3. Tabela `orcamentos.status` tem CHECK constraint enum (`rascunho|aprovado|perdido|pendente`) — UPDATE in-place de `'fechado'` para `'aprovado'`
  4. `product_variants` cobre os campos de descrição rica (auditoria SQL via JSONB; gaps viram FOLLOW-UP, não migration aditiva — D-15/D-17)
  5. Wizard, login, admin, PDF v1/v2 e Drive continuam funcionando em produção sem regressão visível (smoke D-22 confirma)
**Plans**: 4 plans
- [x] 07-01-PLAN.md — Migration arquitetos+clientes user_id (RLS-03; pre-flight + backfill admin + NOT NULL + indexes)
- [x] 07-02-PLAN.md — Migration clientes.data_nascimento (AUTO-03; aditivo + index BTREE)
- [x] 07-03-PLAN.md — Migration orcamentos.status enum (UPDATE fechado→aprovado + CHECK constraint)
- [x] 07-04-PLAN.md — Audit product_variants + supabase db push em prod + smoke D-22 + docs (PUSH-LOG, SMOKE-RESULTS, SUMMARY)

### Phase 8: Cadastros — Opcionalizar + Imagens Manuais
**Goal**: Cadastros deixam de bloquear o usuário em campos não-essenciais, arquiteto vira ficha completa do escritório, produtos coringa AU001..AU016 ganham descrição/imagem editável e admin pode anexar imagem em qualquer SKU sem precisar de import em massa
**Depends on**: Phase 7 (não tem dependência forte, mas roda em paralelo com 9 depois do schema)
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04
**Success Criteria** (what must be TRUE):
  1. Form de criar cliente aceita salvar sem Contato, sem CPF/CNPJ e sem Arquiteto (só Nome obrigatório) — validação de obrigatoriedade removida nos 3 campos
  2. Form de arquiteto permite preencher data de nascimento, endereço do escritório e dados bancários (campos opcionais) — todos persistem e voltam no edit
  3. Admin consegue editar descrição e imagem dos 16 SKUs coringa AU001..AU016 (anteriormente fixos/só leitura) e mudança aparece imediatamente na lista de produtos
  4. Admin tem botão "anexar/trocar imagem" em qualquer linha de produto na tab Cadastros > Produtos — upload manual funciona e substitui imagem anterior (complementa ImportImagens em massa)
**Plans**: 5 plans
- [x] 08-01-PLAN.md — Migration arquitetos.expand_fields SQL (FORM-02, aditivo, 7 colunas + 1 index)
- [x] 08-02-PLAN.md — ClienteDialog opcionalizar Contato/CPF/Arquiteto (FORM-01)
- [x] 08-03-PLAN.md — Botão ImageIcon inline em Cadastros > Produtos (FORM-03 + FORM-04)
- [x] 08-04-PLAN.md — [BLOCKING] supabase db push + types regen + PUSH-LOG (FORM-02 gate)
- [x] 08-05-PLAN.md — ArquitetoDialog expand 7 campos + smoke prod FORM-01..04 (SMOKE-RESULTS 5/5 PASS + hotfix user_id Phase 7 regression)
**UI hint**: yes

### Phase 9: Multi-tenancy RLS
**Goal**: Cada colaborador vê apenas os arquitetos e clientes que ele cadastrou, admin vê tudo — replicando exatamente o padrão validado em produção no Drive v1.0 (D-02 errata, `user_id` direto contra `auth.uid()`)
**Depends on**: Phase 7 (precisa do `user_id` em arquitetos/clientes existir antes)
**Requirements**: RLS-01, RLS-02
**Success Criteria** (what must be TRUE):
  1. Colaborador autenticado vê e edita apenas linhas de `clientes` onde `user_id = auth.uid()`; clientes de outros colabs não aparecem em nenhuma lista do app
  2. Colaborador autenticado vê e edita apenas linhas de `arquitetos` onde `user_id = auth.uid()`; arquitetos de outros colabs não aparecem nos autocompletes nem na lista
  3. Admin (`has_role(admin)`) continua vendo todos os clientes e todos os arquitetos de todos os colaboradores em todas as listas
  4. Criação de cliente/arquiteto preenche `user_id` automaticamente com o `auth.uid()` do usuário logado (sem campo manual no form)
  5. Smoke com 2 contas reais (colab A + colab B) confirma isolamento bilateral; admin vê união dos dois
**Plans**: 7 plans
- [x] 09-01-PLAN.md — Preflight callsite audit (11 callsites em arquitetos/clientes classificados — 0 Risk; Phase 9 confirmada zero-code-change no frontend)
- [x] 09-02-PLAN.md — PRE-PUSH snapshot pg_policies baseline (6 policies legadas confirmadas, zero divergência D-02) — documentado retroativamente 2026-05-15
- [x] 09-03-PLAN.md — Migration SQL `20260514000001_arquitetos_clientes_rls.sql` (8 policies + 2 DEFAULTs + 6 DROPs, BEGIN/COMMIT atômico) — commit `31ef3bc` 2026-05-14
- [x] 09-04-PLAN.md — Apply migration em prod (version `20260514154347` em schema_migrations, RLS-01 + RLS-02 estruturalmente live) — documentado retroativamente 2026-05-15
- [x] 09-05-PLAN.md — Signup manual do segundo colaborador (checkpoint humano)
- [x] 09-06-PLAN.md — Smoke RLS bilateral em prod (colab A vs B + admin)
- [x] 09-07-PLAN.md — Close-out Phase 9 (verification + STATE/ROADMAP update)

### Phase 10: Wizard — Edição + Status + Descrição rica
**Goal**: Wizard deixa de ser one-way — colaborador pode ajustar preço/quantidade no Step 3 antes do PDF, reabrir rascunho do ponto onde parou, marcar status do orçamento após geração e produtos exibem descrição rica (temperatura/potência/IRC/nicho) puxada da planilha master
**Depends on**: Phase 7 (status field + descrição fields no schema)
**Requirements**: WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05
**Success Criteria** (what must be TRUE):
  1. No Step 3, colaborador pode editar o preço unitário de cada item com floor automático em `preco_minimo` — input abaixo do mínimo trava com mensagem clara
  2. No Step 3, colaborador pode editar a quantidade de cada item — totais (subtotal, total geral, agrupamento de rolos) recalculam ao vivo
  3. Orçamento com `status='rascunho'` é clicável em Clientes/Pedidos e abre o wizard no Step onde parou, com dados/ambientes/sistemas pré-preenchidos
  4. Após gerar PDF, orçamento pode ser marcado pelo colab ou admin com status `aprovado`, `perdido` ou `pendente` — status persiste e aparece em Pedidos
  5. Descrição do produto no wizard (cards de ambiente + Step 3) e no PDF gerado mostra `nome + temperatura(K) + potência + IRC + nicho` quando os campos existem; orçamentos antigos sem esses campos continuam renderizando o nome cru
**Plans**: TBD
**UI hint**: yes

### Phase 11: PDF v2 + Dashboard
**Goal**: PDF v2 deixa de renderizar bloco "Sistemas" zerado e ganha texto adicional no Prazo de Entrega; tab Início do admin troca 6 cards de métrica por um único card de orçamentos em aberto somando todos os reps
**Depends on**: Phase 10 (status precisa existir pra contar "em aberto" no dashboard)
**Requirements**: PDF-01, PDF-02, DASH-01
**Success Criteria** (what must be TRUE):
  1. PDF v2 não renderiza o bloco "Sistemas de Iluminação" quando o sistema tem 0m de fita, 0W de consumo e 0 driver — bloco some por completo, sem placeholder vazio
  2. Seção "Prazo de Entrega" no PDF v2 inclui "prazo médio de 20 dias úteis" após o texto atual, mantendo formatação prose
  3. Tab Início do admin exibe um único card destacado com o **somatório em R$ de orçamentos em aberto** (soma de todos os reps, status ≠ aprovado/perdido) — os 6 cards anteriores (Receita Efetiva/Prevista/Pipeline/Ticket Médio/Conversão/Ciclo Médio) foram removidos
  4. Orçamentos antigos (snapshots pré-v1.1) continuam renderizando no PDF v2 sem crash e sem texto duplicado de "20 dias úteis"
**Plans**: 3 plans
- [x] 11-01-PLAN.md — PDF-01 (esconder sistemas vazios) + PDF-02 (prazo 20 dias úteis) em src/lib/pdfTemplates/v2.ts
- [x] 11-02-PLAN.md — DASH-01 remover 6 cards + adicionar card único Orçamentos em Aberto em AdminDashboard.tsx
- [x] 11-03-PLAN.md — Smoke manual em prod (checkpoint humano cobrindo 4 success criteria + SQL cross-check)
**UI hint**: yes

### Phase 12: Automação Aniversário
**Goal**: Sistema dispara automaticamente, 5 dias antes do aniversário do cliente, um email para o colaborador dono daquele cliente e para o admin David Grabarz — sem ação manual, via pg_cron diário + edge function Resend
**Depends on**: Phase 7 (precisa do `data_nascimento` em clientes), Phase 9 (precisa do `user_id` em clientes para resolver "colaborador dono")
**Requirements**: AUTO-01, AUTO-02
**Success Criteria** (what must be TRUE):
  1. Quando um cliente tem `data_nascimento` preenchida e a data atual + 5 dias bate com mês/dia do aniversário, o colaborador dono (`user_id`) recebe email com nome do cliente e data do aniversário
  2. No mesmo gatilho, o admin David Grabarz (email fixo configurável via env/config) recebe o mesmo email
  3. Cron diário roda automaticamente em produção (pg_cron ativo) — não depende de ação manual nem de um usuário estar logado
  4. Cliente sem `data_nascimento` ou com aniversário fora da janela de 5 dias não dispara email (zero falso-positivo)
  5. Logs da edge function registram cada disparo com cliente_id, colab destinatário e timestamp — auditável em caso de falha de entrega Resend
**Plans**: 3 plans
- [x] 12-01-PLAN.md — Migration tabela aniversario_envios + stored functions (buscar_aniversariantes_d5 + buscar_admins_emails) + push prod
- [x] 12-02-PLAN.md — Edge function aniversario-clientes (Deno + Resend) + deploy prod via MCP + smoke 2-run E2E PASS
- [x] 12-03-PLAN.md — Vault secret manual + migration cron schedule (pg_cron 1.6.4 + pg_net 0.20.0) aplicada + smoke pós-deploy 200 OK (completed 2026-05-15)

### Phase 13: Smoke & UAT Closure
**Goal**: Marco v1.1 validado em produção via smoke integration cross-feature, bug crítico capturado/corrigido inline, archive formal do marco
**Depends on**: Phase 8, Phase 9, Phase 10, Phase 11, Phase 12
**Requirements**: (closure — sem REQ-ID mapeado, padrão Phase 6 v1.0 WRAP-01)
**Success Criteria** (what must be TRUE):
  1. Smoke prod 4/4 cenários integration PASS (cliente+aniversário pipeline, orçamento full flow, RLS cross-feature, trigger manual edge fn)
  2. Bug crítico BUG-13-01 (ClienteDialog faltava campo `data_nascimento`) corrigido inline (commit `b3ae4db`) + re-test PASS
  3. ROADMAP/REQUIREMENTS/STATE/PROJECT atualizados com outcome (18 REQs classificados)
  4. Marco arquivado em `.planning/milestones/v1.1-*.md` + MILESTONES.md
**Plans**: 2 plans
- [x] 13-01-PLAN.md — Integration smoke + bug capture (4 cenários cross-feature, BUG-13-01 fixed inline)
- [x] 13-02-PLAN.md — Milestone archive (outcome + v1.1-*.md + MILESTONES.md + ROADMAP/STATE/PROJECT/REQUIREMENTS)
**Status**: Complete (2026-05-15) — 4/4 smoke PASS + 1 bug crítico fixed inline + archive completo

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Schema & Prep v1.1 | 4/4 | Complete | 2026-05-11 |
| 8. Cadastros — Opcionalizar + Imagens | 5/5 | Complete (smoke 5/5 PASS) | 2026-05-14 |
| 9. Multi-tenancy RLS | 7/7 | Complete    | 2026-05-15 |
| 10. Wizard — Edição + Status + Descrição | 5/5 | Complete    | 2026-05-14 |
| 11. PDF v2 + Dashboard | 3/3 | Complete    | 2026-05-15 |
| 12. Automação Aniversário | 3/3 | Complete    | 2026-05-15 |
| 13. Smoke & UAT Closure | 2/2 | Complete   | 2026-05-15 |

## Coverage Summary

- **Total v1.1 requirements:** 18
- **Mapped to phases:** 18
- **Orphaned:** 0
- **Coverage:** 100%

### Distribution

| Phase | Requirements | Count |
|-------|--------------|-------|
| 7 | RLS-03, AUTO-03 | 2 |
| 8 | FORM-01, FORM-02, FORM-03, FORM-04 | 4 |
| 9 | RLS-01, RLS-02 | 2 |
| 10 | WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05 | 5 |
| 11 | PDF-01, PDF-02, DASH-01 | 3 |
| 12 | AUTO-01, AUTO-02 | 2 |
| 13 | (closure — sem REQ mapeado) | 0 |

## Shipped Milestones

- **v1.1 — Polimento UAT + Multi-tenancy + Automação** (2026-05-11 → 2026-05-15, 5 dias): 17 reqs delivered + 1 with deviation (AUTO-02 multi-admin via has_role), 7 phases, 29 plans, 96 commits, 11 migrations aditivas, 1 nova edge fn (aniversario-clientes). Highlights: multi-tenancy RLS, automação aniversário D-5, wizard editável, descrição rica, PDF v2 sem bloco vazio, dashboard card único. → [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) · [MILESTONES.md](milestones/MILESTONES.md)
- **v1.0 — Melhorias v1** (2026-04-23 → 2026-05-07): cadastro expandido (CPF/telefone/setor), arquiteto como entidade, importação CSV de produtos, Drive RLS por colaborador, admin reorganizado, PDF v2 (Playfair+Inter), filtros por arquiteto, smoke prod 8/8 → [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

---
*Last updated: 2026-05-15 — milestone v1.1 archived (17 DELIVERED + 1 DELIVERED with deviation = 18/18 covered). Phase 13 smoke 4/4 PASS + BUG-13-01 fixed inline. Próximo: definir v1.2 via `/gsd-new-milestone`.*
