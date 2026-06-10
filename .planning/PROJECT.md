# AURA

## What This Is

Sistema web de criação de orçamentos de iluminação da Luminatti, em produção (https://orcamentosaura.com.br + Vercel kappa). Colaboradores montam orçamentos em wizard de 3 passos (cliente/projeto → ambientes com sistemas de LED → revisão e PDF), e admins gerenciam produtos, preços, clientes, exceções e documentos. Backend em Supabase (auth, Postgres, edge functions, storage); frontend em React 18 + Vite + TypeScript + shadcn-ui.

## Core Value

Um colaborador consegue montar um orçamento real, do zero ao PDF entregue, com dados organizados por arquiteto e filtráveis — e o admin consegue controlar preços, pedidos e margens sem planilha paralela.

## Current Milestone: v1.2 — Correções UAT do Wizard de Sistemas de Iluminação

**Goal:** Corrigir o subsistema fita/perfil/driver/módulos/magneto do wizard com base nos 19 feedbacks dos funcionários (UAT 2026-06-10, com prints) — sem quebrar o caminho de luminária comum (validado) nem orçamentos antigos (PDF v1/v2).

**Target features (5 áreas):**
- **Catálogo & Busca (dados):** perfis/drivers que somem na busca por `tipo_produto` errado (LM3475, LM3291, WALL WASHER, família CANTONEIRA incompleta); dica MAGNETO trocada com TINY.
- **Sistemas compostos (modular/magneto/tiny):** fluxo de montagem (módulos + fita + driver + componentes) em vez de entrar como luminária avulsa; avisos com oferta de driver obrigatório.
- **Tensão/Voltagem (redução de erro):** inferir/validar voltagem do driver vs fita; permitir tensão diferente por ambiente.
- **Cálculo/Contabilização:** fita sem perfil contabilizar metragem; metragem do perfil automática na descrição; passadas não travadas (+ regra perfil 50mm = até 3).
- **Apresentação/UX do resumo:** LOCAL no resumo global; resolver duplicação fita (ambiente + resumo); drivers por ambiente; duplicar/reusar sistema entre ambientes; avisar ao avançar sem lâmpada.

**Origem:** documento "COMENTÁRIOS - SITE ORÇAMENTO" (19 pontos com prints), coletado de funcionários da Aura em 2026-06-10.

Roadmap começa no **phase 14** (continua numeração do v1.1).

## Current State

**Latest milestone shipped:** v1.1 — Polimento UAT + Multi-tenancy + Automação (2026-05-11 → 2026-05-15, 5 dias)

Em prod hoje (v1.0 + v1.1):
- **Wizard 3 passos editável** (Step1 dados → Step2 ambientes → Step3 revisão com edição preço/qtd + status pós-PDF → PDF v2)
- **Admin reorganizado** em 5 sub-tabs: Início (dashboard com card único Orçamentos em Aberto) / Cadastros (Produtos/Arquitetos/Clientes/Colaboradores) / Pedidos / Preços / Exceções
- **Arquiteto como entidade** com FK em clientes/produtos + CRUD admin (expandido com nascimento/endereço/banco) + filtros em 3 listas
- **Signup expandido** (CPF validado + telefone BR + setor enum) com gate em `allowed_users`
- **Cadastros opcionalizados** — cliente sem Contato/CPF/Arquiteto + arquiteto expandido + AU001..16 editáveis + ImageIcon inline em qualquer SKU
- **Importação CSV** de produtos com preview + ImportMaster XLSX one-shot (2.088 variants oficiais) + ImportImagens
- **Multi-tenancy RLS** em `arquitetos` + `clientes` (Phase 9) — colab vê só `user_id = auth.uid()`, admin vê tudo via `has_role`, smoke bilateral E2E PASS 5/5
- **Drive RLS por user_id** (Phase 4 D-02 errata) — colaborador isolado, admin vê tudo, signed URLs
- **PDF v2** (Playfair Display + Inter, header limpo, total com barra dourada, prose final formatada) **sem bloco "Sistemas" vazio** + prazo "20 dias úteis" + descrição rica (temp/pot/IRC/nicho da ImportMaster) com **roteador v1/v2** retro-compatível
- **Dashboard métrica única** — card "Orçamentos em Aberto" substitui 6 cards de métrica
- **Filtros combinados em Pedidos** (arquiteto + cliente + período + status)
- **Automação Aniversário D-5** (Phase 12) — cron diário `0 9 * * *` UTC chama edge fn `aniversario-clientes` (Deno + Resend) → email pra colab dono + admins via `has_role(admin)` dinâmico. Log auditável em `aniversario_envios` (RLS admin-only, UNIQUE idempotência). Vault `service_role_key` autentica cron via runtime subquery.

Schema:
- 20 migrations aditivas aplicadas (zero destrutivas; v1.0 = 9 + v1.1 = 11)
- 5 edge functions deployed: `create-colaborador`, `import-produtos`, `request-access`, `review-access`, `aniversario-clientes`
- Extensions: pg_cron 1.6.4 + pg_net 0.20.0 (habilitadas em Phase 12)

Validação prod:
- v1.0 smoke 8/8 itens passed (2026-05-07, Playwright + 2 contas reais)
- v1.1 smoke 4/4 cenários integration PASS (2026-05-15, Phase 13) + 1 bug crítico BUG-13-01 fixed inline

## Validated Requirements (v1.0)

Migradas pra `.planning/milestones/v1.0-REQUIREMENTS.md`. Resumo: 40 entregues + 1 obsoleto (PROD-02 — DB já tinha 0 produtos sem desc/preço; substituído por SKUs coringa AU001..AU016) + 1 deferido (IMP-02 — preço por CSV; vai pra phase de preços em v1.1+).

## Validated Requirements (v1.1)

Migradas pra `.planning/milestones/v1.1-REQUIREMENTS.md`. Resumo: 17 entregues + 1 com deviation (AUTO-02 — multi-admin via `has_role(admin)` em vez de hardcode "David Grabarz") + 0 deferidos = 18/18 covered (100%).

**Categorias entregues:** FORM-01..04 (cadastros opcionalizados/expandidos), RLS-01..03 (multi-tenancy em arquitetos/clientes), WIZ-01..05 (wizard editável + descrição rica), PDF-01..02 (PDF v2 lapidado), DASH-01 (card único Orçamentos em Aberto), AUTO-01..03 (automação aniversário D-5).

**Bug crítico capturado e resolvido inline:** BUG-13-01 (ClienteDialog faltava campo `data_nascimento` apesar do schema existir desde Phase 7; commit `b3ae4db`).

**Follow-ups deferidos pra v1.2+:** WR-02 pg_net monitoring, SPF/DKIM domínio (email Junk Outlook), dedup `toList` aniversário, IMP-02 preço CSV (carryover v1.0), refatoração fórmulas, margem, docs+testes, bucket `produto-imagens` singular cleanup.

## Out of Scope (perpetual)

| Feature | Reason |
|---------|--------|
| Margem no pedido | Marco 2 — depende de tabela de preços/custos que Lenny ainda vai receber |
| Refatoração de cálculos | Marco 3 — fórmulas só mexidas depois de documentadas e revisadas |
| Módulo de comissões | Marco 4 — feature nova complexa |
| Role nova "representante" | Representante = colaborador; não inflacionar roles |
| Validação de CPF/CNPJ no cliente (form) | Campos opcionais; validação só no signup |
| Integração com ERP | Sem necessidade imediata; CSV manual resolve |
| Redesign geral de UI | Ajustes pontuais sim (PDF, admin), redesign não |
| Testes automatizados (Vitest/Playwright) | Marco de qualidade próprio |

## Next Milestone Goals (post-v1.1)

Candidatos provisórios derivados de v1.0 ainda na fila pra v1.2+:
- **Preços via CSV** (IMP-02 deferido) + tabela de custos pra desbloquear margem
- **Margem no pedido** — exibir margem por orçamento, agregada por arquiteto/colaborador/período
- **Documentação + testes das fórmulas de cálculo** (fita/driver/perfil/agrupamento de rolos) antes de qualquer refactor

## Constraints (perpetual)

- **Tech stack:** React 18 + Vite + TypeScript + Supabase + shadcn-ui — sem trocar stack
- **Schema:** Mudanças aditivas (novas colunas nullable, novas tabelas) — **não quebrar** queries existentes
- **Compatibilidade:** Snapshots/orçamentos antigos continuam renderizando (PDF v1/v2 router cobre isso)
- **Fluxo atual:** Wizard 3 passos não pode quebrar
- **Segurança:** RLS do Drive validada com 2 contas reais (v1.0 smoke #7); admin vê tudo, colab só o próprio
- **Campos opcionais vs obrigatórios:** cliente (contato/CPF/arquiteto) opcionais; signup (CPF/telefone/setor) obrigatórios

## Key Decisions (carryover de v1.0 + v1.1)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Arquiteto = entidade própria com FK | Filtros confiáveis, evita divergência textual | ✓ Validated v1.0 |
| Representante = colaborador existente | Setor resolve; não inflacionar roles | ✓ Validated v1.0 |
| Margem adiada para marco 2 | Depende de tabela de custos | — Pending |
| CPF validado no signup | Dado vira base de comissões; entrar sujo cria passivo | ✓ Validated v1.0 |
| Importação via CSV manual | Fluxo realista; integração ERP fica pra marco futuro | ✓ Validated v1.0 |
| Reescrever PDF do zero | Redesign + remover caixas não se resolve com patch | ✓ Validated v1.0 |
| Schema aditivo, nunca destrutivo | Dados de produção existem | ✓ Validated v1.0 (9 migrations) + v1.1 (11 migrations) — zero regressão |
| Drive RLS via user_id (não colaborador_id) | Direto com auth.uid(); evita confusão (Phase 4 D-02 errata) | ✓ Validated v1.0 + replicado em arquitetos/clientes Phase 9 |
| Storage policy via tabela cliente_arquivos | Não migrar paths legados (Phase 4 D-09 errata) | ✓ Validated v1.0 |
| Dashboard como sub-tab Início (não rota) | Consistência com tab strip (Phase 4 D-26 errata) | ✓ Validated v1.0 |
| PDF v1/v2 roteador via `pdf_template_version` | Backwards-compat sem dual-render | ✓ Validated v1.0 + estendido v1.1 (PDF-01/02 e WIZ-05 sem quebrar snapshots) |
| Filtros via URL search params (não global) | Compartilhável + bookmark + sobrevive refresh | ✓ Validated v1.0 |
| Multi-tenancy zero-code-change no client (RLS + DEFAULT auth.uid()) | Replica padrão Drive D-02; preflight 11 callsites = 0 Risk | ✓ Validated v1.1 (Phase 9) |
| Multi-admin dinâmico via `has_role(admin)` (D-22) | Hardcode "David Grabarz" não escala; RPC `buscar_admins_emails()` suporta N admins sem redeploy | ✓ Validated v1.1 (Phase 12, AUTO-02 deviation) |
| Stored fns SECURITY DEFINER vs JOIN inline | Evita N+1, desacopla schema da edge fn, contorna restrição `auth.users` | ✓ Validated v1.1 (Phase 12) |
| UNIQUE(cliente_id, ano_referencia) = idempotência atomic | Edge fn trata PG 23505 como "já enviado"; row única por (cliente, ano) preserva auditoria | ✓ Validated v1.1 (Phase 12) |
| Vault subquery em RUNTIME pro cron | Cron lê `decrypted_secret` a cada disparo; rotação propaga sem redeploy | ✓ Validated v1.1 (Phase 12) |
| Builder `construirDescricaoRica` com fallback ao snapshot puro | ImportMaster é fonte da verdade; snapshots antigos sem campos rich continuam renderizando | ✓ Validated v1.1 (Phase 10 WIZ-05) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Current State + Validated Requirements + Key Decisions

---
*Last updated: 2026-05-15 — milestone v1.1 shipped (17 DELIVERED + 1 DELIVERED with deviation = 18/18 covered). Archive completo em `.planning/milestones/v1.1-*.md` + `MILESTONES.md`. Próximo marco TBD.*
