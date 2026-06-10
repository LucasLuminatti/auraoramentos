# Roadmap: AURA

> Roadmap ativo do AURA. Marcos completos ficam em `.planning/milestones/`.

## Active Milestone

**v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação**

**Defined:** 2026-06-10
**Granularity:** coarse
**Coverage:** 18/18 v1.2 requirements mapped
**Mode:** yolo (parallelization enabled)
**Phase numbering:** continua a partir da Phase 14 (v1.1 terminou na Phase 13)

> **Contexto:** Correções derivadas dos 19 comentários dos funcionários (UAT 2026-06-10, com prints). Escopo decidido: correções incrementais + melhorias de UX dentro do fluxo atual, sem fluxo de sistemas compostos (v1.3). Fases começam em 14. Build order obrigatório: CAT-01 (SQL puro) precede os seletores de perfil/driver. Cálculo (Phase 16) é atômico: 5 sites de cálculo patched juntos. Schema sempre aditivo — não quebrar wizard, orçamentos antigos, PDF v1/v2.

### Phases

- [ ] **Phase 14: Catálogo & Dados** — Migração SQL corrigindo `tipo_produto` errado/nulo (WALL WASHER → `'perfil'`, LM3475, LM3291, CANTONEIRA) + corrigir mapeamento de dica MAGNETO/TINY; zero frontend, desbloqueia fases 15 e 16
- [ ] **Phase 15: Tensão & Validação** — Inferir voltagem do driver a partir da fita + aviso de divergência; remover bloqueio indevido entre ambientes com voltagens diferentes; corrigir grouping key de drivers globais para (codigo + voltagem); advisory TINY 24V com oferta de driver; sugerir driver compatível ao selecionar fita
- [ ] **Phase 16: Cálculo & Metragem** — Exigir metragem manual quando não há perfil (bloquear avanço com 0m silencioso); descrição do perfil reflete comprimento automaticamente; passadas editáveis + sync migration `passadas_padrao` para perfil 50mm (até 3 passadas); patch atômico nos 5 sites de cálculo
- [ ] **Phase 17: Resumo & Apresentação** — Resumo Global mostra LOCAL de cada item; fita sem duplicação entre visão por ambiente e resumo final; drivers por ambiente (não apenas bloco global); duplicar/reusar sistema em outro ambiente; aviso ao avançar para revisão sem lâmpada/item esperado
- [ ] **Phase 18: UX Transversal** — Redirecionamento ao buscar código de categoria errada (perfil buscado em Luminárias); microcopy inline explicando Luminárias vs Sistemas + o que é fita/perfil/driver; duplicar ambiente inteiro; checklist visual pré-PDF destacando itens incompletos/suspeitos

## Phase Details

### Phase 14: Catálogo & Dados
**Goal**: Todos os produtos do catálogo aparecem nos seletores corretos — perfis, drivers e WALL WASHER encontráveis na busca — e a dica exibida ao adicionar MAGNETO corresponde ao MAGNETO (não ao TINY)
**Depends on**: Nothing (primeira fase do v1.2; v1.1 já shipped)
**Requirements**: CAT-01, CAT-02
**Success Criteria** (what must be TRUE):
  1. Colaborador busca "WALL WASHER" no seletor de perfil e o produto aparece (tipo_produto corrigido de valor inválido para `'perfil'` via migration)
  2. Colaborador busca "CANTONEIRA", "LM3475" e "LM3291" no seletor de perfil/driver e os produtos aparecem (famílias com tipo_produto nulo/errado corrigidas)
  3. Ao adicionar produto MAGNETO, o aviso/dica exibido descreve características do MAGNETO — não do TINY MAGNETO
  4. Orçamentos antigos continuam abrindo normalmente; nenhum orçamento existente perde dados ou quebra (snapshot é autocontido — recategorização não afeta jsonb)
**Plans**: 3 plans
- [ ] 14-01-PLAN.md — Diagnóstico do catálogo (Queries A-D) + aprovação de regras por grupo (D-01/D-02)
- [ ] 14-02-PLAN.md — Migration idempotente de tipo_produto + push prod + fix causa-raiz MAGNETO (CAT-01/CAT-02)
- [ ] 14-03-PLAN.md — Validação Playwright + manual (seletores, dica MAGNETO, orçamento antigo intacto)

