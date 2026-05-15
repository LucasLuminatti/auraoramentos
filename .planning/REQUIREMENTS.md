# Requirements — Milestone v1.1

**Milestone:** v1.1 — Polimento UAT + Multi-tenancy + Automação
**Opened:** 2026-05-11
**Shipped:** 2026-05-15
**Status:** Milestone v1.1 archived 2026-05-15 — 18/18 delivered (1 with deviation: AUTO-02). Archive em [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md).

> Capturadas a partir do UAT pessoal do Lenny em prod (2026-05-11) após arquivamento do v1.0. 18 requirements em 6 categorias. **Marco fechado 2026-05-15 — outcome tracking detalhado em [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md).**

---

## Active Requirements (v1.1) — todos entregues

### FORM — Cadastros (opcionalizar + expandir + imagens)

- [x] **FORM-01:** Colaborador/admin pode criar cliente sem Contato, sem CPF/CNPJ e sem Arquiteto (todos opcionais; só Nome obrigatório) — DELIVERED (Phase 8, 2026-05-14)
- [x] **FORM-02:** Admin pode preencher data de nascimento, endereço do escritório e dados bancários no cadastro do arquiteto — DELIVERED (Phase 8, 2026-05-14)
- [x] **FORM-03:** Admin pode editar descrição e imagem dos produtos coringa AU001..AU016 (hoje fixos/só leitura) — DELIVERED (Phase 8, 2026-05-14)
- [x] **FORM-04:** Admin pode anexar/trocar imagem manual em qualquer produto pelo row da tab Cadastros > Produtos (complementa ImportImagens em massa) — DELIVERED (Phase 8, 2026-05-14)

### RLS — Multi-tenancy por colaborador

- [x] **RLS-01:** Colaborador vê apenas os clientes que ele cadastrou (próprios); admin vê todos — DELIVERED (Phase 9, 2026-05-15)
- [x] **RLS-02:** Colaborador vê apenas os arquitetos que ele cadastrou (próprios); admin vê todos — DELIVERED (Phase 9, 2026-05-15)
- [x] **RLS-03:** Schema aditivo: `user_id` em `arquitetos` e `clientes` + RLS policies replicando padrão Drive v1.0 D-02 — DELIVERED (Phase 7, 2026-05-11)

### WIZ — Wizard / Orçamento (edição + status + descrição rica)

- [x] **WIZ-01:** Colaborador pode editar preço unitário de item no Step 3 antes de gerar PDF, com floor mínimo no `preco_minimo` do produto — DELIVERED (Phase 10, 2026-05-14)
- [x] **WIZ-02:** Colaborador pode editar quantidade de item no Step 3 antes de gerar PDF — DELIVERED (Phase 10, 2026-05-14)
- [x] **WIZ-03:** Colaborador pode reabrir orçamento com `status='rascunho'` clicando no card de Clientes/Pedidos → continua wizard de onde parou — DELIVERED (Phase 10, 2026-05-14)
- [x] **WIZ-04:** Colaborador ou admin pode marcar status do orçamento (aprovado / perdido / pendente) após geração de PDF — DELIVERED (Phase 10, 2026-05-14)
- [x] **WIZ-05:** Descrição do produto exibida no wizard e no PDF puxa `nome + temperatura(K) + potência + IRC + nicho` a partir da planilha master ImportMaster — DELIVERED (Phase 10, 2026-05-14; builder `construirDescricaoRica` com fallback ao snapshot puro)

### PDF — PDF v2 ajustes

- [x] **PDF-01:** PDF v2 não renderiza bloco "Sistemas de Iluminação" quando o sistema está vazio (0m fita / 0W consumo / 0 driver) — DELIVERED (Phase 11, 2026-05-15)
- [x] **PDF-02:** Seção "Prazo de Entrega" no PDF v2 acrescenta "prazo médio de 20 dias úteis" após o texto existente — DELIVERED (Phase 11, 2026-05-15)

### DASH — Dashboard (métrica única)

- [x] **DASH-01:** Tab Início substitui os 6 cards atuais (Receita Efetiva/Prevista/Pipeline/Ticket Médio/Conversão/Ciclo Médio) por um único card de **somatório de orçamentos em aberto** somando todos os representantes — DELIVERED (Phase 11, 2026-05-15)

### AUTO — Automação aniversário

