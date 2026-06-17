# Roadmap: AURA

> Roadmap ativo do AURA. Marcos completos ficam em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 — Melhorias v1** — Phases 1-6 (shipped 2026-05-07) → [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Polimento UAT + Multi-tenancy + Automação** — Phases 7-13 (shipped 2026-05-15) → [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação** — Phases 14-18 (shipped 2026-06-12) → [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [audit](milestones/v1.2-MILESTONE-AUDIT.md)
- ✅ **v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)** — Phases 19-22 (shipped 2026-06-17) → [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

> Nenhum marco ativo. Próximo: `/gsd-new-milestone`.

---

## Phases

<details>
<summary>✅ v1.3 — Sistemas Compostos (Phases 19-22) — SHIPPED 2026-06-17</summary>

- [x] Phase 19: Fundação Compostos (3/3 plans) — completed 2026-06-12
- [x] Phase 20: Fluxos Magnéticos (3/3 plans) — completed 2026-06-15
- [x] Phase 21: SYSTEM MOLD + Validação & Reuso (3/3 plans) — completed 2026-06-16
- [x] Phase 22: PDF v3 — Sistemas Compostos (2/2 plans) — completed 2026-06-17

Detalhe completo em [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md). 13/13 requirements (SIST, DRV, COMP, VAL, DUP, CAT-03, PDF-03).

</details>

<details>
<summary>✅ v1.2 — Correções UAT + UX do Wizard (Phases 14-18) — SHIPPED 2026-06-12</summary>

- [x] Phase 14: Catálogo & Dados (3/3 plans) — completed 2026-06-10
- [x] Phase 15: Tensão & Validação (2/2 plans) — completed 2026-06-11
- [x] Phase 16: Cálculo & Metragem (3/3 plans) — completed 2026-06-11
- [x] Phase 17: Resumo & Apresentação (4/4 plans) — completed 2026-06-11
- [x] Phase 18: UX Transversal (4/4 plans) — completed 2026-06-12

Detalhe completo em [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md). Auditoria de fechamento: `tech_debt` (18/18 requirements, débito aceito) — [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md).

</details>

<details>
<summary>✅ v1.0 + v1.1 (Phases 1-13) — SHIPPED</summary>

Arquivados em [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) e [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

## Backlog

### Phase 999.1: PDF vetorial — substituir rasterização html2canvas (PRIORIDADE ALTA)

**Goal:** Substituir o PDF rasterizado (html2pdf.js/html2canvas, cada página vira JPEG) por PDF de texto nativo/vetorial, reproduzindo fielmente o layout v2 aprovado, resolvendo de uma vez peso, tempo de geração e travamento ao navegar.

**Contexto medido (2026-06-09):** cada página é um bitmap A4 a `scale: 2` embutido como JPEG. Escala mal: 1 item=2pág/0,5MB · 20=4pág/1,1MB · 50=7pág/2,2MB · 100=12pág/4,5MB. Cada página descomprime ~14MB na RAM do leitor → trava ao abrir/rolar/zoom em propostas grandes; geração de 100 itens leva dezenas de s; texto não selecionável. Paliativo já aplicado: `image.quality` 0.98→0.92 (−33% peso, visual idêntico).

**Requirements:** TBD — candidatos: jsPDF `.html()`, `react-pdf`/`@react-pdf/renderer`, ou geração server-side.
**Restrição:** não alterar a aparência aprovada; validar visualmente contra o PDF atual antes de finalizar.

### Ideias soltas (pós-v1.3)

- **Margem no pedido** (Marco 2) — depende da planilha de custos; importar `custo` por SKU e exibir margem (R$/%) no orçamento.
- **Terminar carga de preço/foto** — ~313 produtos sem preço (self-service via Admin > Preços > Importação) + ~745 sem foto.
- **Cleanup bucket legado** `produto-imagens` (singular).
- **Endurecer demais edge fns** sem checagem de admin (mesmo padrão de import-precos/import-produtos), se necessário.

---
*Last updated: 2026-06-17 — v1.3 SHIPPED e arquivado (milestones/v1.3-*). Nenhum marco ativo. Próximo: /gsd-new-milestone. Backlog: 999.1 PDF vetorial + margem (Marco 2).*
