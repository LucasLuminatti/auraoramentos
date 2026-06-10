# Phase 14: Catálogo & Dados - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 14-cat-logo-dados
**Areas discussed:** Escopo da correção tipo_produto, Estratégia da migration, Correção da dica MAGNETO, Verificação/segurança

---

## Escopo da correção tipo_produto

| Option | Description | Selected |
|--------|-------------|----------|
| Varredura ampla c/ revisão | Gerar query listando todos os produtos com tipo nulo/errado agrupados por família, revisar, migration corrige confirmados | ✓ |
| Só as 4 famílias citadas | Corrigir apenas CANTONEIRA, WALL WASHER, LM3475, LM3291 | |
| Ampla, sem revisão prévia | Migration corrige tudo que bater nas regras, sem revisão | |

**User's choice:** Varredura ampla com revisão prévia.
**Notes:** Resolver de forma definitiva, não só os 4 exemplos. Primeiro gerar lista completa (nulo/inconsistente/suspeito) agrupada por família, revisar antes da migration, migration corrige só itens revisados e aprovados. Prefere gastar mais tempo agora e sair da fase com base consistente.

---

## Estratégia da migration

| Option | Description | Selected |
|--------|-------------|----------|
| Lista explícita de SKUs/códigos | UPDATE WHERE codigo IN (lista aprovada), determinístico | ✓ (resultado final) |
| Por padrão de nome/família (LIKE) | UPDATE WHERE descricao LIKE '%CANTONEIRA%' | |
| Misto LIKE + SKU | Famílias por LIKE, avulsos por SKU | |

**User's choice:** Aprovação por grupos/regras (não SKU a SKU) → migration final materializa lista explícita de SKUs.
**Notes:** Não quer revisar SKU por SKU se a quantidade for grande. Quer: varredura ampla → agrupar por família/categoria/regra → mostrar contagem por grupo → aprovar regras por grupo → migration explícita e auditável gera lista final de SKUs a partir dos grupos aprovados. Evita trabalho manual e correção automática sem validação.

---

## Correção da dica MAGNETO

| Option | Description | Selected |
|--------|-------------|----------|
| Corrigir a causa raiz onde estiver | Diagnosticar (dado vs código), corrigir na origem; ambos se necessário | ✓ |
| Só no código (AmbienteCard.tsx) | Ajustar regex/ordem dos if | |
| Só no dado (migration) | Garantir sistema_magnetico correto no banco | |

**User's choice:** Corrigir a causa raiz onde estiver.
**Notes:** Diagnóstico real primeiro. Se classificação errada no banco → corrigir dado; se lógica de detecção errada → corrigir código; se ambos → corrigir ambos. Sem workaround para mascarar problema de dados nem migration para compensar lógica incorreta.

---

## Verificação/segurança

| Option | Description | Selected |
|--------|-------------|----------|
| Query contagem antes/depois | SELECT count por tipo_produto antes/depois | ✓ |
| Teste de busca nos seletores | Validar WALL WASHER/CANTONEIRA/LM3475/LM3291/MAGNETO aparecem | ✓ |
| Garantir snapshots antigos intactos | Orçamentos antigos (jsonb) continuam abrindo | ✓ |
| Migration reversível/idempotente | Idempotente + nota de rollback | ✓ |

**User's choice:** Todas as quatro.
**Notes:** —

---

## Claude's Discretion

- Formato da query diagnóstica e do agrupamento apresentado para aprovação.
- Estrutura/nomenclatura do arquivo de migration.
- Campos exibidos na lista de revisão por grupo.

## Deferred Ideas

- Montagem de sistemas compostos MAGNETO/TINY/MODULAR → v1.3 (SIST-01/02/03).
- Todos de PDF (Phase 5) revisados mas não incorporados — domínio diferente.
