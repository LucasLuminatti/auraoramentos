---
phase: 21-system-mold-valida-o-reuso
plan: 02
subsystem: ui-composicao
tags: [system-mold, composicao-card, modular, fita-derivada, driver-advisory, duplicar]
dependency_graph:
  requires:
    - calcularMetragemModulosDifusos (orcamento.ts — Plan 01)
    - parsearComprimentoModulo (orcamento.ts — Plan 01)
    - filtro modulo_difuso (useProdutoSearch.ts — Plan 01)
    - sistema='s_mode' em product_variants (migration — Plan 01)
    - detectarTipoAncora retorna 'modular' (orcamento.ts — Plan 01)
  provides:
    - rota 'modular' em AmbienteCard.handleSelectProdutoGlobal
    - ComposicaoCard ramo isModular (badge MODULAR, difusos, metragem derivada, fita modular, driver advisory)
    - prop onDuplicate? em ComposicaoCardProps (wiring destino Plan 03)
  affects:
    - AmbienteCard.tsx (rota nova, sem tocar fita/magneto/tiny)
    - ComposicaoCard.tsx (extensão pura — 48V/24V inalterados)
tech_stack:
  added: []
  patterns:
    - Driver advisory reaproveitando sugestao24v state (mesmo padrão TINY 24V)
    - itemRef.current em callbacks async (Pitfall 5 — T-21-04 mitigado)
    - Busca escopada via filtro='modulo_difuso' (Plan 01) e filtro='fita' existente
key_files:
  created: []
  modified:
    - src/components/AmbienteCard.tsx
    - src/components/ComposicaoCard.tsx
decisions:
  - "buscarDriverModular reutiliza sugestao24v/setSugestao24v/buscando24v/setSem24v (estados 24V existentes) — sem estado duplicado; renderPainelDriver24V renderizado para isModular também"
  - "Driver permanece advisory: buscarDriverModular só popula sugestao24v; aplicarDriver24V exige clique Aplicar — T-21-05 (auditabilidade) honrado"
  - "handleSelecionarModulo ramificado: quando isModular, comprimento=parsearComprimentoModulo(descricao), potenciaW=undefined (difusos não têm potência W/m)"
  - "Painel de driver renderizado condicionalmente para (is48V || is24V || isModular) — evita seção vazia para itens simples futuros"
metrics:
  duration: "25 min"
  completed: "2026-06-16"
  tasks: 2
  files: 2
requirements:
  - SIST-03
  - DUP-01
---

# Phase 21 Plan 02: UI SYSTEM MOLD — Rota Modular + ComposicaoCard Extensão

**One-liner:** Rota 'modular' em AmbienteCard inicia ItemLuminaria sistema='s_mode' com composicao:[], e ComposicaoCard ganha ramo isModular — badge MODULAR, difusos com comprimento snapshot, painel de fita derivada (Σ comprimento × qtd), "Adicionar fita" com SKU escolhido pelo vendedor e metragem pré-preenchida, driver advisory reutilizando padrão 24V, e botão Duplicar (Copy) no header para Plan 03.

## What Was Built

### Task 1: Rota 'modular' em AmbienteCard (commit e22aa82)

Em `src/components/AmbienteCard.tsx`, `handleSelectProdutoGlobal`:

- Adicionado bloco `if (tipo === 'modular')` antes do fallback item-simples (linha 420)
- Cria `ItemLuminaria` com `sistema: 's_mode'`, `potencia_watts: null`, `composicao: []`
- `composicao: []` presença ativa a renderização condicional `<ComposicaoCard>` (linha 514 — inalterada)
- Comentário do fallback atualizado: "luminaria e fallback (D-03)" — 'modular' removido
- Rotas 'fita', 'magneto_48v', 'tiny_magneto' byte-idênticas (git diff confirmado)

### Task 2: Ramo modular no ComposicaoCard (commit 0e847ef)

Em `src/components/ComposicaoCard.tsx`:

**Interfaces e props:**
- `ComposicaoCardProps` estendida com `onDuplicate?: () => void` (Phase 21 / DUP-01 — wiring no Plan 03)
- Destructuring atualizado: `{ item, onChange, onRemove, onDuplicate, indice }`

**Imports adicionados:**
- `Copy` de `lucide-react`
- `calcularMetragemModulosDifusos`, `parsearComprimentoModulo` de `@/types/orcamento`

**Flags e derivações:**
- `const isModular = item.sistema === "s_mode"` (junto a is48V/is24V)
- `const metragemDerivada = isModular ? calcularMetragemModulosDifusos(item.composicao) : 0`
- `const fitaModular = composicao.find((c) => c.papel === "fita_modular")`
- `const [mostrarBuscaFita, setMostrarBuscaFita] = useState(false)`

**Header:**
- Badge MODULAR (sky-400/sky-700/sky-50) junto a MAGNETO 48V e TINY 24V
- Botão Duplicar (Copy icon, `title="Duplicar"`) renderizado condicionalmente quando `onDuplicate` presente
- Botão Lixeira agrupado em `<div className="flex items-center gap-1">`

