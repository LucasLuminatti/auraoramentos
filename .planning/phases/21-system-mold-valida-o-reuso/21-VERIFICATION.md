---
phase: 21-system-mold-valida-o-reuso
verified: 2026-06-16T14:10:00Z
status: passed
score: 3/3
overrides_applied: 0
---

# Phase 21: SYSTEM MOLD + Validação & Reuso — Verification Report

**Phase Goal:** O colaborador consegue montar sistemas SYSTEM MOLD, recebe aviso ao avançar com sistema incompleto, e pode duplicar um sistema composto inteiro para outro ambiente sem remontar do zero
**Verified:** 2026-06-16T14:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Com tipo "Modular": colaborador monta SYSTEM MOLD — perfil modular + N módulos difusos (SKU + qtd + comprimento); demanda de fita derivada automaticamente de Σ(comprimento × qtd) sem entrada manual | VERIFIED | `detectarTipoAncora` returns `'modular'` for `sistema_magnetico === 's_mode'` (orcamento.ts:177). AmbienteCard rota `tipo === 'modular'` cria `ItemLuminaria` com `sistema:'s_mode'` e `composicao:[]` (AmbienteCard.tsx:421-432). ComposicaoCard ramo `isModular` usa `filtro="modulo_difuso"` para busca de difusos, `parsearComprimentoModulo` grava comprimento snapshot no ItemComposicao, e `calcularMetragemModulosDifusos` computa Σ(comprimento × qtd) exibido em tempo real (ComposicaoCard.tsx:74,107,286-299). Migration aplicada: 12 perfis-âncora + 15 difusos com `sistema='s_mode'` em product_variants. |
| 2 | Ao tentar avançar do Step 2 para o Step 3, se algum sistema composto estiver incompleto (trilho sem driver ou sem conector obrigatório da família), um aviso aparece com a descrição do problema — o colaborador pode continuar mesmo assim (não-bloqueante) | VERIFIED | `detectarAvisosComposto()` exportada de Step2Ambientes.tsx (linha 38) cobre 3 condições: `composto-sem-driver` (magneto_48v/tiny_magneto sem driver_recomendado), `composto-sem-conector` (família sem conectores obrigatórios via REGRAS_COMPOSICAO), e `modular-sem-fita` (s_mode com metragem > 0 sem fita_modular). Função integrada no `handleNext` via `itensIncompletos.push(...detectarAvisosComposto(amb))` (linha 221). Advisory flow usa AlertDialog com "Continuar mesmo assim" — genuinamente não-bloqueante. 12 testes verdes cobrindo os 7 comportamentos. |
| 3 | O colaborador consegue duplicar um sistema composto (trilho + módulos + driver + conectores) para outro ambiente; o clone aparece com novos UUIDs e os valores somam corretamente no Step 3 | VERIFIED | `clonarItemLuminaria` (orcamento.ts:634) gera UUID novo na raiz e em cada `composicao[i]`. Threading completo: botão Duplicar em ComposicaoCard (`onDuplicate`) → AmbienteCard (`onDuplicarComposto`, linha 539) → Step2Ambientes `iniciarDuplicacaoComposto` → Dialog com Select de ambiente destino → `inserirCompostoEm` (chaveado por `ambiente.id`, linha 123). Singleton: `ambientes.length === 1` insere direto sem dialog (linha 143). Step 3 agrega por código (não id), então clone soma corretamente. Checkpoint humano aprovado pelo usuário. |

