# AURA

## What This Is

Sistema web de criação de orçamentos de iluminação da Luminatti, em produção (https://orcamentosaura.com.br + Vercel kappa). Colaboradores montam orçamentos em wizard de 3 passos (cliente/projeto → ambientes com sistemas de LED → revisão e PDF), e admins gerenciam produtos, preços, clientes, exceções e documentos. Backend em Supabase (auth, Postgres, edge functions, storage); frontend em React 18 + Vite + TypeScript + shadcn-ui.

## Core Value

Um colaborador consegue montar um orçamento real, do zero ao PDF entregue, com dados organizados por arquiteto e filtráveis — e o admin consegue controlar preços, pedidos e margens sem planilha paralela.

## Current Milestone: v1.1 — Polimento UAT + Multi-tenancy + Automação

**Goal:** Resolver as fricções que apareceram no uso real do v1.0 — opcionalizar campos de cadastro, isolar dados por colaborador (RLS), permitir edição de rascunho + preço no wizard, lapidar PDF e dashboard, abrir automação de aniversário e dar ao admin upload manual de imagens em qualquer produto.

**Target features (6 frentes):**

1. **Cadastros — opcionalizar e expandir** — Cliente (Contato/CPF/Arquiteto opcionais), Arquiteto (+ data nascimento, endereço escritório, dados bancários), Produtos coringa AU001..AU016 editáveis, anexo de imagens manual em qualquer SKU pelo admin
2. **Multi-tenancy por colaborador** — RLS aditivo replicando padrão Drive (`user_id` em `arquitetos` e `clientes`); cada colab vê só seus, admin vê tudo
3. **Wizard / Orçamento — edição** — Step 3 ajustar preço (≥ mínimo) + qtd, editar rascunho via wizard, status no orçamento (aprovado/perdido/pendente), descrição do produto puxando temperatura(K)+potência+IRC+nicho da planilha master ImportMaster
4. **PDF v2 — ajustes** — Não renderizar bloco "Sistemas" vazio (0m/0W/0 driver), "Prazo de Entrega" acrescentar "prazo médio de 20 dias úteis"
5. **Dashboard — métrica única** — Substituir 6 cards por **somatório de orçamentos em aberto** (todos os reps) só na tab Início
6. **Automação — aniversário do cliente** — 5 dias antes → email pro colab dono + admin David Grabarz; requer `data_nascimento` + pg_cron + edge fn Resend

**Pré-requisito bloqueante (fix por fora do marco):** `request-access` quebrado em prod (2026-05-11) — David Grabarz + Lenny não conseguem solicitar convite. Fix via `/gsd-quick` ou `/gsd-debug` antes da execução do v1.1.

## Current State

**Latest milestone shipped:** v1.0 — Melhorias v1 (2026-04-23 → 2026-05-07)

Em prod hoje:
- **Wizard 3 passos** (Step1 dados → Step2 ambientes → Step3 revisão → PDF v2)
- **Admin reorganizado** em 5 sub-tabs: Início (dashboard) / Cadastros (Produtos/Arquitetos/Clientes/Colaboradores) / Pedidos / Preços (Atualização + Importação) / Exceções
- **Arquiteto como entidade** com FK em clientes/produtos + CRUD no admin + filtros em 3 listas
- **Signup expandido** (CPF validado + telefone BR + setor enum: Comercial/Projetos/Logística/Financeiro) com gate em `allowed_users`
- **Importação CSV** de produtos com preview create/update + ImportMaster XLSX one-shot (2.088 variants oficiais) + ImportImagens
- **Drive RLS por user_id** (Phase 4 D-02 errata) — colaborador isolado, admin vê tudo, signed URLs
- **PDF v2** (Playfair Display + Inter, header limpo, total com barra dourada, prose final formatada) com **roteador v1/v2** retro-compatível para snapshots pré-2026-05-07
- **Filtros combinados em Pedidos** (arquiteto + cliente + período + status) via JOIN `clientes!inner` + popover mobile com badge contador

**v1.1 em prod (parcial):**
- **Automação Aniversário D-5** (Phase 12, 2026-05-15) — cron diário `0 9 * * *` UTC chama edge fn `aniversario-clientes` (Deno + Resend) que envia email pra colab dono + admins quando cliente faz aniversário em D+5. Log auditável em `aniversario_envios` (RLS admin-only, UNIQUE idempotência). Vault `service_role_key` autentica cron via runtime subquery (sem JWT em git).

Schema:
- 11 migrations aditivas aplicadas (zero destrutivas; +2 em Phase 12: `aniversario_envios` table + `aniversario_cron_schedule`)
- 5 edge functions deployed: `create-colaborador`, `import-produtos`, `request-access`, `review-access`, `aniversario-clientes`
- Extensions: pg_cron 1.6.4 + pg_net 0.20.0 (habilitadas em Phase 12)

Validação prod (2026-05-07): smoke 8/8 itens passed via Playwright + 2 contas reais.

## Validated Requirements (v1.0)

Migradas pra `.planning/milestones/v1.0-REQUIREMENTS.md`. Resumo: 40 entregues + 1 obsoleto (PROD-02 — DB já tinha 0 produtos sem desc/preço; substituído por SKUs coringa AU001..AU016) + 1 deferido (IMP-02 — preço por CSV; vai pra phase de preços em v1.1+).

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

## Key Decisions (carryover de v1.0)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Arquiteto = entidade própria com FK | Filtros confiáveis, evita divergência textual | ✓ Validated v1.0 |
| Representante = colaborador existente | Setor resolve; não inflacionar roles | ✓ Validated v1.0 |
| Margem adiada para marco 2 | Depende de tabela de custos | — Pending |
| CPF validado no signup | Dado vira base de comissões; entrar sujo cria passivo | ✓ Validated v1.0 |
| Importação via CSV manual | Fluxo realista; integração ERP fica pra marco futuro | ✓ Validated v1.0 |
| Reescrever PDF do zero | Redesign + remover caixas não se resolve com patch | ✓ Validated v1.0 |
| Schema aditivo, nunca destrutivo | Dados de produção existem | ✓ Validated v1.0 (9 migrations sem regressão) |
| Drive RLS via user_id (não colaborador_id) | Direto com auth.uid(); evita confusão (Phase 4 D-02 errata) | ✓ Validated v1.0 |
| Storage policy via tabela cliente_arquivos | Não migrar paths legados (Phase 4 D-09 errata) | ✓ Validated v1.0 |
| Dashboard como sub-tab Início (não rota) | Consistência com tab strip (Phase 4 D-26 errata) | ✓ Validated v1.0 |
| PDF v1/v2 roteador via `pdf_template_version` | Backwards-compat sem dual-render | ✓ Validated v1.0 |
| Filtros via URL search params (não global) | Compartilhável + bookmark + sobrevive refresh; evita filtro fantasma | ✓ Validated v1.0 |

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
*Last updated: 2026-05-15 — Phase 12 completed (Automação Aniversário D-5 live em prod)*