**Busca de difuso:**
- `handleSelecionarModulo` atualizado: `filtro={isModular ? "modulo_difuso" : "luminaria"}`; `filtroSistema={isModular ? undefined : familiaSistema}`
- Quando `isModular`: `comprimento = parsearComprimentoModulo(produto.descricao)` gravado no ItemComposicao; `potenciaW = undefined` (difusos não têm W/m)
- Placeholder adapta: "Buscar difuso SYSTEM MOLD..." vs "Buscar módulo..."
- Botão texto adapta: "+ Adicionar difuso" vs "+ Adicionar módulo"

**Painel fita derivada** (renderizado só quando `isModular`):
- Exibe metragem formatada: `Σ(comprimento × qtd)` via `calcularMetragemModulosDifusos`
- Se fita não escolhida + metragem > 0: botão "Adicionar fita" → `setMostrarBuscaFita(true)`
- `mostrarBuscaFita`: `<ProdutoAutocomplete filtro="fita">` → `handleAdicionarFitaModular`
- Se fita escolhida: mostra linha editável (codigo readOnly, descricao readOnly, campo metragem editável, PrecoInput, botão remover)

**`handleAdicionarFitaModular`:**
- Lê metragem via `calcularMetragemModulosDifusos(itemRef.current.composicao)` (Pitfall 5)
- Cria `ItemComposicao` com `papel: 'fita_modular'`, `comprimento: metragem` (pré-preenchido)
- Fecha busca e dispara `buscarDriverModular(produto.voltagem ?? 24, produto.wm ?? 0, metragem)` (não-bloqueante)

**`buscarDriverModular`:**
- Query Supabase: `driver` + voltagem da fita + `potencia_watts >= wm × metragem × MARGEM_SEGURANCA_DRIVER`
- Popula `sugestao24v` (estado compartilhado com TINY 24V) → exibe no `renderPainelDriver24V`
- Driver inserido APENAS quando vendedor clica "Aplicar" (`aplicarDriver24V`) — advisory confirmado
- Usa flag `cancelled` no closure async (T-21-04 mitigado)

**Painel de driver:**
- Renderizado para `(is48V || is24V || isModular)` — `isModular` usa `renderPainelDriver24V()`

## Deviations from Plan

### Auto-fixed Issues

**[Rule 2 — Missing] Campo metragem editável na fita modular exibida**

- **Found during:** Task 2 — o plano mostrava apenas a fita em modo readOnly genérico no bloco `/* mostra fita escolhida... */`
- **Fix:** Implementado campo `<Input type="number">` editável para `comprimento` na linha da fita modular (correção pelo vendedor pós-seleção)
- **Rationale:** Metragem derivada pode necessitar ajuste manual (perdas de corte, margem de projeto) — readOnly bloquearia uso real

**[Rule 1 — Bug] `filtroSistema` omitido quando `isModular`**

- **Found during:** Task 2 — `filtroSistema={familiaSistema}` passaria `'s_mode'` para `ProdutoAutocomplete` no filtro `luminaria`, mas o filtro `modulo_difuso` não usa `filtroSistema` (query diferente em useProdutoSearch). Passar `'s_mode'` causaria query incorreta.
- **Fix:** `filtroSistema={isModular ? undefined : familiaSistema}` — omitido para modular

## Known Stubs

Nenhum. `onDuplicate` é prop opcional (não wired ainda) — por design: Plan 03 faz o wiring. O card modular é totalmente funcional sem ela (botão simplesmente não aparece quando `undefined`).

## Threat Flags

Nenhum novo. T-21-04 (reconciliação async) mitigado via `itemRef.current` em `handleAdicionarFitaModular` e `buscarDriverModular`. T-21-05 (auditabilidade SKU fita) honrado — vendedor sempre escolhe SKU, snapshot congela no item.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/components/AmbienteCard.tsx` modificado | FOUND |
| `src/components/ComposicaoCard.tsx` modificado | FOUND |
| commit e22aa82 (Task 1 — rota modular AmbienteCard) | FOUND |
| commit 0e847ef (Task 2 — ComposicaoCard modular) | FOUND |
| `grep isModular ComposicaoCard.tsx` | 12 ocorrências |
| `grep calcularMetragemModulosDifusos ComposicaoCard.tsx` | 3 ocorrências |
| `grep parsearComprimentoModulo ComposicaoCard.tsx` | 3 ocorrências |
| `grep fita_modular ComposicaoCard.tsx` | 2 ocorrências |
| `grep modulo_difuso ComposicaoCard.tsx` | 1 ocorrência |
| `grep '"fita"' ComposicaoCard.tsx` | 1 ocorrência |
| `grep onDuplicate ComposicaoCard.tsx` | 4 ocorrências |
| `grep '"Duplicar"' ComposicaoCard.tsx` | 1 ocorrência |
| `grep driver_recomendado ComposicaoCard.tsx` | 7 ocorrências |
| Driver NOT auto-inserted (advisory only) | CONFIRMED |
| `npm run build` verde | PASS |
| 184 testes verdes | PASS |
