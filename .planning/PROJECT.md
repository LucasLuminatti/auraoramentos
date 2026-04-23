# AURA

## What This Is

Sistema web de criação de orçamentos de iluminação da Luminatti, em produção no Vercel (URL kappa). Colaboradores montam orçamentos em um wizard de 3 passos (cliente/projeto → ambientes com sistemas de LED → revisão e PDF), e admins gerenciam produtos, preços, clientes, exceções e documentos. Backend em Supabase (auth, Postgres, edge functions, storage); frontend em React 18 + Vite + TypeScript + shadcn-ui.

## Core Value

Um colaborador consegue montar um orçamento real, do zero ao PDF entregue, com dados organizados por arquiteto e filtráveis — e o admin consegue controlar preços, pedidos e margens sem planilha paralela.

## Requirements

### Validated

<!-- Inferido do codebase já em produção (ver .planning/codebase/) -->

- ✓ **AUTH-01** Login com email/senha via Supabase Auth — existing
- ✓ **AUTH-02** Fluxo de recuperação de senha (forgot/reset) — existing
- ✓ **AUTH-03** Request access + review access (gate de cadastro via `allowed_users`) — existing
- ✓ **AUTH-04** Roles admin vs colaborador via tabela `user_roles` + hook `useUserRole` — existing
- ✓ **AUTH-05** Colaborador criado automaticamente no primeiro login via edge function — existing
- ✓ **ORC-01** Wizard 3 passos: dados do orçamento → ambientes → revisão — existing
- ✓ **ORC-02** Step 1: seleção de colaborador e tipo de revisão — existing
- ✓ **ORC-03** Step 2: CRUD de ambientes com luminárias e sistemas de iluminação (fita + driver + perfil opcional) — existing
- ✓ **ORC-04** Step 3: cálculos de metragem, drivers, agrupamento de rolos (5/10/15m), totais e detecção de violação de preço — existing
- ✓ **ORC-05** Geração de PDF client-side via HTML2PDF (download direto) — existing
- ✓ **ORC-06** Persistência de snapshot do orçamento ao gerar PDF — existing
- ✓ **EXC-01** Colaborador solicita exceção de preço via ExceptionChat — existing
- ✓ **EXC-02** Admin aprova/rejeita exceção com notificação real-time via Supabase subscription — existing
- ✓ **ADM-01** Dashboard admin com abas: Produtos, Colaboradores, Orçamentos, Clientes, Exceções — existing
- ✓ **ADM-02** Importação CSV de produtos, preços e imagens — existing
- ✓ **ADM-03** Busca de produtos com autocomplete — existing
- ✓ **DRV-01** Explorador de arquivos (Drive) para documentos de cliente/projeto — existing

### Active

<!-- Marco 1: Melhorias estruturais v1 — cadastro, produtos, import, acesso, admin, PDF, filtros -->

#### Cadastro
- [ ] **USR-NEW-01** Signup pede CPF (obrigatório, validado), telefone e setor (enum: Comercial/Projetos/Logística/Financeiro)
- [ ] **CLI-NEW-01** Cadastro de cliente ganha campos opcionais: contato, CPF/CNPJ, arquiteto

#### Arquiteto (entidade nova)
- [ ] **ARQ-NEW-01** Entidade `arquitetos` criada no banco com CRUD no admin
- [ ] **ARQ-NEW-02** Clientes e produtos referenciam arquiteto via FK
- [ ] **ARQ-NEW-03** Pedidos/orçamentos filtráveis por arquiteto no admin
- [ ] **ARQ-NEW-04** Produtos e itens filtráveis por arquiteto no admin

#### Produtos
- [ ] **PROD-NEW-01** 16 produtos atuais sem descrição/foto/preço cadastrados manualmente no admin
- [ ] **PROD-NEW-02** Produtos existentes vinculados ao arquiteto correspondente (migração/atualização)
- [ ] **PROD-NEW-03** UI de cadastro manual de produto melhorada (formulário claro, upload de imagem, preço)

#### Importação
- [ ] **IMP-NEW-01** Importação CSV traz produtos novos (não só atualização)
- [ ] **IMP-NEW-02** Importação CSV aceita preços e atualiza produtos existentes
- [ ] **IMP-NEW-03** Importação CSV aceita imagens (URL ou arquivo) e correlaciona automaticamente ao produto
- [ ] **IMP-NEW-04** Tela de importação tem instruções claras: formato do CSV, chave de correlação (SKU), exemplos, preview antes de confirmar

#### Acesso / Visibilidade
- [ ] **ACC-NEW-01** Colaborador vê apenas o próprio Drive (RLS por `colaborador_id`)
- [ ] **ACC-NEW-02** Admin continua vendo todos os Drives

#### Painel Admin
- [ ] **ADM-NEW-01** Visualização de pedido melhorada (dados do cliente, arquiteto, ambientes, sistemas, preços)
- [ ] **ADM-NEW-02** Tela dedicada de atualização de preços atuais (edição em massa)
- [ ] **ADM-NEW-03** Suporte a exceções de preço com instruções claras de uso (documentação in-app ou ajuda contextual)
- [ ] **ADM-NEW-04** Estrutura de gestão de pedidos e precificação reorganizada (abas/seções mais claras)
- [ ] **ADM-NEW-05** Dashboard inicial avaliada — mantém, remove ou simplifica conforme necessidade

#### PDF
- [ ] **PDF-NEW-01** Novo design do PDF: texto limpo, layout profissional (não HTML de print)
- [ ] **PDF-NEW-02** Remover as 4 caixas que ficam embaixo do "Total geral"
- [ ] **PDF-NEW-03** Instruções finais do PDF formatadas como texto legível e bonito

