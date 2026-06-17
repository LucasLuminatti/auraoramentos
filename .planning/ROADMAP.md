# Roadmap: AURA

> Roadmap ativo do AURA. Marcos completos ficam em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 — Melhorias v1** — Phases 1-6 (shipped 2026-05-07) → [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Polimento UAT + Multi-tenancy + Automação** — Phases 7-13 (shipped 2026-05-15) → [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação** — Phases 14-18 (shipped 2026-06-12) → [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [audit](milestones/v1.2-MILESTONE-AUDIT.md)
- ✅ **v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)** — Phases 19-22 (shipped 2026-06-17)

---

## Active Milestone: v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)

### Phases

- [x] **Phase 19: Fundação Compostos** — Decisão de arquitetura (`luminarias[].composicao?`), data model aditivo, tabela `produto_composicao`, e fix de catálogo para conectores/kits (CAT-03)
- [x] **Phase 20: Fluxos Magnéticos** — Seletor de tipo de sistema (SIST-05), montagem MAGNETO 48V (SIST-01) e TINY 24V (SIST-02), checklist de componentes + atalho (COMP-01/02), voltage lock 48V (COMP-03), driver auto-dimensionado com painel "aplicar" (DRV-01/02)
- [x] **Phase 21: SYSTEM MOLD + Validação & Reuso** — Montagem modular SYSTEM MOLD (SIST-03), aviso não-bloqueante Step 2→3 (VAL-01), duplicar sistema composto entre ambientes (DUP-01)
- [x] **Phase 22: PDF v3 — Sistemas Compostos** — Nova seção de compostos no PDF (PDF-03), router v3 condicional, sem arriscar PDF v2

---

## Phase Details

### Phase 19: Fundação Compostos
**Goal**: A base técnica dos sistemas compostos está no lugar — decisão de arquitetura documentada, modelo de dados aditivo no TypeScript e no schema, e conectores/kits aparecendo corretamente na busca do catálogo
**Depends on**: Phase 18 (v1.2 shipped — baseline estável)
**Requirements**: CAT-03
**Success Criteria** (what must be TRUE):
  1. Conectores (ex: LM2338, LM3168, LM3169) e kits de fixação (LM2987) aparecem na busca de componentes do sistema — `useProdutoSearch` com `filtro='conector'` e `filtro='kit_fixacao'` retornam os SKUs corretos
  2. `ItemLuminaria` no TypeScript carrega o campo opcional `composicao?: ItemComposicao[]` sem quebrar nenhum código existente — orçamentos antigos abrem normalmente, cálculos de subtotal e totais de ambiente batem igual a antes
  3. A tabela `produto_composicao` existe no schema (migration aditiva, começa vazia); RLS permite leitura para autenticados e escrita só para admin
  4. A decision de arquitetura (compostos em `luminarias[].composicao`, não em `sistemas[]`) está documentada no PROJECT.md e os 5 calculation sites (`calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita`, `isSistemaVazio` no v2.ts) não foram alterados — Fita Padrão funciona exatamente como antes
**Plans**: 3 plans
- [x] 19-01-PLAN.md — Modelo de dados aditivo (ItemComposicao + composicao? em ItemLuminaria) + calcularSubtotalComposicao + REGRAS_COMPOSICAO + testes de backward-compat
- [x] 19-02-PLAN.md — CAT-03: filtros 'conector'/'kit_fixacao' em useProdutoSearch + migration de UPDATE de tipo_produto (escrita)
- [x] 19-03-PLAN.md — Tabela produto_composicao (vazia + RLS) + [BLOCKING] apply das 2 migrations via service role + doc D-01 no PROJECT.md
**UI hint**: yes

### Phase 20: Fluxos Magnéticos
**Goal**: O colaborador consegue montar um sistema MAGNETO 48V ou TINY MAGNETO 24V diretamente no wizard — buscando o produto âncora (product-first; o tipo é detectado automaticamente), adicionando módulos, recebendo recomendação de driver com um clique "aplicar", e sendo alertado sobre componentes obrigatórios ausentes
**Depends on**: Phase 19
**Requirements**: SIST-05, SIST-01, SIST-02, COMP-01, COMP-02, COMP-03, DRV-01, DRV-02
**Success Criteria** (what must be TRUE):
  1. O colaborador adiciona produtos por uma busca única (product-first) e o sistema **detecta automaticamente** o tipo de fluxo a partir do produto âncora (luminária avulsa / fita / MAGNETO 48V / TINY 24V / modular) — **sem seletor de tipo manual** (removido por design, decisão product-first 2026-06-15); adicionar uma fita abre o fluxo de Fita Padrão atual idêntico — nenhuma regressão
  2. Com tipo "Magnético 48V": o colaborador adiciona trilho MAGNETO 22 + N módulos com SKU e quantidade; a carga total (W) é calculada automaticamente sem entrada manual
  3. Com tipo "Magnético 24V": o colaborador adiciona trilho TINY MAG + módulos; mesma mecânica de carga automática, pool de drivers 24V
  4. O painel de recomendação de driver exibe o SKU correto (LM2343 100W / LM2344 200W para 48V; menor driver compatível para 24V) e o botão "aplicar" preenche os campos do driver do sistema com um clique — o colaborador pode revisar ou sobrescrever depois
  5. O checklist de componentes obrigatórios marca presença/ausência de conectores por família (MAGNETO 48V → LM2338; TINY → LM3168 ou LM3169); quando ausente, o atalho "adicionar componente" insere o SKU correto no ambiente em um clique
  6. Selecionar um trilho magnético 48V trava o seletor de driver em 48V — tentativa de adicionar driver de outra voltagem é bloqueada (hard lock)
**Plans**: 3 plans
- [x] 20-01-PLAN.md — Camada de dados/helpers: detectarTipoAncora + calcularCargaComposicao + recomendarDriver48V (orcamento.ts) + filtroSistema em useProdutoSearch
- [x] 20-02-PLAN.md — ComposicaoCard.tsx: trilho âncora, módulos, painel de driver (48V LM2343/LM2344 + 24V), voltage lock, checklist de obrigatórios
- [x] 20-03-PLAN.md — AmbienteCard reorg: busca product-first + lista unificada + roteamento + render ComposicaoCard (Fita Padrão intocado) + checkpoint visual
**UI hint**: yes

### Phase 21: SYSTEM MOLD + Validação & Reuso
**Goal**: O colaborador consegue montar sistemas SYSTEM MOLD, recebe aviso ao avançar com sistema incompleto, e pode duplicar um sistema composto inteiro para outro ambiente sem remontar do zero
**Depends on**: Phase 20
**Requirements**: SIST-03, VAL-01, DUP-01
**Success Criteria** (what must be TRUE):
  1. Com tipo "Modular": o colaborador monta um SYSTEM MOLD — escolhe o perfil modular, adiciona N módulos difusos (SKU + qtd + comprimento); a demanda de fita é derivada automaticamente de `Σ(comprimento × qtd)` dos módulos sem entrada manual
  2. Ao tentar avançar do Step 2 para o Step 3, se algum sistema composto estiver incompleto (trilho sem driver ou sem conector obrigatório da família), um aviso aparece com a descrição do problema — o colaborador pode continuar mesmo assim (não-bloqueante)
  3. O colaborador consegue duplicar um sistema composto (trilho + módulos + driver + conectores) para outro ambiente; o clone aparece com novos UUIDs e os valores somam corretamente no Step 3
**Plans**: 3 plans
- [x] 21-01-PLAN.md — Fundação: migration sistema='s_mode' (12 perfis + 15 difusos) + helpers puros (calcularMetragemModulosDifusos, parsearComprimentoModulo, clonarItemLuminaria, fix clonarAmbiente) + filtro 'modulo_difuso'
- [x] 21-02-PLAN.md — UI SYSTEM MOLD (SIST-03): rota 'modular' no AmbienteCard + ramo modular no ComposicaoCard (difusos + fita derivada + driver advisory) + botão Duplicar no header
- [x] 21-03-PLAN.md — Advisory VAL-01 (3 condições de composto incompleto) + orquestração DUP-01 (seletor de destino + clone) + checkpoint visual
**UI hint**: yes

### Phase 22: PDF v3 — Sistemas Compostos
**Goal**: O PDF de orçamentos com sistemas compostos apresenta os compostos como bloco estruturado inline no ambiente (trilho/perfil no topo + módulos, fita modular, driver e acessórios em sub-linhas), via router v3 aditivo, sem alterar o PDF v2 para orçamentos sem compostos
**Depends on**: Phase 21
**Requirements**: PDF-03
**Success Criteria** (what must be TRUE):
  1. Um orçamento com sistemas compostos gera PDF v3 com uma seção "Sistemas Compostos" contendo: SKU e quantidade do trilho, tabela de módulos com SKU/qtd, quantidade e SKU do driver, acessórios obrigatórios — tudo visível e organizado para o cliente
  2. Um orçamento sem sistemas compostos (só Fita Padrão) continua gerando PDF v2 — o router `pdf_template_version` define v3 condicionalmente apenas quando `ambientes.some(a => a.luminarias.some(l => l.composicao?.length))`
  3. Orçamentos e snapshots antigos (v1 e v2) continuam renderizando seus PDFs sem nenhuma alteração — o router v1/v2/v3 é aditivo
**Plans**: 2 plans (2 waves)
- [x] 22-01-PLAN.md — Template v3 (pdfTemplates/v3.ts) com bloco composto inline + branch v3 no router + buildAtributosMap estendido para composicao[] + guard v2 intocado
- [x] 22-02-PLAN.md — Disparo condicional: helper resolverTemplateVersion + writer (Step3Revisao) persiste 2/3 + reader (OrcamentoDetalhe) + checkpoint visual v3/v2/antigo
**UI hint**: yes

---

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
| 19. Fundação Compostos | v1.3 | 3/3 | Complete    | 2026-06-12 |
| 20. Fluxos Magnéticos | v1.3 | 3/3 | Complete   | 2026-06-15 |
| 21. SYSTEM MOLD + Validação & Reuso | v1.3 | 3/3 | Complete    | 2026-06-16 |
| 22. PDF v3 — Sistemas Compostos | v1.3 | 2/2 | Complete | 2026-06-17 |

## Backlog

### Phase 999.1: PDF vetorial — substituir rasterização html2canvas (BACKLOG · PRIORIDADE ALTA)

**Goal:** Substituir o PDF rasterizado (html2pdf.js/html2canvas, cada página vira JPEG) por PDF de texto nativo/vetorial, reproduzindo fielmente o layout v2 aprovado, resolvendo de uma vez peso, tempo de geração e travamento ao navegar.

**Contexto medido (2026-06-09):** cada página é um bitmap A4 a `scale: 2` embutido como JPEG. Escala mal: 1 item=2pág/0,5MB · 20=4pág/1,1MB · 50=7pág/2,2MB · 100=12pág/4,5MB. Cada página descomprime ~14MB na RAM do leitor → trava ao abrir/rolar/zoom em propostas grandes; geração de 100 itens leva dezenas de s; texto não selecionável. Paliativo já aplicado: `image.quality` 0.98→0.92 (−33% peso, visual idêntico).

**Requirements:** TBD — candidatos: jsPDF `.html()`, `react-pdf`/`@react-pdf/renderer`, ou geração server-side.
**Restrição:** não alterar a aparência aprovada; validar visualmente contra o PDF atual antes de finalizar.

### ~~Phase 999.2: Sistemas Compostos — MAGNETO / TINY / MODULAR~~ → PROMOVIDO para v1.3 (Phases 19-22)

~~**Goal:** Fluxo de montagem de sistemas compostos no wizard...~~

> Promovido para milestone ativo **v1.3** em 2026-06-12. Requirements: SIST-01/02/03/05, DRV-01/02, COMP-01/02/03, VAL-01, CAT-03, DUP-01, PDF-03. Ver Phase Details acima (Phases 19-22).

---
*Last updated: 2026-06-17 — v1.3 COMPLETO. Phase 22 concluída (2/2 plans). PDF-03 fechado: template v3 blocoComposto + wiring condicional resolverTemplateVersion. Milestone v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR) — SHIPPED 2026-06-17.*
