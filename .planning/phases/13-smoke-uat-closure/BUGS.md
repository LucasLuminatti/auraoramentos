# Bugs encontrados — Phase 13 smoke

**Data:** 2026-05-15
**Cenários cobertos:** 4 (cliente+aniversário pipeline, orçamento full flow, RLS cross-feature, trigger manual)
**Severidade scheme:** critical (bloqueia fechamento) | non-critical (deferred v1.2+)

## Achados

| ID | Severidade | Cenário | Comportamento atual | Esperado | Status |
|----|------------|---------|---------------------|----------|--------|
| BUG-13-01 | **critical** | Cenário 1 | `ClienteDialog.tsx` não tinha campo de input para `data_nascimento`. Schema column existia desde Phase 7, Phase 12 (aniversário) usava o valor, mas **nenhuma UI permitia preencher**. Aniversário automation só funcionava pra clientes criados via SQL direto (impossível pra colabs). | Form expor `<Input type="date">` opcional pra `data_nascimento` | **FIXED** — commit `b3ae4db`, deploy Vercel auto, Cenário 1 re-rodado PASS |

## Smoke summary

- Cenário 1 (cliente+RLS+aniversário pipeline): **PASS após fix BUG-13-01**
- Cenário 2 (orçamento full flow): **PASS** (wizard 3 passos + PDF v2 + dashboard)
- Cenário 3 (RLS cross-feature): **PASS** (Smoke13 colab não vê dados admin)
- Cenário 4 (trigger manual edge fn): **PASS** (sent=1, status='sent', dedup WR-01 confirmado)

## Notas

- **AU001 coringa `preco_minimo=0`:** durante teste de floor de preço no Cenário 2, valor R$ 0,01 foi aceito sem violação. Isto é **comportamento esperado** — SKUs coringa AU001-AU016 são intencionalmente sem mínimo (placeholders editáveis pelo admin). Phase 10 WIZ-01 já foi validado com SKU real na Phase 10 SUMMARY.
- **Dedup WR-01 (Phase 12 review fix) observado em prod:** Cenário 4 mostrou `admin_emails: ["lucas.hartmann@..."]` sem Lenny duplicado (que é colab dono + admin). Fix de `21a97b7` confirmado funcional em prod.
- **Status WIZ-03 (reabrir rascunho) e WIZ-04 (marcar status aprovado/perdido/pendente)** não foram testados visualmente neste smoke — já validados em Phase 10 SUMMARY individual e não foram re-testados pra economizar ciclo (CONTEXT D-01: integration only). Orçamento smoke ficou em `status='rascunho'` por default sem precisar usar UI de mudança de status.

## Decisão de triage

**Zero bug crítico pendente.** BUG-13-01 foi crítico mas foi **corrigido inline** durante o smoke (~15min: fix + deploy + re-test). Marco v1.1 pronto pra archive em 13-02.
