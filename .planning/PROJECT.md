# AURA

## What This Is

Sistema web de criação de orçamentos de iluminação da Luminatti, já em produção (vercel kappa). Colaboradores montam orçamentos em um wizard de 3 passos (cliente/projeto → ambientes com sistemas de LED → revisão e PDF), e admins gerenciam produtos, preços, clientes e aprovam exceções de preço. Backend em Supabase (auth, Postgres, edge functions); frontend em React 18 + Vite + TypeScript + shadcn-ui.

## Core Value

Um colaborador consegue montar um orçamento real, do zero ao PDF entregue, sem bug e sem precisar de suporte.

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

<!-- Marco 1: validar que tudo o que foi construído funciona. Zero bug antes de tocar em cálculos. -->

- [ ] **UAT-01** Checklist de UAT cobrindo 100% das Validated, organizado por fluxo
- [ ] **UAT-02** Rodar UAT em prod (vercel kappa) até zero bug — inclusive cosmético
- [ ] **UAT-03** Ao encontrar bug: parar, corrigir, commit+push, retestar o fluxo
- [ ] **UAT-04** Relatório final consolidado: o que foi testado, o que quebrou, o que foi corrigido

### Out of Scope

<!-- Marco 1 é validação. Não mexer em estrutura agora. -->

- Refatoração da lógica de cálculos — vai pro marco 2 (próximo ciclo)
- Novas features (comissões, novos tipos de sistema, integrações externas) — depois do marco 2
- Redesign de UI / reestruturação de fluxo — nenhum redesign neste marco
- Reescrita de edge functions — só corrigir bug pontual se o UAT pegar algo
- Setup de testes automatizados (Vitest/Playwright) — UAT é manual neste marco
- Mudanças de schema do Supabase não ligadas a bugs encontrados

## Context

**Produto em uso real.** O AURA já é usado por colaboradores da Luminatti em produção (Vercel — URL kappa). Antes de qualquer refatoração estrutural (especialmente cálculos, que são o coração do produto), precisamos garantir que o estado atual está estável.

**Domínio:** Iluminação LED. Sistemas combinam fita de LED (vendida em rolos de 5/10/15m), driver (dimensionado por potência) e opcionalmente perfil de alumínio. Cálculo correto envolve agrupar fitas compatíveis em rolos, dimensionar drivers pela potência total e detectar quando o preço negociado fica abaixo do mínimo.

**Histórico recente (git log):**
- Auto-criação de colaborador no login (10ec928)
- PDF muda de janela de impressão para download direto (712e281)
- Persistência de snapshot ao gerar PDF (d451a9b)
- Codebase mapeado em `.planning/codebase/` (96b729d, 2cf590f)

**Mudanças não commitadas detectadas no início:** edge functions `request-access` e `review-access`, `config.toml` do Supabase, e um `linked-project.json` novo em `.temp/`. Precisam entrar no UAT se afetam fluxo de acesso.

**Infra conhecida:** Supabase vinculado; Resend ativo com `onboarding@resend.dev` (domínio próprio pendente — pode afetar deliverability dos emails de reset/request-access durante o UAT).

## Constraints

- **Tech stack**: React 18 + Vite + TypeScript + Supabase + shadcn-ui — não trocar stack no marco 1
- **Timeline**: Fechar marco 1 essa semana (pré 2026-04-30)
- **Executor**: Só Lenny roda o UAT (perfil admin + colaborador alternados na mesma conta/conta de teste)
- **Ambiente**: UAT rodado em prod (vercel kappa) contra o Supabase real
- **Fluxo de correção**: Achou bug → para UAT → corrige → commit+push → retesta aquele fluxo → segue
- **Critério de aceite**: Zero bug, mesmo cosmético. Nada tolerado.
- **Dependências externas**: Email via Resend, PDF via html2pdf.js, Vercel deploy — se algum falhar durante UAT, documentar como bloqueador antes de corrigir

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Validação antes de refatorar cálculos | Não vale refatorar em cima de base possivelmente quebrada. Estabilidade primeiro. | — Pending |
| UAT manual (não automatizado) | Testes automatizados seriam marco próprio; agora o objetivo é cobertura rápida de bugs visíveis. | — Pending |
| Rodar UAT em prod, não local | Ambiente real de uso; pega divergências de config/env que local mascara. | — Pending |
| Corrigir on-the-fly em vez de listar e corrigir em batch | Lenny testa sozinho — manter contexto do bug fresco reduz retrabalho. | — Pending |
| Critério "zero bug cosmético" | Produto em uso real — colaboradores perdem confiança em qualquer inconsistência. | — Pending |

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
*Last updated: 2026-04-23 after initialization*
