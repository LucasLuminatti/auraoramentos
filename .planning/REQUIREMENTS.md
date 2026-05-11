# Requirements — Milestone v1.1

**Milestone:** v1.1 — Polimento UAT + Multi-tenancy + Automação
**Opened:** 2026-05-11
**Status:** Roadmap defined (7 phases, 18 reqs, 100% coverage)

> Capturadas a partir do UAT pessoal do Lenny em prod (2026-05-11) após arquivamento do v1.0. 18 requirements em 6 categorias.

---

## Active Requirements (v1.1)

### FORM — Cadastros (opcionalizar + expandir + imagens)

- [ ] **FORM-01:** Colaborador/admin pode criar cliente sem Contato, sem CPF/CNPJ e sem Arquiteto (todos opcionais; só Nome obrigatório)
- [ ] **FORM-02:** Admin pode preencher data de nascimento, endereço do escritório e dados bancários no cadastro do arquiteto
- [ ] **FORM-03:** Admin pode editar descrição e imagem dos produtos coringa AU001..AU016 (hoje fixos/só leitura)
- [ ] **FORM-04:** Admin pode anexar/trocar imagem manual em qualquer produto pelo row da tab Cadastros > Produtos (complementa ImportImagens em massa)

### RLS — Multi-tenancy por colaborador

- [ ] **RLS-01:** Colaborador vê apenas os clientes que ele cadastrou (próprios); admin vê todos
- [ ] **RLS-02:** Colaborador vê apenas os arquitetos que ele cadastrou (próprios); admin vê todos
- [ ] **RLS-03:** Schema aditivo: `user_id` em `arquitetos` e `clientes` + RLS policies replicando padrão Drive v1.0 D-02

### WIZ — Wizard / Orçamento (edição + status + descrição rica)

- [ ] **WIZ-01:** Colaborador pode editar preço unitário de item no Step 3 antes de gerar PDF, com floor mínimo no `preco_minimo` do produto
- [ ] **WIZ-02:** Colaborador pode editar quantidade de item no Step 3 antes de gerar PDF
- [ ] **WIZ-03:** Colaborador pode reabrir orçamento com `status='rascunho'` clicando no card de Clientes/Pedidos → continua wizard de onde parou
- [ ] **WIZ-04:** Colaborador ou admin pode marcar status do orçamento (aprovado / perdido / pendente) após geração de PDF
- [ ] **WIZ-05:** Descrição do produto exibida no wizard e no PDF puxa `nome + temperatura(K) + potência + IRC + nicho` a partir da planilha master ImportMaster (já em `product_variants` ou mapear os campos faltantes)

### PDF — PDF v2 ajustes

- [ ] **PDF-01:** PDF v2 não renderiza bloco "Sistemas de Iluminação" quando o sistema está vazio (0m fita / 0W consumo / 0 driver)
- [ ] **PDF-02:** Seção "Prazo de Entrega" no PDF v2 acrescenta "prazo médio de 20 dias úteis" após o texto existente

### DASH — Dashboard (métrica única)

- [ ] **DASH-01:** Tab Início substitui os 6 cards atuais (Receita Efetiva/Prevista/Pipeline/Ticket Médio/Conversão/Ciclo Médio) por um único card de **somatório de orçamentos em aberto** somando todos os representantes

### AUTO — Automação aniversário

- [ ] **AUTO-01:** Sistema envia email 5 dias antes do aniversário do cliente para o colaborador dono do cliente
- [ ] **AUTO-02:** Sistema envia email 5 dias antes do aniversário do cliente para o admin David Grabarz (email fixo configurável)
- [ ] **AUTO-03:** Schema aditivo: campo `data_nascimento DATE` em `clientes`; cron pg_cron + edge function chamando Resend

---

## Future Requirements (post-v1.1)

Não inflando o marco — carryover do PROJECT.md:
- Preços via CSV (IMP-02 deferido de v1.0) + tabela de custos
- Margem no pedido (depende da tabela de custos)
- Documentação + testes das fórmulas de cálculo (fita/driver/perfil/agrupamento)

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

`request-access` quebrado em prod (2026-05-11) — David Grabarz + Lenny não conseguem solicitar convite. Fix via `/gsd-quick` ou `/gsd-debug` antes da primeira execução de fase do v1.1. Não conta como requirement do marco — é restauração de funcionalidade v1.0.

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| FORM-01 | Phase 8 | TBD |
| FORM-02 | Phase 8 | TBD |
| FORM-03 | Phase 8 | TBD |
| FORM-04 | Phase 8 | TBD |
| RLS-01 | Phase 9 | TBD |
| RLS-02 | Phase 9 | TBD |
| RLS-03 | Phase 7 | TBD |
| WIZ-01 | Phase 10 | TBD |
| WIZ-02 | Phase 10 | TBD |
| WIZ-03 | Phase 10 | TBD |
| WIZ-04 | Phase 10 | TBD |
| WIZ-05 | Phase 10 | TBD |
| PDF-01 | Phase 11 | TBD |
| PDF-02 | Phase 11 | TBD |
| DASH-01 | Phase 11 | TBD |
| AUTO-01 | Phase 12 | TBD |
| AUTO-02 | Phase 12 | TBD |
| AUTO-03 | Phase 7 | TBD |

**Coverage:** 18/18 mapped · 0 orphaned · 100%

---

*Generated 2026-05-11 by /gsd-new-milestone — milestone v1.1.*
*Traceability filled 2026-05-11 by gsd-roadmapper (7 phases, 18 reqs, 100% coverage).*