### Phase 15: Tensão & Validação
**Goal**: O wizard guia o colaborador a escolher o driver certo automaticamente — inferindo voltagem a partir da fita, sugerindo driver compatível, avisando em caso de divergência — e permite usar tensão diferente em cada ambiente sem bloqueio indevido
**Depends on**: Phase 14 (produtos de driver precisam estar com tipo_produto correto para o seletor funcionar)
**Requirements**: TENS-01, TENS-02, SIST-04, UX-02
**Success Criteria** (what must be TRUE):
  1. Ao selecionar uma fita com voltagem definida, o seletor de driver já é pré-filtrado por voltagem compatível; se o colaborador seleciona driver de voltagem diferente, aparece aviso claro (não passa silenciosamente)
  2. Colaborador cria Ambiente A com sistema 24V e Ambiente B com sistema 12V sem receber bloqueio indevido — cada ambiente é independente
  3. O Resumo Global de drivers agrupa por (código + voltagem), não apenas por código — dois sistemas com mesmo driver em voltagens diferentes geram linhas distintas
  4. Ao adicionar produto da linha TINY (ex.: TINY SPOT 24V), o sistema exibe aviso de que requer driver 24V e oferece a opção de incluí-lo no sistema
  5. Ao selecionar uma fita, o campo de driver é pré-preenchido com sugestão compatível (voltagem + potência) como default — colaborador pode sobrescrever
**Plans**: TBD
**UI hint**: yes

### Phase 16: Cálculo & Metragem
**Goal**: Nenhum item de fita ou perfil some silenciosamente do orçamento com R$0 — a metragem é sempre exigida, refletida na descrição e calculada corretamente respeitando as regras de passadas por família de perfil
**Depends on**: Phase 14 (passadas_padrao precisa estar correto no DB antes de unloquear UI)
**Requirements**: CALC-01, CALC-02, CALC-03
**Success Criteria** (what must be TRUE):
  1. Sistema com fita sem perfil não avança do Step 2 para o Step 3 se `metragemManual` for nulo ou zero — o colaborador vê aviso claro e é impedido de submeter um sistema com 0m
  2. Ao inserir um perfil e informar o comprimento, a metragem aparece automaticamente na descrição do item (ex.: "PERFIL X — 2,5m") sem entrada manual adicional
  3. O campo de passadas é editável — colaborador pode aumentar ou reduzir dentro do limite da família
  4. Perfil da família 50mm (light_50) aceita até 3 passadas; a sugestão automática reflete `passadas_padrao = 3` (migration de sync `regras_compatibilidade_perfil` → `produtos` aplicada antes do unlock da UI)
  5. Orçamentos antigos com `metragemManual: null` e `perfil: null` (rascunhos) abrem normalmente e recebem o aviso de validação no Step 3, sem crash e sem fix silencioso de dados
**Plans**: TBD
**UI hint**: yes

### Phase 17: Resumo & Apresentação
**Goal**: Step 3 e o Resumo Global apresentam fitas, perfis e drivers de forma coerente — sem duplicação confusa, com localização (LOCAL) visível, drivers por ambiente — e o colaborador pode duplicar um sistema já montado em vez de refazer tudo
**Depends on**: Phase 15 (voltage grouping corrigido afeta o resumo de drivers), Phase 16 (metragem correta afeta cálculos do resumo)
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05
**Success Criteria** (what must be TRUE):
  1. O Resumo Global de Fitas mostra a coluna LOCAL (ex.: SANCA, MARCENARIA) para cada linha de fita agrupada
  2. A fita de um sistema aparece uma vez na apresentação — ou no card do ambiente ou no resumo global, nunca duplicada de forma confusa para o cliente
  3. Os drivers aparecem listados dentro do respectivo ambiente no Step 3 (além ou em vez do bloco global)
  4. Colaborador clica em "Duplicar sistema" em um sistema já montado e ele aparece em outro ambiente escolhido, com os mesmos itens e novo UUID — economizando remontagem manual
  5. Ao clicar "Avançar" do Step 2 para o Step 3, o wizard exibe aviso se algum ambiente tem sistema sem o item esperado (ex.: fita sem driver, driver sem fita)
**Plans**: TBD
**UI hint**: yes

### Phase 18: UX Transversal
**Goal**: O wizard é difícil de usar errado — o colaborador é redirecionado quando busca no lugar errado, rótulos inline explicam o que vai em cada seção, e uma camada de checklist antes do PDF destaca tudo que parece incompleto
**Depends on**: Phase 17 (checklist pré-PDF é natural extensão dos avisos de RES-05)
**Requirements**: UX-01, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. Quando colaborador busca no seletor de Luminária um código que é perfil, fita ou driver (ex.: LM1370), aparece mensagem de redirecionamento ("Este produto é um perfil — adicione em Sistemas de Iluminação") em vez de "Nenhum produto encontrado"
  2. Cards de Luminárias e de Sistemas de Iluminação têm microcopy inline explicando o que entra em cada seção (ex.: "Luminárias = spots/tubulares individuais", "Sistemas = fita LED + perfil + driver")
  3. Colaborador clica em "Duplicar ambiente" e um ambiente inteiro (com todos os itens e sistemas) é clonado com novo UUID — útil para quartos/sancas iguais
  4. Antes de gerar o PDF, o Step 3 exibe checklist visual destacando itens suspeitos: fita com 0m, sistema sem driver, voltagem divergente, peça sem lâmpada — cada item com link para corrigir
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Catálogo & Dados | 0/3 | Not started | - |
| 15. Tensão & Validação | 0/TBD | Not started | - |
| 16. Cálculo & Metragem | 0/TBD | Not started | - |
| 17. Resumo & Apresentação | 0/TBD | Not started | - |
| 18. UX Transversal | 0/TBD | Not started | - |

