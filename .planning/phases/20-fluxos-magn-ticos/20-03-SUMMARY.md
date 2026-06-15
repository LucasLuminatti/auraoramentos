---
phase: 20-fluxos-magn-ticos
plan: "03"
subsystem: ambiente-card
tags: [product-first, routing, unified-list, composicao-card, fita-padrao, phase-20]
dependency_graph:
  requires: [20-01, 20-02]
  provides: [AmbienteCard-product-first, handleSelectProdutoGlobal, lista-unificada]
  affects: [src/components/AmbienteCard.tsx]
tech_stack:
  added: []
  patterns: [product-first-routing, inline-sistema-preenchido, unified-list-render, composicao-card-integration]
key_files:
  created: []
  modified:
    - src/components/AmbienteCard.tsx
decisions:
  - "Tasks 1 e 2 co-implementados em um unico commit — mesmo arquivo, mesmo contexto; ambas acceptance criteria verificadas individualmente"
  - "Fita route (Pitfall 4): sistema pre-populado inline em um unico onChange + async driver suggestion via ambienteRef — nao chama addSistema() separadamente"
  - "handleSelectProdutoGlobal e handler de criacao; handleSelectProdutoLuminaria permanece para edicao inline de itens simples existentes"
  - "Toasts REGRA #5-#28 preservados e replicados no handleSelectProdutoGlobal para cada rota (magneto/tiny/simples)"
  - "d (descricao uppercase) declarado duas vezes no mesmo handler — ok pois vive em branches if separados (return entre eles)"
metrics:
  duration_minutes: 15
  completed_date: "2026-06-15"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 1
---

# Phase 20 Plan 03: AmbienteCard Product-First Summary

**One-liner:** AmbienteCard reorganizado com busca product-first unica (sem abas), lista unificada luminarias[]+sistemas[], roteamento automatico via detectarTipoAncora e ComposicaoCard integrado — card de Fita Padrao byte-identico, 5 calc sites intocados.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Roteamento product-first + handler de selecao global | 237468c | src/components/AmbienteCard.tsx |
| 2 | Lista unificada — remover tabs, render product-first + ComposicaoCard + Fita Padrao intocado | 237468c | src/components/AmbienteCard.tsx (co-implementado) |

## What Was Built

### Task 1 — handleSelectProdutoGlobal + imports

Adicionado ao `src/components/AmbienteCard.tsx`:

- **Imports novos:** `detectarTipoAncora` adicionado ao import de `@/types/orcamento`; `import ComposicaoCard from "./ComposicaoCard"`
- **Removido:** `activeTab` state + import de `Tabs/TabsContent/TabsList/TabsTrigger`
- **`handleSelectProdutoGlobal(produto: Produto)`** — roteia via `detectarTipoAncora`:
  - **Fita:** constroi `SistemaIluminacao` pre-populado inline (Pitfall 4 — sem stale closure); faz um unico `onChange`; dispara sugestao de driver async via `buscarDriverSugerido` + `ambienteRef.current` (mesmo padrao do path original)
  - **magneto_48v / tiny_magneto:** cria `ItemLuminaria` raiz com `composicao: []` ativo (Pattern 2); preserva toasts de aviso
  - **modular / luminaria / fallback D-03:** cria item simples sem `composicao`; preserva toasts REGRA #24/#25/#28

### Task 2 — Lista unificada (substituicao das Tabs)

Substituiu o bloco `<Tabs>...</Tabs>` (360-647) por:

1. **Busca product-first** acima da lista: `ProdutoAutocomplete` com `onSelect={handleSelectProdutoGlobal}` e `placeholder="Buscar produto por codigo ou descricao..."`; label "Adicionar ao ambiente"
2. **Banner legado `analisarMagneto48V`** mantido como fallback para luminarias antigas sem composicao
3. **`ambiente.luminarias.map()`** — se `item.composicao !== undefined` renderiza `<ComposicaoCard>`; senao renderiza linha simples (edicao inline via `handleSelectProdutoLuminaria` + fallback "Iniciar como sistema composto" para magneto/tiny sem composicao)
4. **`ambiente.sistemas.map()`** — card de Fita Padrao byte-identico (todo o markup de fita/perfil/driver/ValidacaoPanel movido para fora do `<TabsContent>`, sem nenhuma alteracao de logica)
5. **Estado vazio:** "Nenhum item adicionado. Use a busca acima para adicionar luminarias ou sistemas."
6. **Botoes "Adicionar Luminaria" e "Novo Sistema"** removidos como pontos de entrada — handlers `addLuminaria`/`addSistema` preservados internamente

## Deviations from Plan

### Architectural Notes

