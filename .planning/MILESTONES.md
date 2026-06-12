# Milestones — AURA

> **Índice canônico:** `.planning/milestones/MILESTONES.md` (narrativa completa por marco). Esta página é o índice resumido legado.

## v1.2 Correções UAT + UX do Wizard de Sistemas de Iluminação (Shipped: 2026-06-12)

**Completado:** 5 phases (14-18), 16 plans · ciclo de 3 dias (2026-06-10 → 2026-06-12) · 18/18 requirements · audit `tech_debt` (débito aceito)

**Key accomplishments:**

- Catálogo corrigido: 401 perfis + 18 fitas invisíveis nos seletores (tipo_produto null/errado) corrigidos em PROD via migration aditiva; dica MAGNETO 48V validada (CAT-01/02)
- Validação de tensão: voltagem inferida da fita, pré-filtro + aviso de divergência não-bloqueante, grouping por (código+voltagem), advisory TINY 24V, driver sugerido como default (TENS-01/02, SIST-04, UX-02)
- Cálculo/metragem: gate contra fita 0m silenciosa, sufixo de metragem automático na descrição, passadas editáveis por família + migration de sync (CALC-01/02/03)
- Resumo coerente: chips de LOCAL por fita (tela + PDF v2 com foto), fita sem duplicação, drivers por ambiente, advisory de itens incompletos (RES-01/02/03/05)
- UX transversal: redirect ao buscar categoria errada, microcopy inline, Duplicar sistema + Duplicar ambiente (novos UUIDs), checklist pré-PDF com gate no botão Gerar PDF (UX-01/03/04/05, RES-04)

Detalhe completo: [milestones/MILESTONES.md](milestones/MILESTONES.md) · Archive: [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) · [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)

---

Histórico de marcos shipados. Cada marco mantém roadmap + requirements arquivados em `.planning/milestones/v{version}-{type}.md`.

## Index

| Version | Period | Phases | Plans | Highlights | Archive |
|---------|--------|--------|-------|------------|---------|
| **v1.0** | 2026-04-23 → 2026-05-07 (15d) | 6 | 28 | Arquiteto como entidade, signup expandido, ImportMaster + CSV de produtos, Drive RLS por user_id, admin reorganizado em 5 sub-tabs, PDF v2 (Playfair+Inter, sem 4 caixas, prose final, roteador v1/v2), filtros arquiteto em Cadastros/Pedidos | [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) |

## Stats acumulados

- **Total commits:** 163 (de Initial commit a v1.0)
- **Total LOC change:** +35.447 / −3.610
- **Migrations aplicadas:** 9 (todas aditivas)
- **Edge functions deployed:** 4 (`create-colaborador`, `import-produtos`, `request-access`, `review-access`)
- **Production URL:** https://orcamentosaura.com.br (Vercel kappa)

---
*Last updated: 2026-06-12 — v1.2 shipped (índice canônico em `milestones/MILESTONES.md`)*
