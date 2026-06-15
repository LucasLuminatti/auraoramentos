---
phase: 20-fluxos-magn-ticos
plan: "02"
subsystem: composicao-card
tags: [composicao, magneto, tiny, driver-panel, checklist, voltage-lock, phase-20]
dependency_graph:
  requires: [20-01]
  provides: [ComposicaoCard]
  affects: [src/components/ComposicaoCard.tsx]
tech_stack:
  added: []
  patterns: [snapshot-on-add, reconciliation-via-ref, product-first-scoped-search, voltage-lock-by-construction]
key_files:
  created:
    - src/components/ComposicaoCard.tsx
  modified: []
decisions:
  - "Tasks 1 e 2 co-implementados em um unico commit — ambos modificam o mesmo arquivo; nao faz sentido commit parcial de um unico arquivo"
  - "Driver 24V busca Supabase async por menor driver compativel (sem limite 200W, diferente do 48V)"
  - "Voltage lock por construcao via filtroVoltagem prop — sem toast de erro, driver incompativel nunca aparece"
  - "Reconciliacao pos-await via useRef(item) — evita escrita em snapshot stale apos fetch de driver/conector (Pitfall 3)"
  - "adicionarComponentePorSku: helper unico para conector e kit — fetch por codigo, snapshot imutavel"
metrics:
  duration_minutes: 6
  completed_date: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 20 Plan 02: ComposicaoCard Summary

**One-liner:** `ComposicaoCard` autocontido com trilho ancora, lista de modulos (busca escopada por familia), painel de driver de 5 estados (48V via `recomendarDriver48V` / 24V via query async), voltage lock por construcao e checklist `REGRAS_COMPOSICAO` com atalho de insercao de conector e kit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ComposicaoCard — estrutura, trilho ancora, modulos e carga total | 5f0e63f | src/components/ComposicaoCard.tsx |
| 2 | Painel de driver, voltage lock e checklist | 5f0e63f | src/components/ComposicaoCard.tsx (co-implementado) |

## What Was Built

### ComposicaoCard.tsx (836 linhas)

**Props interface:**
```typescript
interface ComposicaoCardProps {
  item: ItemLuminaria;     // trilho ancora com composicao[]
  onChange: (item: ItemLuminaria) => void;
  onRemove: () => void;
  indice: number;          // label "Sistema N"
}
```

**Estrutura:**
- `PrecoInput` local equivalente ao do AmbienteCard (Input type=number, borda destructive se abaixo do minimo)
- Header com badge de tipo (MAGNETO 48V: amber / TINY 24V: violet), badge de carga total, botao Trash
- Trilho ancora: campos readOnly + qtd/preco editaveis + badge subtotal total (trilho + composicao)
- Lista de modulos: linha compacta com badge potenciaW ("?W" se undefined — Pitfall 2), preco editavel, botao remover
- Botao "+ Adicionar modulo": abre ProdutoAutocomplete com `filtro="luminaria" filtroSistema={familiaSistema}` (escopo por familia)

**Painel de driver — 5 estados:**
- `sem_carga`: borda dashed, mensagem instructional
- `recomendado`: painel azul com SKU/potencia + botao "Aplicar"
- `aplicado_ok`: painel verde com Check + "Alterar" (remove driver da composicao)
- `subdimensionado`: painel amber com nova recomendacao + "Reaplicar recomendacao"
- `excede_200w` (48V): painel amber sem botao Aplicar, orientacao de dividir em N circuitos (D-08)

**48V:** `recomendarDriver48V(cargaTotalW)` → buckets LM2343/LM2344 com margem ×1.05
**24V:** `useEffect` busca async Supabase menor driver `.eq("tensao", 24).gte("potencia_watts", cargaTotalW * 1.05)`. Se nenhum encontrado: mensagem "Nenhum driver 24V compativel no catalogo para NW. Selecione manualmente." (texto exato per Copywriting Contract).

