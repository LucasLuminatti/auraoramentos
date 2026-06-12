# Phase 19: Fundação Compostos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 19-funda-o-compostos
**Areas discussed:** Shape do ItemComposicao, Seed da tabela
**Areas deferred to research as-is:** CAT-03 catálogo, Vocabulário de papel

---

## Gray Area Selection

| Área | Description | Selected |
|------|-------------|----------|
| Shape do ItemComposicao | Minimal vs forward-complete (comprimento?/potenciaW?) | ✓ |
| CAT-03 catálogo | Lista de SKUs + filtros conector/kit_fixacao | (segue pesquisa as-is) |
| Seed da tabela | Vazia vs seed regras de família conhecidas | ✓ |
| Vocabulário de papel | 6 papéis da pesquisa as-is vs ajustar | (segue pesquisa as-is) |

---

## Shape do ItemComposicao

### Q1 — Completude do tipo

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-complete | comprimento? + potenciaW? opcionais agora | ✓ |
| Mínimo (pesquisa) | só shape da pesquisa; estender depois | |

**User's choice:** Forward-complete. "Quero que o ItemComposicao já nasça preparado para as próximas fases... Como a fase atual é de fundação, faz mais sentido pagar esse custo uma vez só e evitar refactor de interface e migração de snapshots depois." comprimento? + potenciaW? opcionais, resto do shape mínimo preservado.

### Q2 — Origem dos campos técnicos + preço

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot do catálogo | Congela de product_variants no add-time | ✓ |
| Decide você | Critério da implementação | |

**User's choice:** Snapshot do catálogo. "O orçamento precisa ficar autocontido. Se o catálogo mudar depois, o orçamento antigo não pode mudar junto... Eu não deixaria isso para decisão aberta na implementação, porque essa origem de dados afeta diretamente consistência, auditoria e comportamento histórico."

### Q3 — Discriminador tipoSistema?

| Option | Description | Selected |
|--------|-------------|----------|
| Detectar via product.sistema | Sem campo novo; Phase 20 infere | ✓ |
| Adicionar tipoSistema? agora | Campo discriminador explícito na raiz | |

**User's choice:** Detectar via product.sistema. "Já existe um campo product.sistema que contém exatamente a informação necessária... Adicionar tipoSistema agora cria duplicação de informação e abre espaço para inconsistência. O requirement SIST-05 pertence à Phase 20." Evoluir para campo persistido só se surgir necessidade real.

---

## Seed da tabela

### Q1 — Onde moram as regras de conector obrigatório por família

| Option | Description | Selected |
|--------|-------------|----------|
| Constante no código | Mapa de regras por família no código; tabela só p/ sugestões SKU↔SKU | ✓ |
| Tudo em produto_composicao | Modelar regras de família como pares pai→filho na tabela | |

**User's choice:** Constante no código. "Essas famílias são poucas e bem definidas. A regra é estrutural do produto, não um conteúdo volátil de catálogo. O validador da Phase 20 precisa funcionar mesmo que a tabela de sugestões ainda esteja vazia. Isso evita acoplamento desnecessário entre o checklist e a base de seeds."

### Q2 — Tabela vazia agora vs semeada

| Option | Description | Selected |
|--------|-------------|----------|
| Vazia agora | Migration cria tabela vazia; popular incremental depois | ✓ |
| Seed das sugestões conhecidas | Inserir pares pai→filho conhecidos nesta fase | |

**User's choice:** Vazia agora. "A Phase 19 é fundação, não preenchimento de catálogo. As regras obrigatórias por família já ficam no código, então a tabela não pode ser um ponto de falha. Criar seed agora exigiria uma lista completa e confiável de compatibilidades, o que aumenta o risco de semear dado incompleto."

---

## Claude's Discretion

- Lista exata de SKUs da CAT-03 (auditar DB).
- Mecânica fina das migrations; índices/constraints; testes unitários do novo calc.
- Nome/local da constante REGRAS_COMPOSICAO.

## Deferred Ideas

- SIST-05 (seletor de tipo) → Phase 20.
- COMP-01/02, DRV-01/02 → Phase 20.
- População de produto_composicao → pós-fundação.
- PDF v3 (PDF-03) → Phase 22.