- [x] **AUTO-01:** Sistema envia email 5 dias antes do aniversário do cliente para o colaborador dono do cliente — DELIVERED (Phase 12, 2026-05-15)
- [~] **AUTO-02 (DELIVERED with deviation):** Sistema envia email 5 dias antes do aniversário do cliente para admin → entregue via `has_role(admin)` dinâmico (RPC `buscar_admins_emails()`) em vez de hardcode email "David Grabarz". Deviation consciente (Phase 12 D-22) — suporta N admins sem redeploy, cobre intent original. Detalhe em [milestones/v1.1-REQUIREMENTS.md#AUTO-02](milestones/v1.1-REQUIREMENTS.md).
- [x] **AUTO-03:** Schema aditivo: campo `data_nascimento DATE` em `clientes`; cron pg_cron + edge function chamando Resend — DELIVERED (Phase 7 schema + Phase 12 automation, 2026-05-15)

---

## Future Requirements (post-v1.1)

Não inflando o marco — carryover do PROJECT.md + follow-ups do v1.1:
- Preços via CSV (IMP-02 deferido de v1.0) + tabela de custos
- Margem no pedido (depende da tabela de custos)
- Documentação + testes das fórmulas de cálculo (fita/driver/perfil/agrupamento)
- WR-02 pg_net 4xx/5xx monitoring/alerts (Phase 12 follow-up)
- SPF/DKIM/DMARC do domínio `orcamentosaura.com.br` (email Junk em Outlook)
- Dedup `toList` na edge fn aniversário (owner=admin causa duplicação)

---

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| Métrica de orçamentos abertos replicada em tab Pedidos | Lenny confirmou: só na tab Início |
| Validação adicional de CPF/CNPJ no cliente | Campos vão virar opcionais — validar dado opcional não faz sentido |
| Migração de descrições antigas via UPDATE em massa | WIZ-05 garante leitura nova; backfill se necessário fica pra fase de qualidade |
| Refatoração de cálculos (fita/driver/perfil) | Out of Scope perpétuo — só após documentação + testes (próximo marco) |
| Margem no orçamento | Out of Scope perpétuo até tabela de custos chegar |
| Permitir alterar `status='aprovado'` voltando pra rascunho | Status é one-way (até feedback contrário) |

---

## Pré-requisito bloqueante (fix por fora)

`request-access` quebrado em prod (2026-05-11) — David Grabarz + Lenny não conseguem solicitar convite. Fix via `/gsd-quick` (commit `16c0b14`) antes da primeira execução de fase do v1.1. Não conta como requirement do marco — é restauração de funcionalidade v1.0. **Resolvido em 2026-05-11.**

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| FORM-01 | Phase 8 | 08-02 | DELIVERED (2026-05-14) |
| FORM-02 | Phase 8 | 08-01 + 08-05 | DELIVERED (2026-05-14) |
| FORM-03 | Phase 8 | 08-03 | DELIVERED (2026-05-14) |
| FORM-04 | Phase 8 | 08-03 | DELIVERED (2026-05-14) |
| RLS-01 | Phase 9 | 09-03 + 09-04 + 09-06 | DELIVERED (2026-05-15) |
| RLS-02 | Phase 9 | 09-03 + 09-04 + 09-06 | DELIVERED (2026-05-15) |
| RLS-03 | Phase 7 | 07-01 | DELIVERED (2026-05-11) |
| WIZ-01 | Phase 10 | 10-01 | DELIVERED (2026-05-14) |
| WIZ-02 | Phase 10 | 10-02 | DELIVERED (2026-05-14) |
| WIZ-03 | Phase 10 | 10-03 | DELIVERED (2026-05-14) |
| WIZ-04 | Phase 10 | 10-03 | DELIVERED (2026-05-14) |
| WIZ-05 | Phase 10 | 10-04 + 10-05 | DELIVERED (2026-05-14) |
| PDF-01 | Phase 11 | 11-01 | DELIVERED (2026-05-15) |
| PDF-02 | Phase 11 | 11-01 | DELIVERED (2026-05-15) |
| DASH-01 | Phase 11 | 11-02 | DELIVERED (2026-05-15) |
| AUTO-01 | Phase 12 | 12-01 + 12-02 + 12-03 | DELIVERED (2026-05-15) |
| AUTO-02 | Phase 12 | 12-01 + 12-02 + 12-03 | DELIVERED with deviation (2026-05-15) |
| AUTO-03 | Phase 7 + 12 | 07-02 + 12-01 | DELIVERED (2026-05-15) |

**Coverage:** 18/18 mapped · 0 orphaned · 100%

**Outcome:** 17 DELIVERED · 1 DELIVERED with deviation (AUTO-02) · 0 DEFERRED

---

*Generated 2026-05-11 by /gsd-new-milestone — milestone v1.1.*
*Traceability filled 2026-05-11 by gsd-roadmapper (7 phases, 18 reqs, 100% coverage).*
*Last updated: 2026-05-15 — milestone v1.1 archived (17 DELIVERED + 1 DELIVERED with deviation = 18/18 covered). Archive em [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md).*
