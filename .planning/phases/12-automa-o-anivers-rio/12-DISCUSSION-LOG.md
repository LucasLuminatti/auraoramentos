# Phase 12: Automação Aniversário - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 12-automa-o-anivers-rio
**Areas discussed:** Cron & idempotência, Resolução do destinatário, Edge case & falha

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Cron & idempotência | Que horas roda, idempotência | ✓ |
| Resolução do destinatário | Email colab + admin | ✓ |
| Conteúdo & template do email | Visual + content | (Claude's Discretion) |
| Edge case & falha | 29/fev, órfão, Resend failed | ✓ |

---

## Cron & idempotência

### Q1: Horário do cron diário (TZ America/Sao_Paulo)

| Option | Description | Selected |
|--------|-------------|----------|
| 06:00 BR (recommended) | Cedo, começo do expediente | ✓ |
| 08:00 BR | Início do expediente, risco de empilhar | |
| 12:00 BR | Meio do dia | |

**User's choice:** 06:00 BR → cron `'0 9 * * *'` UTC

### Q2: Prevenir email duplicado

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela log + UNIQUE(cliente_id, ano) (recommended) | `aniversario_envios` + INSERT ON CONFLICT | ✓ |
| Só pg_cron 1x/dia | Confia no cron, sem audit | |
| Flag em clientes | Coluna `aniv_ultimo_envio_ano` | |

**User's choice:** Tabela log dedicada com UNIQUE constraint

### Q3: Setup do cron

| Option | Description | Selected |
|--------|-------------|----------|
| SQL migration cron.schedule (recommended) | Versionado | ✓ |
| Manual no dashboard | Mais rápido mas não versionado | |

**User's choice:** SQL migration

---

## Resolução do destinatário

### Q1: Email do colab dono

| Option | Description | Selected |
|--------|-------------|----------|
| auth.users.email (recommended) | JOIN direto | ✓ |
| colaboradores.email | JOIN extra | |
| Ambos com fallback | Defensivo | |

**User's choice:** auth.users.email direto

### Q2: Admin destinatário

| Option | Description | Selected |
|--------|-------------|----------|
| Env var fixa ANIVERSARIO_ADMIN_EMAIL (recommended) | Padrão request-access | |
| Multi-admin via has_role(admin) | Query DB todos admins | ✓ |
| Tabela config | Editável sem deploy | |

**User's choice:** Multi-admin via has_role(admin) — **divergência consciente do AUTO-02 spec** que dizia "email fixo configurável"

### Q3: Cliente órfão (user_id NULL ou auth.user deletado)

| Option | Description | Selected |
|--------|-------------|----------|
| Pular + log warning (recommended) | status='skipped_no_owner' | ✓ |
| Só pro admin | Email pro admin com nota | |
| Falhar batch | Hard error | |

**User's choice:** Pular + log warning, segue batch

---

## Edge case & falha

### Q1: Janela de 5 dias

| Option | Description | Selected |
|--------|-------------|----------|
| Exato D-5 (recommended) | today + 5 = aniversário | ✓ |
| Janela ±5 dias | Combinada com idempotência | |
| D-5 + retroativo 3d | Mais complexo | |

**User's choice:** Exato D-5 — 1 email/ano/cliente

### Q2: Aniversário 29/fev em ano não-bissexto

| Option | Description | Selected |
|--------|-------------|----------|
| Disparar em 28/fev (recommended) | Padrão CRM | ✓ |
| Disparar em 01/mar | Defensável | |
| Não disparar | Literal mas pulado | |

**User's choice:** 28/fev em ano não-bissexto

### Q3: Resend falha

| Option | Description | Selected |
|--------|-------------|----------|
| status='failed' + error_msg + seguir (recommended) | Sem retry, UNIQUE impede | ✓ |
| Retry 1x | 2s wait + retry | |
| Retry no dia seguinte | status='pending_retry' | |

**User's choice:** Marca failed, sem retry. Lenny inspeciona manualmente.

---

## Claude's Discretion

- Template visual do email (segue padrão `request-access` dark)
- Subject line exata
- Conteúdo body (nome, data, idade, contato cliente)
- Naming exato da tabela log e dos campos
- Naming exato do cron job
- Estrutura interna do edge fn (Deno serve handler)
- Migrations splits e ordem de push

## Deferred Ideas

- UI admin pra reenviar/cancelar (out of scope)
- WhatsApp / push (out of scope)
- Métrica de engajamento (out of scope)
- Aniversário do arquiteto (out of scope, future phase)
- Notificação D-1 ou D-0 extra (out of scope)
- Retry automático D+1 (out of scope, revisitar se taxa de falha virar problema)
- Index funcional MONTH/DAY (Phase 7 D-08 já deferiu)
