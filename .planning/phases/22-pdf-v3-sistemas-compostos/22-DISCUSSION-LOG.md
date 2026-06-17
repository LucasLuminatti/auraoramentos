# Phase 22: PDF v3 — Sistemas Compostos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 22-pdf-v3-sistemas-compostos
**Areas discussed:** Layout do bloco composto, Preço (granular vs agrupado), Nível de detalhe técnico, Fita do SYSTEM MOLD

---

## Layout do bloco composto

| Option | Description | Selected |
|--------|-------------|----------|
| Inline no ambiente | Composto dentro do ambiente, bloco "Sistema Composto N" com trilho + sub-linhas | ✓ |
| Seção dedicada no fim | Todos os compostos agrupados numa seção separada no fim (como Resumo de Fitas) | |
| Híbrido | Resumo inline + seção detalhada no fim | |

**User's choice:** Inline no ambiente
**Notes:** Cliente pensa por ambiente, não por estrutura técnica. Modelo de dados já é Ambiente → Local → Sistema; o PDF deve refletir a hierarquia em vez de criar organização paralela. Seção no fim separa o sistema do local de instalação; híbrido duplica info e aumenta manutenção. "Seção Sistemas Compostos" = bloco dentro de cada ambiente, não capítulo isolado.

---

## Preço (granular vs agrupado)

| Option | Description | Selected |
|--------|-------------|----------|
| Preço por componente + subtotal | Cada linha com preço unitário, bloco fecha com subtotal do sistema | ✓ |
| Só o total do sistema | Componentes sem preço por linha, só valor único | |

**User's choice:** Preço por componente + subtotal do sistema
**Notes:** Sistemas compostos existem porque são várias peças compatíveis; valor fechado perde transparência e gera questionamento comercial. v2 já detalha preços — v3 mantém a filosofia, agrupando dentro do composto. Subtotal resolve a leitura comercial rápida. Especificador/arquiteto quer entender de onde veio o valor (trilho, módulos, driver, acessórios).

---

## Nível de detalhe técnico

| Option | Description | Selected |
|--------|-------------|----------|
| Técnico relevante por papel | Atributo que importa por tipo + resumo do sistema (carga/metragem) | ✓ |
| Completo (todos os atributos) | Todos os chips por item (potência, voltagem, comprimento, IRC, temp) | |
| Mínimo (SKU + qtd + preço) | Sem chips técnicos | |

**User's choice:** Técnico relevante por papel
**Notes:** PDF é documento comercial com suporte técnico, não ficha técnica nem lista de SKUs. Mostrar o que ajuda a identificar/validar/comparar cada papel; ocultar atributos internos/redundantes. Completo = ruído visual em sistemas grandes; mínimo = simples demais (cliente não entende driver/carga). Mantém filosofia do v2.

---

## Fita do SYSTEM MOLD

| Option | Description | Selected |
|--------|-------------|----------|
| Dentro do bloco do composto | fita_modular como linha do sistema, com metragem; fora do Resumo de Fitas global | ✓ |
| No Resumo de Fitas global | Soma no resumo existente junto das fitas Fita Padrão | |
| Nos dois | Linha no bloco + soma no resumo global | |

**User's choice:** Dentro do bloco do composto
**Notes:** Fita modular faz parte do sistema e deve aparecer junto dos componentes que a usam. Resumo de Fitas global continua só para fitas independentes. Opção 2 quebra a leitura; opção 3 duplica info e arrisca interpretação errada de contagem/metragem. Regra: cada componente aparece no contexto onde é consumido.

---

## Claude's Discretion

- Rótulo de tipo no bloco (SYSTEM MOLD / MAGNETO 48V / TINY 24V vs genérico) — usar o tipo é desejável (inferido de `produto.sistema`); forma exata a critério da implementação.
- Ordem das sub-linhas, tratamento de acessório obrigatório vs opcional, quebra de página do bloco.
- Mecânica do router v3 (novo `pdfTemplates/v3.ts` reusando v2 vs estender v2), desde que v2 não mude para orçamentos sem composto.

## Deferred Ideas

- PDF vetorial (backlog 999.1).
- Redesign estético do PDF / foto da fita no Resumo de Fitas (todos de UI antigos).
- Seção consolidada "Sistemas Compostos" no fim (rejeitada em favor do inline; registrada se cliente pedir visão consolidada).
