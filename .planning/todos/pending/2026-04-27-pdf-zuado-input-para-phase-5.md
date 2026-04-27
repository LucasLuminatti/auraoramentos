---
created: 2026-04-27T18:09:13.967Z
title: PDF gerado tá zuado — input pra Phase 5 (PDF Redesign)
area: ui
files:
  - src/lib/gerarPdfHtml.ts
---

## Problem

Lenny relatou no smoke do Phase 1 (2026-04-27) que o PDF gerado pelo wizard
está visualmente quebrado/feio. Phase 5 do roadmap (PDF Redesign) já planeja
reescrever o PDF do zero — esse todo é só pra capturar o feedback como
input pra essa fase.

Confirmado pelo PROJECT.md: "Reescrever PDF do zero — Redesign + remover
caixas + texto limpo não se resolve com patch."

## Solution

Endereçado em **Phase 5 — PDF Redesign** (já no roadmap). Quando chegar lá:

- Coletar print/exemplo do PDF atual antes de reescrever (snapshot do estado
  ruim pra comparar com o novo).
- Validar com o Lenny quais elementos visuais ele quer manter / remover (ele
  já mencionou "remover as 4 caixas").
- Não tentar patchar `gerarPdfHtml.ts` agora — Phase 5 vai reescrever.
