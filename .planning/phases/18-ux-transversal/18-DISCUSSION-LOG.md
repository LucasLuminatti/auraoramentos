# Phase 18: UX Transversal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 18-ux-transversal
**Areas discussed:** Redirect (UX-01), Duplicar (RES-04/UX-04), Checklist (UX-05), Microcopy (UX-03)

---

## Redirect (UX-01) — busca de Luminária com código de perfil/fita/driver

| Option | Description | Selected |
|--------|-------------|----------|
| Só mensagem inline | Substitui "Nenhum produto encontrado" pela mensagem de redirecionamento; troca de aba manual | |
| Mensagem + botão que troca de aba | Mensagem + botão "Ir para Sistemas de Iluminação" que muda a aba do AmbienteCard | ✓ |
| Mensagem + já adiciona automaticamente | Detecta o tipo e adiciona o item direto na seção certa | |

**User's choice:** Mensagem + botão que troca de aba
**Notes:** Comportamento guiado, sem mágica arriscada. Exige detecção do tipo real via consulta sem filtro.

---

## Duplicar (RES-04 sistema / UX-04 ambiente)

| Option | Description | Selected |
|--------|-------------|----------|
| Duplica no mesmo lugar + edita depois | Sistema clona no mesmo ambiente com sufixo "(cópia)"; ambiente clona logo abaixo; renomeia depois | ✓ |
| Dialog pra escolher destino | Dialog pra escolher ambiente/local de destino ao duplicar | |

**User's choice:** Duplica no mesmo lugar + edita depois
**Notes:** Menos cliques. Novos UUIDs em toda a árvore clonada.

---

## Checklist (UX-05) — comportamento pré-PDF no Step 3

| Option | Description | Selected |
|--------|-------------|----------|
| Painel sempre visível + não bloqueia | Painel no topo do Step 3, tudo aviso, PDF gera sempre | |
| Dialog ao clicar 'Gerar PDF' | Só aparece ao gerar PDF | |
| Painel visível + só 0m bloqueia | Painel sempre visível; fita 0m (CALC-01) bloqueia, resto é aviso | ✓ |

**User's choice:** Painel visível + só 0m bloqueia (híbrido)
**Notes:** Mantém consistência com Phase 17 (advisory não-bloqueante) e CALC-01 (erro real). Classificação 🔴 erro / 🟡 aviso, cada item com link pra corrigir. Painel dá feedback contínuo e reduz retrabalho; dialog escondido foi rejeitado por esconder problemas até o fim.

---

## Microcopy (UX-03) — Luminárias vs Sistemas

| Option | Description | Selected |
|--------|-------------|----------|
| Texto auxiliar sempre visível | Linha curta muted-foreground abaixo de cada aba/seção | ✓ |
| Ícone (i) com tooltip | Info no hover/clique | |
| Você decide | Claude escolhe | |

**User's choice:** Texto auxiliar sempre visível
**Notes:** Quem mais precisa da explicação não abre tooltip; orientação tem de estar à vista. Texto curto (1 linha), discreto, padrão shadcn/Tailwind. Luminárias = "Spots, pendentes, plafons, trilhos e luminárias individuais."; Sistemas = "Fitas LED, perfis, drivers e componentes que formam um sistema."

## Claude's Discretion

- Forma de focar/abrir a busca na aba Sistemas após o redirect.
- Estrutura do helper de clonagem (utilitário vs inline).
- Componente exato do painel de checklist.

## Deferred Ideas

- Sistemas compostos MAGNETO/TINY/MODULAR → v1.3.
- Todos de estética de PDF (3) → fora do escopo desta fase.
