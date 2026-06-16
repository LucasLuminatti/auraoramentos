# Phase 21: SYSTEM MOLD + Validação & Reuso - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 21-system-mold-valida-o-reuso
**Areas discussed:** SYSTEM MOLD fita & driver derivados, Aviso Step 2→3 (VAL-01), Duplicar composto (DUP-01)

---

## Seleção de áreas

| Área | Discutida |
|------|-----------|
| SYSTEM MOLD — fita & driver derivados | ✓ |
| SYSTEM MOLD — entrada dos módulos | (Claude's discretion) |
| Aviso Step 2→3 (VAL-01) | ✓ |
| Duplicar composto (DUP-01) | ✓ |

---

## SYSTEM MOLD — fita & driver derivados

| Option | Description | Selected |
|--------|-------------|----------|
| Deriva metragem + botão "Adicionar fita" | Mostra metragem; botão abre busca de fita; vendedor escolhe SKU; fita entra com metragem pré-preenchida e dispara recomendação de driver | ✓ |
| Só mostrar a metragem necessária | Informativo; fita+driver adicionados como sistema separado | |
| Auto-criar fita + driver padrão | Sistema escolhe fita default e driver | |

**User's choice:** Opção 1.
**Notes:** "calcular automaticamente a metragem ... exibir no card. Ao clicar em Adicionar fita, abre a busca de fitas compatíveis; o vendedor escolhe o SKU e a fita entra na composição já com a metragem preenchida, disparando a recomendação de driver como Fita Padrão. Não quero apenas mostrar a metragem (perde integração). Também não quero auto-criar (cor, temperatura e SKU são decisões de projeto)."

---

## Aviso Step 2→3 (VAL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Composto magnético sem driver aplicado | Trilho 48V/24V com módulos sem driver | ✓ |
| Composto sem o conector obrigatório da família | Falta LM2338 (magneto) / LM3168\|9 (tiny) | ✓ |
| SYSTEM MOLD sem fita adicionada | Perfil modular com difusos mas sem fita | ✓ |
| Trilho de embutir sem kit LM2987 | Versão embutir sem o kit | |

**User's choice:** As 3 primeiras (kit embutir de fora).
**Notes:** Estende o advisory existente (`Step2Ambientes.handleNext` + AlertDialog), permanece não-bloqueante.

---

## Duplicar composto (DUP-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Escolher ambiente de destino | Seletor de ambientes; clone vai pro escolhido; cai no mesmo se só houver 1 | ✓ |
| Clonar no mesmo ambiente | Clone logo abaixo, mesmo ambiente | |
| Ambos: mesmo por padrão + opção de destino | Default mesmo ambiente, oferece destino se houver outros | |

**User's choice:** Escolher ambiente de destino.
**Notes:** Botão no header do card da composição; novos UUIDs em toda a árvore; valores somam por código no Step 3.

## Claude's Discretion

- Entrada dos módulos (área não selecionada): comprimento do catálogo (parse "132MM"→m, editável); escopo difuso primeiro (concentrado fora do foco); sem checklist obrigatório para modular nesta fase.
- Layout/copy do painel de fita derivada, do seletor de destino e dos novos AdvisoryItem.

## Deferred Ideas

- Módulos concentrados integrados ao card modular; checklist obrigatório modular; PDF v3 (Phase 22); mover composto entre ambientes.

## Achado técnico (não é decisão de UX)

- Produtos SYSTEM MOLD têm `sistema=null` no catálogo → detecção `'modular'` não funciona com dados atuais. Recomendação para o planner: migration aditiva `sistema='s_mode'` (precedente CAT-03) ou detecção por descrição.
