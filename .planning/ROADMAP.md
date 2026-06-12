# Roadmap: AURA

> Roadmap ativo do AURA. Marcos completos ficam em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 — Melhorias v1** — Phases 1-6 (shipped 2026-05-07) → [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Polimento UAT + Multi-tenancy + Automação** — Phases 7-13 (shipped 2026-05-15) → [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação** — Phases 14-18 (shipped 2026-06-12) → [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [audit](milestones/v1.2-MILESTONE-AUDIT.md)
- 📋 **v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)** — a planejar (`/gsd-new-milestone`)

## Active Milestone

Nenhum marco ativo — v1.2 fechado. Próximo: **v1.3 — Sistemas Compostos** (candidato registrado no Backlog abaixo). Inicie com `/gsd-new-milestone`.

## Phases

<details>
<summary>✅ v1.2 — Correções UAT + UX do Wizard (Phases 14-18) — SHIPPED 2026-06-12</summary>

- [x] Phase 14: Catálogo & Dados (3/3 plans) — completed 2026-06-10
- [x] Phase 15: Tensão & Validação (2/2 plans) — completed 2026-06-11
- [x] Phase 16: Cálculo & Metragem (3/3 plans) — completed 2026-06-11
- [x] Phase 17: Resumo & Apresentação (4/4 plans) — completed 2026-06-11
- [x] Phase 18: UX Transversal (4/4 plans) — completed 2026-06-12

Detalhe completo em [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md). Auditoria de fechamento: `tech_debt` (18/18 requirements, débito aceito e rastreado) — [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md).

</details>

<details>
<summary>✅ v1.0 + v1.1 (Phases 1-13) — SHIPPED</summary>

Arquivados em [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) e [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Catálogo & Dados | v1.2 | 3/3 | Complete | 2026-06-10 |
| 15. Tensão & Validação | v1.2 | 2/2 | Complete | 2026-06-11 |
| 16. Cálculo & Metragem | v1.2 | 3/3 | Complete | 2026-06-11 |
| 17. Resumo & Apresentação | v1.2 | 4/4 | Complete | 2026-06-11 |
| 18. UX Transversal | v1.2 | 4/4 | Complete | 2026-06-12 |

## Backlog

### Phase 999.1: PDF vetorial — substituir rasterização html2canvas (BACKLOG · PRIORIDADE ALTA)

**Goal:** Substituir o PDF rasterizado (html2pdf.js/html2canvas, cada página vira JPEG) por PDF de texto nativo/vetorial, reproduzindo fielmente o layout v2 aprovado, resolvendo de uma vez peso, tempo de geração e travamento ao navegar.

**Contexto medido (2026-06-09):** cada página é um bitmap A4 a `scale: 2` embutido como JPEG. Escala mal: 1 item=2pág/0,5MB · 20=4pág/1,1MB · 50=7pág/2,2MB · 100=12pág/4,5MB. Cada página descomprime ~14MB na RAM do leitor → trava ao abrir/rolar/zoom em propostas grandes; geração de 100 itens leva dezenas de s; texto não selecionável. Paliativo já aplicado: `image.quality` 0.98→0.92 (−33% peso, visual idêntico).

**Requirements:** TBD — candidatos: jsPDF `.html()`, `react-pdf`/`@react-pdf/renderer`, ou geração server-side.
**Restrição:** não alterar a aparência aprovada; validar visualmente contra o PDF atual antes de finalizar.

### Phase 999.2: Sistemas Compostos — MAGNETO / TINY / MODULAR (BACKLOG · candidato a marco v1.3)

**Goal:** Fluxo de montagem de sistemas compostos no wizard — trilho magnético MAGNETO 48V, TINY MAGNETO 24V e perfil modular SYSTEM MOLD — assemblando módulos + driver dimensionado + componentes obrigatórios, em vez de entrarem como luminária avulsa.

**Contexto:** separado da v1.2 (UAT) por ser evolução estrutural (~40% do esforço e ~todo o risco). Origem: comentários UAT 8, 9, 11 e parte do 10. Requisitos SIST-01 (MAGNETO 48V), SIST-02 (TINY 24V), SIST-03 (SYSTEM MOLD). Pesquisa em `.planning/research/SUMMARY.md`.

**Decisão de arquitetura pendente (resolver no início):** compostos em `sistemas[]` (discriminated union) vs `luminarias[].composicao?` — pesquisa recomenda o 2º (mais conservador; evita guards no cálculo, snapshot-compat via campo undefined).

**Inclui:** modelo de dados aditivo (ex. tabela `produto_composicao`), extensão de `useProdutoSearch` (módulo/trilho), `analisarMagneto48V` (já ~80%), 5 sites de cálculo atômicos, edge fn `validar-sistema-orcamento`, **PDF v3** (seção rica de compostos).
**Restrição:** schema aditivo; não quebrar wizard v1.2 nem snapshots/PDF antigos.

---
*Last updated: 2026-06-12 — v1.2 shipped e arquivado (Phases 14-18, 18/18 requirements). Próximo marco candidato: v1.3 — Sistemas Compostos. ROADMAP/REQUIREMENTS de v1.2 em `.planning/milestones/`.*
