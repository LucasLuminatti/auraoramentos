# Phase 6: Filtros & Smoke - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 06-filtros-smoke
**Areas discussed:** UI do filtro, Persistência
**Areas auto-decided (Claude's Discretion):** Combinações (FIL-04), Smoke test (WRAP-01)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| UI do filtro | Onde aparece, qual componente | ✓ |
| Combinações (FIL-04) | Quais combinações fazem sentido | (Claude's Discretion) |
| Persistência | URL / localStorage / só estado | ✓ |
| Smoke test (WRAP-01) | Manual / Playwright / misto | (Claude's Discretion) |

---

## UI do Filtro

### Componente

| Option | Description | Selected |
|--------|-------------|----------|
| Reusar ArquitetoAutocomplete (Recommended) | Mesmo Command/Combobox shadcn do form de cliente | ✓ |
| Select shadcn simples | Dropdown padrão | |
| Chips de filtro acima da tabela | Botão "+ Filtrar por arquiteto" abre popover | |

**User's choice:** Reusar ArquitetoAutocomplete

### Posição

| Option | Description | Selected |
|--------|-------------|----------|
| Header da tabela, ao lado do botão de ação (Recommended) | Mesma linha do "+ Novo X" | ✓ |
| Linha própria acima da tabela | Reserva linha pra filtros | |
| Coluna da tabela (filter por header) | Estilo Excel | |

**User's choice:** Header da tabela, ao lado do botão de ação

---

## Persistência

### Mecanismo

| Option | Description | Selected |
|--------|-------------|----------|
| URL search params (Recommended) | ?tab=clientes&arquiteto=<id>, segue pattern do tab | ✓ |
| localStorage | Lembra entre sessões mesmo browser | |
| Só estado local (useState) | Zera no refresh | |

**User's choice:** URL search params

### Cross-tab

| Option | Description | Selected |
|--------|-------------|----------|
| Cada tab tem filtro independente (Recommended) | arq_<scope>=<id>, sem vazamento entre tabs | ✓ |
| Filtro global | Uma seleção aplica em todas as listas | |

**User's choice:** Cada tab tem filtro independente

---

## Claude's Discretion (auto-decided)

### Combinações (FIL-04)
- Clientes: só `arquiteto`
- Produtos: só `arquiteto`
- Pedidos: `arquiteto` + `cliente` + `período (data_de / data_até)` + `status` (combinados via AND, query Supabase com `.eq()` / `.gte()` / `.lte()`)

Razão: lista de Pedidos é a tabela com pressão de uso real. Cadastros não tem outras dimensões úteis nesse marco.

### Smoke test (WRAP-01)
- Checklist em `06-WRAP-UAT.md` (UAT-style padrão das phases anteriores)
- Lenny executa em produção, marca cada item
- Onde Playwright MCP conseguir rodar autônomo (cliente novo, orçamento, PDF, importar CSV), eu faço
- Manual obrigatório: signup novo (email externo), Drive isolado (RLS via 2 contas)
- Critério de fechamento: 0 itens com `failed` que sejam regressão real

## Deferred Ideas

- Save/preset de filtros (v2)
- Search por texto livre nas tabelas (não no requirement)
- Filtro de Pedidos por colaborador (anotar como TODO se virar dor)
- Filtro em Exceções e Drive (escopo focado em Cadastros + Pedidos)
- Save UAT runs como artifact pra histórico (v2)