## Coverage Summary

- **Total v1.2 requirements:** 18
- **Mapped to phases:** 18
- **Orphaned:** 0
- **Coverage:** 100%

### Distribution

| Phase | Requirements | Count |
|-------|--------------|-------|
| 14 | CAT-01, CAT-02 | 2 |
| 15 | TENS-01, TENS-02, SIST-04, UX-02 | 4 |
| 16 | CALC-01, CALC-02, CALC-03 | 3 |
| 17 | RES-01, RES-02, RES-03, RES-04, RES-05 | 5 |
| 18 | UX-01, UX-03, UX-04, UX-05 | 4 |

## Shipped Milestones

- **v1.1 — Polimento UAT + Multi-tenancy + Automação** (2026-05-11 → 2026-05-15, 5 dias): 17 reqs delivered + 1 with deviation (AUTO-02 multi-admin via has_role), 7 phases, 29 plans, 96 commits, 11 migrations aditivas, 1 nova edge fn (aniversario-clientes). Highlights: multi-tenancy RLS, automação aniversário D-5, wizard editável, descrição rica, PDF v2 sem bloco vazio, dashboard card único. → [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) · [MILESTONES.md](milestones/MILESTONES.md)
- **v1.0 — Melhorias v1** (2026-04-23 → 2026-05-07): cadastro expandido (CPF/telefone/setor), arquiteto como entidade, importação CSV de produtos, Drive RLS por colaborador, admin reorganizado, PDF v2 (Playfair+Inter), filtros por arquiteto, smoke prod 8/8 → [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

## Backlog

### Phase 999.1: PDF vetorial — substituir rasterização html2canvas (BACKLOG · PRIORIDADE ALTA)

**Goal:** Substituir o PDF rasterizado (html2pdf.js/html2canvas, cada página vira JPEG) por PDF de texto nativo/vetorial, reproduzindo fielmente o layout v2 aprovado, resolvendo de uma vez peso, tempo de geração e travamento ao navegar.

**Contexto medido (2026-06-09):** cada página é um bitmap A4 a `scale: 2` embutido como JPEG. Escala mal: 1 item=2pág/0,5MB · 20=4pág/1,1MB · 50=7pág/2,2MB · 100=12pág/4,5MB. Cada página descomprime ~14MB na RAM do leitor → trava ao abrir/rolar/zoom em propostas grandes; geração de 100 itens leva dezenas de s; texto não selecionável. Paliativo já aplicado (não resolve travamento): `image.quality` 0.98→0.92 em `Step3Revisao.tsx` + `OrcamentoDetalhe.tsx` (−33% peso, visual idêntico).

**Requirements:** TBD — candidatos: jsPDF `.html()`, `react-pdf`/`@react-pdf/renderer`, ou geração server-side.
**Restrição:** não alterar a aparência aprovada; validar visualmente contra o PDF atual antes de finalizar.
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: Sistemas Compostos — MAGNETO / TINY / MODULAR (BACKLOG · candidato a marco v1.3)

**Goal:** Fluxo de montagem de sistemas compostos no wizard — trilho magnético MAGNETO 48V, TINY MAGNETO 24V e perfil modular SYSTEM MOLD — assemblando módulos + driver dimensionado + componentes obrigatórios, em vez de entrarem como luminária avulsa.

**Contexto:** separado da v1.2 (UAT) por ser evolução estrutural (~40% do esforço e ~todo o risco). Origem: comentários UAT 8, 9, 11 e parte do 10. Requisitos SIST-01 (MAGNETO 48V), SIST-02 (TINY 24V), SIST-03 (SYSTEM MOLD). Pesquisa em `.planning/research/SUMMARY.md`.

**Decisão de arquitetura pendente (resolver no início):** compostos em `sistemas[]` (discriminated union) vs `luminarias[].composicao?` — pesquisa recomenda o 2º (mais conservador; evita guards no cálculo, snapshot-compat via campo undefined).

**Inclui:** modelo de dados aditivo (ex. tabela `produto_composicao`), extensão de `useProdutoSearch` (módulo/trilho), `analisarMagneto48V` (já ~80%), 5 sites de cálculo atômicos, edge fn `validar-sistema-orcamento`, **PDF v3** (seção rica de compostos).
**Restrição:** schema aditivo; não quebrar wizard v1.2 nem snapshots/PDF antigos.
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-new-milestone ou /gsd-review-backlog when ready)

---
*Last updated: 2026-06-10 — v1.2 roadmap criado (Correções UAT + UX, 18 reqs, 5 fases: 14–18). Backlog 999.1 (PDF vetorial) + 999.2 (Sistemas Compostos → v1.3) preservados.*
