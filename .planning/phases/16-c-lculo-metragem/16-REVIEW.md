---
phase: 16-calculo-metragem
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/types/orcamento.ts
  - src/components/Step2Ambientes.tsx
  - src/components/AmbienteCard.tsx
  - src/components/__tests__/Step2Gate.test.ts
  - src/components/__tests__/AmbienteCardPassadas.test.tsx
  - src/types/__tests__/sufixoMetragem.test.ts
  - supabase/migrations/20260611000001_sync_passadas_padrao.sql
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Revisao das tres mudancas da Phase 16 (CALC-01/02/03): gate de metragem no `handleNext` do Step2, helper `aplicarSufixoMetragem` com idempotencia via regex em-dash, Select de passadas restrito por `passadasPadrao` com fallback `?? 3`, e migration de sync.

O gate (CALC-01) esta correto e os testes cobrem bem os predicados. O helper de sufixo (CALC-02) e idiomatico, idempotente e os testes sao completos. A migration e segura (aditiva, idempotente via `IS DISTINCT FROM`, envolvida em transacao).

Ha um warning de logica no CALC-03: quando um perfil sem regra de familia e selecionado (`passadas_padrao NULL` no banco), o `passadasPadrao` salvo no estado passa a ser `1` em vez de `3`, restringindo o usuario a uma unica passada mesmo para familias sem restricao. Dois itens informativos tambem sao apontados.

---

## Warnings

### WR-01: `passadasPadrao` gravado como `1` quando `passadas_padrao` e NULL no banco

**Arquivo:** `src/components/AmbienteCard.tsx:203`

**Problema:** Em `handleSelectProdutoSistema` (component `'perfil'`), o valor persistido em `perfil.passadasPadrao` e calculado como:

```ts
const passadasAuto = (produto.passadas ?? base.passadas) as 1 | 2 | 3;
```

`produto.passadas` mapeia para a coluna `passadas_padrao` via alias na query do `useProdutoSearch` (linha 19). Para perfis cuja familia **nao possui entrada em `regras_compatibilidade_perfil`**, a migration nao preenche `passadas_padrao` — ele permanece `NULL`, entao `produto.passadas` chega como `null`.

Quando o sistema e novo (`sis.perfil = null`), `base` e criado com `passadas: 1 as const`. O fallback `?? base.passadas` resolve para `1`, e `passadasPadrao` fica `1`. O Select de passadas entao renderiza apenas `[1]` — o usuario nao consegue selecionar 2 ou 3 passadas ainda que a familia nao tenha restricao alguma.

O fallback `?? 3` presente no JSX (linha 532) so protege o caminho de **leitura de estado ja salvo** (`passadasPadrao === undefined`), nao o caminho de **escrita** no select do produto.

**Correcao:**

```ts
// AmbienteCard.tsx linha 203 — substituir:
const passadasAuto = (produto.passadas ?? base.passadas) as 1 | 2 | 3;

// por:
const passadasAuto = (produto.passadas ?? 3) as 1 | 2 | 3;
```

Isso alinha o comportamento com o fallback de leitura (`?? 3`) e evita restricao inadvertida para familias sem regra cadastrada.

---

## Info

### IN-01: Testes do gate (Step2Gate) espelham predicados manualmente em vez de importar do fonte

**Arquivo:** `src/components/__tests__/Step2Gate.test.ts:11-28`

**Problema:** Os predicados `metragemInvalida` e `totalmenteVazio` sao re-implementados inline no arquivo de teste em vez de serem importados ou testados via chamada do `handleNext`. Se a logica em `Step2Ambientes.tsx` for alterada sem atualizar o teste, os testes continuam passando silenciosamente (falso positivo de cobertura).

**Sugestao:** Extrair os predicados para funcoes exportadas em `Step2Ambientes.tsx` ou para um modulo de utilitarios e importa-los nos testes. Alternativa: testar via render do componente com `@testing-library/react`.

---

### IN-02: Ambiente vazio (sem luminarias e sem sistemas) passa o gate sem aviso

**Arquivo:** `src/components/Step2Ambientes.tsx:35-36`

**Problema:** O gate de avanco do Step 2 apenas verifica `ambientes.length === 0`. Um ambiente com `luminarias: []` e `sistemas: []` (completamente vazio) passa normalmente, podendo resultar em um PDF com secao de ambiente sem itens.

**Sugestao:** Adicionar validacao opcional — se todos os ambientes estiverem vazios (nenhum item em nenhum), exibir `toast.warning` informativo. A restricao pode ser suave (nao bloqueante) para preservar o fluxo atual.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