**Score:** 3/3 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260616000001_sistema_s_mode_system_mold.sql` | Migration s_mode 12 perfis + 15 difusos | VERIFIED | Arquivo existe. Contém `SET sistema = 's_mode'` com filtros `PERFIL NOFRAME MODULAR`, `PERFIL DE EMBUTIR MODULAR`, `tipo_produto = 'acessorio'` + `DIFUSO`. `IS DISTINCT FROM 's_mode'` em todos os UPDATEs (idempotente). Aplicado ao DB via REST PATCH API com service_role. |
| `src/types/orcamento.ts` | calcularMetragemModulosDifusos, parsearComprimentoModulo, clonarItemLuminaria, papel 'fita_modular' | VERIFIED | Linha 51: `fita_modular` no union de papel. Linha 192: `export function calcularMetragemModulosDifusos`. Linha 201: `export function parsearComprimentoModulo`. Linha 634: `export function clonarItemLuminaria`. Linha 648: `luminarias: amb.luminarias.map(clonarItemLuminaria)` (fix deep-clone). |
| `src/hooks/useProdutoSearch.ts` | filtro 'modulo_difuso' | VERIFIED | Linha 5: `'modulo_difuso'` no type union `ProdutoFiltro`. Linha 32: branch com `.eq('tipo_produto', 'acessorio').eq('sistema', 's_mode')`. Não reusa `filtroSistema` (correção Pitfall 1). |
| `src/types/orcamento.test.ts` | testes unitários dos novos helpers | VERIFIED | 58 testes verdes incluindo `calcularMetragemModulosDifusos`, `parsearComprimentoModulo`, `clonarItemLuminaria`, e regressão de `clonarAmbiente`. |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/ComposicaoCard.tsx` | painel modular (difusos + fita derivada + driver advisory) + botão duplicar | VERIFIED | `isModular = item.sistema === "s_mode"` (linha 74). Badge MODULAR (linha 688). Busca difusos com `filtro="modulo_difuso"` (linha 830). Painel fita derivada com metragem Σ (linha 854). "Adicionar fita" com `filtro="fita"` (linha 921). `handleAdicionarFitaModular` cria `ItemComposicao` papel `'fita_modular'` com comprimento pré-preenchido (linha 317). Driver advisory via `buscarDriverModular` + `sugestao24v` state + botão Aplicar (linha 335-371, 649). Botão Duplicar com `title="Duplicar"` renderizado quando `onDuplicate` presente (linha 706). `driverReqId useRef(0)` como race-condition guard (linha 98). |
| `src/components/AmbienteCard.tsx` | rota 'modular' que inicia composicao: [] | VERIFIED | Linha 421: `if (tipo === 'modular')` com `sistema: 's_mode'` e `composicao: []` (linha 428,431). `onDuplicarComposto?` em props (linha 23). Threading via `onDuplicate={onDuplicarComposto ? () => onDuplicarComposto(item) : undefined}` (linha 539). |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/Step2Ambientes.tsx` | 3 novos AdvisoryItem de composto + orquestração duplicação | VERIFIED | Linha 32: union com `'composto-sem-driver' \| 'composto-sem-conector' \| 'modular-sem-fita'`. Linha 38: `export function detectarAvisosComposto`. Linha 81-83: ADVISORY_LABELS para os 3 tipos. `dupState`, `iniciarDuplicacaoComposto`, `inserirCompostoEm` (linhas 91,122,141). Dialog com `DialogDescription` a11y (linha 281). |
| `src/components/__tests__/advisory-compostos.test.ts` | testes das 3 condições D-03 | VERIFIED | Arquivo em `src/components/__tests__/advisory-compostos.test.ts`. Cobre `composto-sem-driver` (3 casos), `composto-sem-conector` (2 casos), `modular-sem-fita` (4 casos), e luminaria sem composicao. 12 testes, todos verdes. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useProdutoSearch filtro='modulo_difuso'` | `product_variants.sistema='s_mode' + tipo_produto='acessorio'` | `.eq` query | VERIFIED | Linha 37-38: `.eq('tipo_produto', 'acessorio').eq('sistema', 's_mode')` — correto, não usa NULL NOT IN |
| `detectarTipoAncora` | `produto.sistema_magnetico === 's_mode'` → `'modular'` | alias sistema_magnetico | VERIFIED | orcamento.ts:177: `if (produto.sistema_magnetico === 's_mode') return 'modular'` |
| `AmbienteCard.handleSelectProdutoGlobal rota 'modular'` | ItemLuminaria com `sistema:'s_mode'` + `composicao:[]` | onChange | VERIFIED | AmbienteCard.tsx:421-432: bloco `if (tipo === 'modular')` cria ItemLuminaria correto |
| `ComposicaoCard 'Adicionar fita'` | ItemComposicao `papel='fita_modular'` com `comprimento=metragem` | ProdutoAutocomplete filtro='fita' | VERIFIED | ComposicaoCard.tsx:907-921: botão ativo quando `metragemDerivada > 0`; handleAdicionarFitaModular (linha 308-326) cria ItemComposicao com papel correto e comprimento pré-preenchido |
| `ComposicaoCard add difuso` | ItemComposicao `papel='modulo'` com comprimento snapshot | parsearComprimentoModulo | VERIFIED | ComposicaoCard.tsx:286-299: `comprimento = isModular ? parsearComprimentoModulo(produto.descricao) : undefined` gravado no ItemComposicao |
| `Step2Ambientes.handleNext loop de compostos` | `itensIncompletos` com 3 novos tipos | detectarAvisosComposto | VERIFIED | Step2Ambientes.tsx:221: `itensIncompletos.push(...detectarAvisosComposto(amb))` |
| `ComposicaoCard botão Duplicar (onDuplicate)` | Step2Ambientes seletor de destino + clonarItemLuminaria | AmbienteCard onDuplicarComposto | VERIFIED | Threading completo verificado: ComposicaoCard linha 706-712 → AmbienteCard linha 539 → Step2Ambientes linha 141-147 → inserirCompostoEm linha 122-135 usa `clonarItemLuminaria` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ComposicaoCard.tsx` | `metragemDerivada` | `calcularMetragemModulosDifusos(item.composicao)` — pura, soma comprimento×qtd dos módulos | Sim — derivada de dados reais de composicao[] | FLOWING |
| `ComposicaoCard.tsx` | `fitaModular` | `composicao.find(c => c.papel === "fita_modular")` | Sim — lê da composicao do item | FLOWING |
| `ComposicaoCard.tsx` | `sugestao24v` (driver advisory) | Query Supabase em `buscarDriverModular` via `driverReqId` ref guard | Sim — query real ao DB de drivers; retorna null quando `wm=0` (limitação de dados documentada) | FLOWING |
| `Step2Ambientes.tsx` | `itensIncompletos` | `detectarAvisosComposto(amb)` sobre `amb.luminarias` com `composicao` real | Sim — lê dados reais do estado do orçamento | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| calcularMetragemModulosDifusos calcula corretamente | `npm run test -- --run` (196 testes, inclui orcamento.test.ts) | 196/196 pass | PASS |
| detectarAvisosComposto cobre 3 condições D-03 | `advisory-compostos.test.ts` (12 testes) | 12/12 pass | PASS |
| clonarItemLuminaria gera UUIDs novos em toda a árvore | testes em orcamento.test.ts + clonagem.test.ts | Pass | PASS |
| parsearComprimentoModulo parseia formatos MM e MT | 9 test cases em orcamento.test.ts | Pass | PASS |
| driverReqId ref guard cancela busca obsoleta | grep confirma `reqId !== driverReqId.current` (linha 350) e `setBuscando24v(false)` no finally (linha 371) | Presente e correto | PASS |
| inserirCompostoEm chaveado por ambiente.id | grep confirma `ambientes.find(a => a.id === destinoId)` (linha 123) | Presente e correto | PASS |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SIST-03 | 21-01, 21-02 | Colaborador monta sistema SYSTEM MOLD com fita derivada de Σ(comprimento × qtd) | SATISFIED | Migration s_mode aplicada; detectarTipoAncora retorna 'modular'; ComposicaoCard ramo isModular completo; parsearComprimentoModulo + calcularMetragemModulosDifusos exportados e testados |
| VAL-01 | 21-03 | Advisory não-bloqueante ao avançar Step 2→3 com sistema composto incompleto | SATISFIED | detectarAvisosComposto() com 3 condições integrada no handleNext; AlertDialog genuinamente não-bloqueante; 12 testes verdes |
| DUP-01 | 21-01, 21-02, 21-03 | Duplicar sistema composto para outro ambiente com novos UUIDs em toda a árvore | SATISFIED | clonarItemLuminaria (orcamento.ts:634) deep-clona composicao[]; threading completo ComposicaoCard → AmbienteCard → Step2Ambientes → Dialog → inserirCompostoEm; chaveado por ambiente.id; checkpoint humano aprovado |

**Orphaned requirements check:** REQUIREMENTS.md mapeia SIST-03, VAL-01 e DUP-01 para Phase 21 (traceability table, linhas 86-88). Nenhum ID orphaned — todos cobertos pelos planos.

---

## Anti-Patterns Found

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| `ComposicaoCard.tsx:126,143,166` | `let cancelled = false` (24V useEffect) — padrão funcional para o useEffect, mas deixado ao lado do novo `driverReqId` ref | Info | Não-bloqueante — cancelled funciona no useEffect (cleanup React wired); driverReqId substitui apenas buscarDriverModular. Convivência esperada. |
| `useProdutoSearch.ts:61,75` | Interpolação de `query` em PostgREST `.or()` | Info (pré-existente) | Identificado no code review como IN-03, pré-existente, low-risk, view read-only. Não introduzido na Phase 21. |
| `parsearComprimentoModulo` | Regex ancorada em "FITA LED" — pode falhar se catálogo drift | Info (IN-02) | Documentado no code review. Os 15 difusos atuais passam. Tech debt para quando catálogo expandir. |
| `migration 20260616000001` | Sem rollback section e sem verificação de contagem em runtime | Info (IN-04) | Idempotente via IS DISTINCT FROM. Contagens verificadas manualmente após aplicação (12+15 confirmados). Rollback documentado no RESEARCH.md. |

Nenhum anti-pattern bloqueante. WR-01/02/03 do code review foram corrigidos em `3ba38f7` e `609f216` antes do checkpoint humano.

---

## Human Verification Required

Nenhum item pendente. Checkpoint humano (Plan 03 Task 3) foi aprovado pelo usuário durante a execução da fase, cobrindo:
- SYSTEM MOLD abre card modular com badge MODULAR
- Metragem 0,264 m derivada corretamente de módulo difuso 264MM
- "Adicionar fita" pré-preenche metragem
- Advisory não-bloqueante ao avançar sem fita (sistema pode continuar)
- Duplicação clona com novos UUIDs; Step 3 soma 2× corretamente
- 0 erros de console (incluindo a11y DialogDescription fix)

---

## Deferred Items

Nenhum item desta fase foi identificado como pendente. O único item potencialmente deferido seria PDF de sistemas compostos (PDF-03), mas esse requisito pertence à Phase 22 e nunca fez parte do escopo da Phase 21.

---

## Gaps Summary

Nenhum gap identificado. Todos os 3 roadmap success criteria verificados contra o codebase real:

1. **SIST-03 (SYSTEM MOLD montável):** fundação técnica (migration, helpers, filtro) + UI completa (rota modular, ComposicaoCard com difusos/metragem/fita/driver advisory) implementados e testados.
2. **VAL-01 (advisory não-bloqueante):** função pura `detectarAvisosComposto` com 3 condições D-03 integrada no handleNext; 12 testes unitários verdes; fix de code review (WR-03 id-based destination) aplicado.
3. **DUP-01 (duplicação com novos UUIDs):** `clonarItemLuminaria` deep-clone + threading completo + Dialog de seleção + fix de code review (WR-01/02 request-id guard, WR-03 id-based) + a11y fix — todos aplicados antes do checkpoint humano.

196 testes verdes. Build verde. Checkpoint humano aprovado. Phase 21 goal achieved.

---

_Verified: 2026-06-16T14:10:00Z_
_Verifier: Claude (gsd-verifier)_
