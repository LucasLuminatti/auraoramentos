---
phase: 13-smoke-uat-closure
plan: 01
type: smoke-results
date: 2026-05-15
executor: Lenny + Claude (Playwright MCP + MCP execute_sql + Auth Admin API)
status: PASS_5_5
---

# 13-SMOKE-RESULTS — Integration Smoke Phase 13

## Setup

- Admin: lenny.wajcberg@luminattiled.com.br (user_id `5bc17cc7-76a9-469b-95db-2121a80eca15`)
- Colab single-use: lennywajcberg+smoke13-1778853134@gmail.com (user_id `d35e8fa6-a1ed-422b-b6f9-2d5cff9ea3d1`)
- Cliente teste: "Cliente Smoke 13 Lenny" (id `2d1935d2-15ad-4865-87da-3c218b7877d3`, data_nascimento=2026-05-20)
- Orçamento teste: id `a4db1933-93af-4f56-9540-05776eaef915`, R$ 150,00, status=rascunho

## Cenários

### Cenário 1 — Cliente + RLS + Aniversário pipeline → **PASS após fix BUG-13-01**

- Login admin OK (botão Admin presente, vê 4 clientes prod reais)
- Modal "Novo Cliente" inicialmente **sem campo data_nascimento** → BUG-13-01 (critical) capturado
- Fix inline aplicado (`b3ae4db`): adicionado `<Input type="date">` em `ClienteDialog.tsx`, payload insert/update, SELECT em `Admin.tsx`, type interface
- Deploy Vercel automático (~90s)
- Re-test: form mostra "Data de nascimento (opcional — habilita aniversário automático)", preenchido 2026-05-20
- SQL cross-check: cliente criado com `user_id`=admin Lenny (DEFAULT auth.uid()) + `data_nascimento`=2026-05-20
- Pipeline aniversário: `SELECT * FROM buscar_aniversariantes_d5()` retorna o cliente + `colab_email`=Lenny ✓

### Cenário 2 — Orçamento full flow (Phase 8+10+11) → **PASS**

- Cliente list mostra "Cliente Smoke 13 Lenny" ✓
- Criou "Projeto Smoke 13" + orçamento "Primeiro Orçamento"
- Step 2: 1 ambiente + 1 luminária AU001 (coringa Drivers)
- Step 3: edit de preço inline funciona (Phase 10 WIZ-01 spinbutton)
  - Tested R$ 0,01 → aceito (AU001 tem preco_minimo=0 — comportamento esperado, não bug)
  - Voltou pra R$ 150 → recalculou subtotal/total ✓
- Gerar PDF → toast "PDF baixado!" + arquivo `Proposta_Cliente_Smoke_13_Lenny_Projeto_Smoke_13.pdf`
- **PDF v2 visual check (Phase 11):**
  - Header "Proposta Comercial" com Playfair Display ✓
  - Cliente/Projeto/Colaborador/Data/Tipo presentes ✓
  - **Sem bloco "Sistemas"** (PDF-01 — escondido quando vazio) ✓
  - Total Geral R$ 150,00 com barra dourada ✓
  - Página 2 "Termos e Condições" → "PRAZO DE ENTREGA" contém **"prazo médio de 20 dias úteis"** (PDF-02) ✓
- Orçamento persistido no DB: id `a4db1933`, status='rascunho', valor=150
- Dashboard `/admin` → card único "Orçamentos em Aberto" mostra:
  - Rascunho: R$ 562,26 (inclui smoke + 5 outros)
  - Pendente: R$ 0,00
  - Total: R$ 562,26
- SQL cross-check: `SUM(valor) WHERE status NOT IN ('aprovado','perdido')` = 562.26 ✓ (Phase 11 DASH-01)

### Cenário 3 — RLS cross-feature smoke (Phase 9 × Phase 10+11) → **PASS**

- Logout Lenny → login Smoke13 colab
- Home mostra "Bom dia, Smoke13!" + **"Nenhum cliente cadastrado"** (RLS bloqueia Cliente Smoke 13 Lenny)
- Sem botão "Admin" no header (não é admin) ✓
- Navigate `/admin` → redirect para `/` (AdminRoute gate) ✓

### Cenário 4 — Trigger manual edge fn aniversário (Phase 12) → **PASS**

- Cleanup idempotência (DELETE de logs anteriores pra ano 2026 — none found)
- Curl POST `/functions/v1/aniversario-clientes` com Authorization Bearer service_role
- Response: HTTP 200 + `{"processed":1,"sent":1,"failed":0,"skipped":0,"ano_referencia":2026}`
- SQL verify: `SELECT * FROM aniversario_envios WHERE cliente_id=2d1935d2...`:
  - status='sent', sent_at=2026-05-15 14:14:29 UTC, error_msg=NULL
  - destinatarios: `{"colab_email": "lenny.wajcberg@...", "admin_emails": ["lucas.hartmann@..."]}`
  - **Dedup WR-01 (Phase 12 review fix) confirmado:** Lenny não duplicado em admin_emails (era colab dono + admin) ✓

## Cleanup

| Recurso | Antes | Depois |
|---------|-------|--------|
| arquitetos LIKE 'Smoke %' | (não criado) | 0 ✓ |
| clientes 'Cliente Smoke 13 Lenny' | 1 | **0** ✓ |
| orcamentos (smoke id) | 1 | **0** ✓ |
| aniversario_envios (smoke cliente) | 1 | **0** ✓ |
| projetos (smoke cliente) | 1 | **0** ✓ |
| colaboradores (Smoke13 user_id) | 1 | **0** ✓ |
| auth.users (Smoke13 id) | 1 | **0** ✓ (Admin API DELETE 200) |
| allowed_users LIKE smoke13 | 1 | **0** ✓ |

## Summary

| # | Cenário | Status |
|---|---------|--------|
| 1 | Cliente + RLS + Aniversário pipeline | ✓ PASS (post fix BUG-13-01) |
| 2 | Orçamento full flow | ✓ PASS |
| 3 | RLS cross-feature smoke | ✓ PASS |
| 4 | Trigger manual edge fn aniversário | ✓ PASS |

**Total: 4/4 PASS, 1 bug crítico fixed inline.**

## Triage decision

**Zero bug crítico pendente.** BUG-13-01 foi crítico mas resolvido inline durante o smoke (~15min: fix + deploy Vercel + re-test). Marco v1.1 entrega Phase 12 aniversário automation com UI completa.

**13-02 (archive) destravado.** Pronto pra fechar marco.