**Voltage lock (COMP-03/D-12):** busca manual de driver usa `filtroVoltagem={is48V ? 48 : 24}` — por construcao, driver de voltagem incompativel nunca aparece. Zero toast de erro.

**Checklist (COMP-01/COMP-02):**
- Le `REGRAS_COMPOSICAO[item.sistema]` do codigo (nao do banco — RESEARCH Anti-Pattern confirmado)
- Conector: OR entre `conectoresObrigatorios` — TINY aceita LM3168 OU LM3169 (D-10); atalho usa LM3168 como default
- Kit LM2987: so aparece se `/EMBUTIR/i.test(item.descricao)` (D-11)
- Botao "+ Adicionar": `adicionarComponentePorSku` — fetch por SKU, snapshot imutavel, papel correto

**Reconciliacao pos-await (Pitfall 3):** `useRef(item)` atualizado por `useEffect` — todas as funcoes async que chamam `onChange` usam `itemRef.current` em vez do `item` capturado no closure, evitando escrita em snapshot stale.

## Deviations from Plan

### Auto-fixed Issues

Nenhum bug encontrado.

### Architectural Notes

**1. [Decisao de execucao] Tasks 1 e 2 co-implementados em commit unico**
- **Motivo:** Ambas as tasks modificam o mesmo arquivo `ComposicaoCard.tsx`. O arquivo ja existia de uma execucao anterior interrompida com todo o conteudo implementado e verificado (build verde, lint sem erros novos).
- **Impacto:** Zero — as acceptance criteria de ambas as tasks foram verificadas individualmente antes do commit.

## Verification Results

- `npm run build`: verde (22.01s, warnings de chunk size sao pre-existentes)
- `npm run lint`: sem erros novos no ComposicaoCard (756 erros pre-existentes em outros arquivos nao tocados)
- `grep -n "const ComposicaoCard"`: 1 match (linha 68)
- `grep -c "from \"@/"`: 8 matches (imports com alias)
- `grep -c "from \"\.\./"`: 0 (nenhum import relativo)
- `grep -n "calcularCargaComposicao"`: 2 matches (import + uso)
- `grep -n "filtroSistema={familiaSistema}"`: 1 match
- `grep -n "papel: \"modulo\""`: 1 match
- `grep -n '"?W"'`: 1 match (Pitfall 2)
- `grep -n "MAGNETO 48V"` e `"TINY 24V"`: 1 match cada
- `grep -n "recomendarDriver48V"`: 2 matches (import + uso)
- `grep -n "filtroVoltagem={is48V ? 48 : 24}"`: 2 matches (ambos os paineis de busca manual)
- `grep -n "REGRAS_COMPOSICAO\[item.sistema"`: 1 match
- `/EMBUTIR/i`: 1 match (linha 323)
- `LM3168`: 1 match (default TINY conector, D-10)
- `excede 200W`: 1 match (D-08, sem botao Aplicar nesse ramo)
- `Nenhum driver 24V compativel`: 1 match
- `.eq("tensao", 24)`: 1 match (busca driver 24V)

## Known Stubs

Nenhum — componente funcional consumindo contratos reais do Plano 01 e Supabase. Sem dados mockados ou placeholders.

## Threat Flags

Nenhuma nova superficie de rede além das documentadas no threat model do plano:
- T-20-05 mitigado: snapshot imutavel no add-time + reconciliacao por itemRef (Pitfall 3)
- T-20-06 mitigado: voltage lock por construcao via filtroVoltagem
- T-20-07 aceito: catálogo `produtos` legivel por autenticados, RLS inalterada
- T-20-08 mitigado: Pitfall 2 — "?W" em vez de "0W", nao bloqueia montagem

## Self-Check: PASSED

- src/components/ComposicaoCard.tsx criado: FOUND (5f0e63f)
- Commit 5f0e63f: FOUND (`git log --oneline -1` = `5f0e63f feat(20-02): implement ComposicaoCard`)
- Build verde: CONFIRMED (✓ built in 22.01s)
- min_lines 180: CONFIRMED (836 linhas)