#### Filtros e Organização
- [ ] **FIL-NEW-01** Filtro por arquiteto em: clientes, produtos, orçamentos/pedidos
- [ ] **FIL-NEW-02** Busca combinável (arquiteto + cliente + período + status)

### Out of Scope

<!-- Explicitamente fora deste marco -->

- **Margem no pedido** — será marco 2, depende de tabela de preços que o Lenny vai receber ainda (custo dos produtos precisa entrar no banco antes)
- **Refatoração da lógica de cálculos** — marco posterior, não mexer em fórmulas agora
- **Módulo de comissões** — marco próprio; não cabe aqui
- **UAT manual/bug hunting preventivo** — corrige se aparecer durante as mudanças, mas não é o foco
- **Testes automatizados (Vitest/Playwright)** — marco de qualidade próprio
- **Redesign geral de UI** — ajustes pontuais sim (PDF, admin), redesign não
- **Integração com ERP externo** — marco futuro
- **Perfil/role novo "representante"** — representante = colaborador atual, não criar role nova
- **Validação semântica de CPF/CNPJ no cadastro de cliente** — campos opcionais, sem validação de dígitos neste marco (só no signup)

## Context

**Produto em uso real.** AURA é usado por colaboradores da Luminatti em produção (Vercel — URL kappa). Este marco é o primeiro ciclo de melhorias estruturais pós-lançamento.

**Domínio:** Iluminação LED para projetos arquitetônicos. Os pedidos normalmente são originados por um arquiteto (que especifica o projeto), atendidos por um colaborador da Luminatti (comercial/projetos/logística/financeiro). Daí a necessidade de vincular cliente-produto-pedido ao arquiteto: é a chave organizacional e de filtragem do negócio.

**Setores da Luminatti:** Comercial, Projetos, Logística, Financeiro. Cada colaborador pertence a um setor (novo campo).

**Estado atual relevante:**
- Importação CSV já existe mas não cobre produtos novos + preços + imagens de forma correlacionada
- Admin tem 5 abas (Produtos, Colaboradores, Orçamentos, Clientes, Exceções) — falta Arquitetos e uma tela centralizada de preços
- PDF atual é HTML-to-PDF via `gerarPdfHtml.ts`, com layout que o Lenny quer substituir por algo mais profissional. Hoje o rodapé tem um card escuro "TOTAL GERAL R$ X,XX" e **4 caixas** abaixo dele: **Prazo de entrega** (ícone caixa — "A consultar conforme disponibilidade de estoque"), **Garantia** (ícone escudo — "Produtos com garantia de fábrica conforme especificações do fabricante"), **Condições de pagamento** (ícone cartão — "A definir em negociação comercial"), **Observações** (ícone prancheta — "Valores sujeitos a alteração sem aviso prévio. Proposta válida por 15 dias"). Essas 4 caixas viram texto corrido bem formatado.
- Drive já existe mas sem RLS por colaborador (admin + colab veem a mesma coisa hoje)
- 16 produtos estão na base (mentalmente do Lenny) sem descrição/foto/preço — precisam ser cadastrados

**Git pendente no início:** edge functions `request-access`/`review-access` e `supabase/config.toml` com mudanças não-commitadas. Precisam ser revisadas antes de abrir fase de código.

**Infra:** Supabase vinculado; Resend ativo com `onboarding@resend.dev` (domínio próprio pendente — afeta deliverability).

## Constraints

- **Tech stack**: React 18 + Vite + TypeScript + Supabase + shadcn-ui — sem trocar stack
- **Schema**: Mudanças de schema são aditivas (novas colunas opcionais, novas tabelas) — **não quebrar** queries existentes
- **Compatibilidade**: Orçamentos/snapshots antigos precisam continuar renderizando mesmo sem os novos campos preenchidos
- **Fluxo atual**: Nenhuma mudança pode quebrar o wizard de 3 passos já em uso
- **Timeline**: Sem prazo rígido anunciado, mas pace ágil — uma fase de cada vez, sem inchar marco
- **Segurança**: RLS do Drive precisa ser testada (admin vê tudo, colaborador vê só o seu) — erro aqui vaza documento de cliente
- **Campos opcionais**: Novos campos em cliente (contato, CPF/CNPJ, arquiteto) são opcionais; signup (CPF/telefone/setor) são obrigatórios

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Arquiteto = entidade própria com FK | Filtros confiáveis e escaláveis; evita divergência textual ("João Silva" vs "joão silva"). CRUD no admin. | — Pending |
| Representante = colaborador existente (não role nova) | Mantém modelo simples; evitar inflacionar roles quando um campo de setor resolve | — Pending |
| Margem adiada pra marco 2 | Depende de tabela de preços/custos que Lenny ainda vai receber; não bloquear este marco | — Pending |
| CPF no signup com validação algorítmica | Dado sensível que vira base pra comissões/folha no futuro — entrar sujo cria passivo | — Pending |
| Importação via CSV manual (sem API externa) | Fluxo atual e realista; integração com ERP fica pra marco futuro | — Pending |
| Reescrever PDF do zero | "Redesign + remover caixas + texto limpo" não se resolve com patch — melhor reconstruir | — Pending |
| Mudanças de schema aditivas, nunca destrutivas | Dados de produção existem; colunas novas nullable, tabelas novas sem afetar as antigas | — Pending |
| Reescrever PROJECT/REQUIREMENTS/ROADMAP em cima dos commits do UAT abandonado | Histórico preservado; zero risco de `git reset --hard` | ✓ Good |

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
4. Update Context with current state

---
*Last updated: 2026-04-23 after pivot (UAT descartado, escopo novo de melhorias v1)*