**1. [Decisao de execucao] Tasks 1 e 2 co-implementados em commit unico**
- **Motivo:** Ambas as tasks modificam o mesmo arquivo. Commit parcial de arquivo com JSX e handlers entrelaçados geraria estado inconsistente.
- **Impacto:** Zero — acceptance criteria de ambas as tasks verificadas individualmente antes do commit.

**2. [Decisao de execucao] Fita route sem chamar addSistema() + handleSelectProdutoSistema()**
- **Motivo:** Pitfall 4 — `addSistema()` faz `onChange` com o novo sistema; `handleSelectProdutoSistema` leria `ambiente.sistemas[novoIndex]` do closure stale (ambiente antes do onChange). Solucao: construir `SistemaIluminacao` pre-populado (fita preenchida, driver vazio) em um unico `onChange`, depois disparar busca async de driver pelo mesmo padrao do path original (ambienteRef.current + findIndex por id).
- **Impacto:** Comportamento identico ao path original de selecao de fita em `handleSelectProdutoSistema`; sem regressao.

## Verification Results

- `grep -n "detectarTipoAncora(produto)" AmbienteCard.tsx` → linha 325 (1 match)
- `grep -n "import ComposicaoCard" AmbienteCard.tsx` → linha 16 (1 match)
- `grep -c "handleSelectProdutoGlobal" AmbienteCard.tsx` → 2 (definicao linha 324 + uso linha 495)
- `grep -n "composicao: \[\]" AmbienteCard.tsx` → linha 418 (raiz de composicao) + linha 559 (fallback D-03)
- `grep -c "handleSelectProdutoSistema" AmbienteCard.tsx` → 6 (definicao + 5 usos: fita, perfil, driver, fita path global, driver path global)
- `grep -n "const addSistema" AmbienteCard.tsx` → linha 70 (1 match)
- `grep -c "TabsContent" AmbienteCard.tsx` → 0 (tabs removidas)
- `grep -c "activeTab" AmbienteCard.tsx` → 0 (state removido)
- `grep -n "<ComposicaoCard" AmbienteCard.tsx` → linha 520 (1 match)
- `grep -n "item.composicao !== undefined" AmbienteCard.tsx` → linha 518 (1 match)
- `grep -n "Buscar produto por codigo ou descricao" AmbienteCard.tsx` → linha 496 (1 match)
- `grep -n "Iniciar como sistema composto" AmbienteCard.tsx` → linha 561 (1 match)
- `grep -n "Nenhum item adicionado" AmbienteCard.tsx` → linha 804 (1 match)
- `grep -n "ValidacaoPanel" AmbienteCard.tsx` → linha 12 (import) + linha 794 (uso) = 2 total (import + 1 uso)
- `grep -n "export function calcularDemandaFita" orcamento.ts` → linha 225 (assinatura intocada)
- `grep -n "function isSistemaVazio" v2.ts` → linha 89 (arquivo NAO tocado)
- `npm run build`: verde (31.40s, warnings de chunk size sao pre-existentes)
- `npm run lint`: 756 erros pre-existentes em supabase functions e tailwind.config — zero erros novos em AmbienteCard.tsx

## Task 3 — Checkpoint human-verify

**Status: AGUARDANDO** — checkpoint bloqueante de verificacao visual.

Ver secao de checkpoint abaixo para os 9 cenarios de verificacao.

## Known Stubs

Nenhum — `handleSelectProdutoGlobal` consome `detectarTipoAncora` (contrato real do Plano 01), cria dados reais no estado do orcamento, e ComposicaoCard (Plano 02) e funcional sem mocks.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-20-09 mitigado | AmbienteCard.tsx | Fallback gracioso D-03: dado sujo/ausente → item simples; nunca quebra nem perde o produto; `composicao: []` so criado quando `tipo === 'magneto_48v' \|\| tipo === 'tiny_magneto'` via detectarTipoAncora |
| T-20-10 mitigado | AmbienteCard.tsx | `composicao` opcional; itens antigos sem composicao renderizam como linha simples; Fita Padrao byte-identico |
| T-20-11 aceito | AmbienteCard.tsx | Nenhuma nova rota/permissao; mesma sessao autenticada; RLS inalterada |

## Self-Check: PASSED

- src/components/AmbienteCard.tsx modificado: FOUND
- Commit 237468c: FOUND (`git log --oneline -1` = `237468c feat(20-03): AmbienteCard product-first unified list + ComposicaoCard wire-up`)
- Build verde: CONFIRMED (built in 31.40s)
- 5 calc sites byte-identicos: CONFIRMED (grep das assinaturas — arquivos orcamento.ts e v2.ts NAO modificados neste plano)
