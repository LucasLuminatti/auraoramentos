# Phase 15: Tensão & Validação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 15-tens-o-valida-o
**Areas discussed:** Sugestão+filtro de driver, Aviso de divergência, Advisory TINY 24V, Resumo de drivers por voltagem

---

## Sugestão + filtro de driver (UX-02)

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| O que fazer com o driver ao escolher a fita | Pré-preencher+filtrar / Só pré-filtrar / Só pré-preencher | **Pré-preencher + filtrar** |
| Regra do driver sugerido | Menor potência suficiente / SKU fixo por voltagem / Claude decide pelo catálogo | **Claude decide pelo catálogo, com transparência prévia** |
| Sobrescrever driver manual | Só preenche se vazio / Sempre sobrescreve | **Só preenche se vazio** |

**Notas:** Sistema proativo mas mantém controle do usuário. Regra de sugestão deve vir dos dados reais do catálogo, com a regra exata + margem + exemplos mostrados ANTES de implementar. Se a fita mudar e o driver ficar incompatível: avisar, não apagar.

## Aviso de divergência de voltagem (TENS-01)

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Formato do aviso | Badge inline persistente / Só toast / Badge + toast | **Badge inline + toast** |
| Bloqueia avanço pro Step 3? | Não bloqueia / Bloqueia até resolver | **Não bloqueia, só avisa** |

**Notas:** Toast no momento da divergência + badge persistente enquanto existir + texto específico ("fita 24V e driver 12V") + some sozinho ao corrigir. Permitir prosseguir cientemente; checklist pré-PDF (Phase 18) reforça depois.

## Advisory TINY 24V (SIST-04)

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Tipo de aviso | Toast+badge informativo / Aviso+botão de ação leve | **Toast + badge informativo (advisory puro)** |
| Detecção da linha TINY | Dado sistema='tiny_magneto' / Regex descrição / Claude decide | **Dado sistema='tiny_magneto'** |

**Notas:** Sem montar sistema/adicionar componentes (isso é v1.3). Detecção pelo dado estruturado, não texto; regex só como fallback de diagnóstico.

## Resumo de drivers por (código + voltagem) (TENS-02)

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Rótulo da linha com voltagens distintas | Voltagem no rótulo / Coluna separada / Claude decide pelo layout | **Claude decide pelo layout atual, com proposta prévia** |
| Bloqueio indevido entre ambientes | Aviso sempre por-sistema / Investigar causa antes | **Aviso sempre por-sistema (ambientes independentes)** |

**Notas:** Diferença de voltagem imediatamente visível, sem dúvida sobre as duas linhas. Validação só compara fita×driver do mesmo sistema. Se aparecer evidência de vínculo real entre ambientes → sinalizar antes de expandir escopo.

## Claude's Discretion

- Regra exata de seleção do driver sugerido (com aprovação prévia D-02a).
- Forma visual de mostrar voltagem no resumo (com aprovação prévia D-09a).
- Mecânica do pré-filtro do seletor de driver.

## Deferred Ideas

- Montagem assistida de sistemas compostos (TINY/MAGNETO/MODULAR) → v1.3.
- Botão de auto-incluir driver 24V no advisory TINY → rejeitado (tangencia v1.3).
- Todos de PDF (redesign, foto da fita no resumo) → fora de escopo; foto da fita já registrada p/ Phase 17.
