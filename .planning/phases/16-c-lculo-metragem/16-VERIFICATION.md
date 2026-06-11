---
phase: 16-c-lculo-metragem
verified: 2026-06-11T14:40:00Z
status: human_needed
score: 5/5 must-haves verified (3 com aviso)
overrides_applied: 0
human_verification:
  - test: "Gate CALC-01: criar sistema com fita sem perfil, deixar metragem em branco, clicar Próximo"
    expected: "Toast de erro com a copy 'Informe uma metragem válida para este sistema antes de continuar.' aparece, wizard NÃO avança para Step 3"
    why_human: "Comportamento de bloqueio UI depende de renderização real do componente Step2Ambientes e do toast Sonner"
  - test: "Sufixo CALC-02: adicionar perfil em um sistema, informar comprimento 2m e quantidade 2, observar o campo Descrição"
    expected: "Descrição exibe automaticamente 'PERFIL X — 4m'; ao alterar comprimento para 3m, muda para '— 6m' sem duplicar o sufixo"
    why_human: "Aparência do sufixo no Input readOnly e atualização reativa ao mudar comprimento/quantidade requer observação visual"
  - test: "Select de passadas CALC-03: selecionar perfil de família com regra (ex: light_nano_30 que tem passadas_padrao=2 no banco)"
    expected: "Select de passadas oferece apenas [1, 2] — opção 3 não aparece"
    why_human: "Restrição por família depende do valor retornado pelo banco (produto.passadas) via useProdutoSearch; não verificável sem servidor rodando"
  - test: "WR-01 (aviso code review): selecionar perfil de família SEM regra cadastrada (light_30, light_12 ou light_15)"
    expected: "COMPORTAMENTO ATUAL: Select de passadas mostra apenas [1] (restrito inadvertidamente). COMPORTAMENTO DESEJADO: deveria mostrar [1,2,3] pois a família não tem restrição. Confirmar qual comportamento aparece para decidir se WR-01 precisa ser corrigido antes de fechar a fase."
    why_human: "WR-01 (code review warning): write-path usa produto.passadas ?? base.passadas; para famílias sem regra no banco, produto.passadas chega null e fallback cai em base.passadas=1 em vez de 3. Precisa de confirmação visual com produto real dessas famílias."
---

# Phase 16: Cálculo & Metragem — Verification Report

**Phase Goal:** Nenhum item de fita ou perfil some silenciosamente do orçamento com R$0 — a metragem é sempre exigida, refletida na descrição e calculada corretamente respeitando as regras de passadas por família de perfil
**Verified:** 2026-06-11T14:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria do Roadmap)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Sistema com fita sem perfil não avança do Step 2 → Step 3 se metragemManual for null ou 0 — colaborador vê aviso e é impedido | VERIFIED | `handleNext` em `Step2Ambientes.tsx` L62-66: bloqueia com `toast.error("Informe uma metragem válida para este sistema antes de continuar.")` + `return`. Testes Step2Gate: 12/12 passando cobrindo null/0/rascunho antigo. |
| SC-2 | Ao inserir perfil e informar comprimento, a metragem aparece automaticamente na descrição (ex.: "PERFIL X — 2,5m") | VERIFIED | `aplicarSufixoMetragem` chamado em 3 sites: seleção de perfil (L209), onChange comprimento (L509), onChange quantidade (L521). Helper exportado em `orcamento.ts` L133-140, regex de strip `/ — \d+(,\d+)?m$/` com em-dash U+2014. Testes sufixoMetragem: 10/10. |
| SC-3 | Campo de passadas é editável — colaborador pode aumentar ou reduzir dentro do limite da família | VERIFIED (com aviso WR-01) | `<Select>` em AmbienteCard.tsx L525-535, filtro `[1,2,3].filter(n => n <= (sis.perfil!.passadasPadrao ?? 3))`. Funciona corretamente para famílias com regra cadastrada. Aviso: para famílias sem regra (light_30, light_12, light_15), write-path usa `produto.passadas ?? base.passadas` (L203) que retorna `1` em vez de `3` — Select fica restrito a [1]. Ver WR-01 abaixo. |
| SC-4 | Perfil light_50 aceita até 3 passadas; sugestão automática reflete passadas_padrao=3 (migration aplicada) | VERIFIED (com ressalva de dados) | Migration `20260611000001_sync_passadas_padrao.sql` existe, é idempotente (IS DISTINCT FROM), foi aplicada via service role. Read-path fallback `?? 3` garante que snapshots antigos sem passadasPadrao mostrem [1,2,3]. Ressalva documentada: light_50 não existe em prod (zero linhas no catálogo) — verificação específica da SC não é realizável com dados reais. Aceito pelo Lenny em 16-01-SUMMARY. |
| SC-5 | Orçamentos antigos com metragemManual: null e perfil: null abrem normalmente, recebem aviso de validação, sem crash e sem fix silencioso | VERIFIED | `passadasPadrao?: 1 \| 2 \| 3` é campo opcional no interface ItemPerfil (backwards-compat). Fallback `?? 3` no JSX (L532). Testes Step2Gate: caso rascunho antigo (metragemManual null, perfil null, fita preenchida) detectado como inválido sem crash. |

**Score:** 5/5 truths verificadas (3 com avisos documentados)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260611000001_sync_passadas_padrao.sql` | Migration idempotente de sync passadas_padrao | VERIFIED | Existe, contém UPDATE...FROM regras_compatibilidade_perfil, IS DISTINCT FROM, BEGIN/COMMIT. Sem ALTER TABLE, DROP, ou CREATE VIEW. |
| `src/types/orcamento.ts` | passadasPadrao?: 1\|2\|3 no ItemPerfil + helper aplicarSufixoMetragem exportado | VERIFIED | L52: `passadasPadrao?: 1 \| 2 \| 3;`. L133: `export function aplicarSufixoMetragem(...)`. calcularDemandaFita mantém `\|\| 0` (L152). |
| `src/components/Step2Ambientes.tsx` | Gate CALC-01 no handleNext | VERIFIED | L34-82: gate completo. Bloqueio antes de remoção de vazios. Copy literal D-05 presente. onChange(ambientesLimpos) para sistemas vazios. |
| `src/components/AmbienteCard.tsx` | Sufixo em 3 sites + Select passadas + badge inline | VERIFIED | aplicarSufixoMetragem em L209, L509, L521. passadasPadrao setado em L214. Select filtrado em L532. Badge inline "Metragem obrigatória" em L421. |
| `src/types/__tests__/sufixoMetragem.test.ts` | Cobertura CALC-02 (10 casos) | VERIFIED | Existe, importa de @/types/orcamento, 10/10 passing. Cobre inteiro, fracionário pt-BR, idempotência, preservação de texto, travessão U+2014. |
| `src/components/__tests__/Step2Gate.test.ts` | Cobertura CALC-01 (12 casos) | VERIFIED | Existe, 12/12 passing. Cobre null≡0 (D-03), válido, perfil-presente, vazio (D-06), rascunho antigo (D-04). |
| `src/components/__tests__/AmbienteCardPassadas.test.tsx` | Cobertura CALC-03 (8 casos) | VERIFIED | Existe, 8/8 passing. Cobre passadasPadrao=3/2/1/undefined, invariantes. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Step2Ambientes.tsx handleNext | onNext() (setStep(3)) | guard que retorna antes de onNext quando metragemInvalida | WIRED | L62-66: `if (sistemasInvalidos.length > 0) { toast.error(...); return; }`. onNext() na L82 só alcançado se sem inválidos. |
| AmbienteCard.tsx (3 onChange/select) | sis.perfil.descricao | aplicarSufixoMetragem(descricao, comprimento, quantidade) | WIRED | Chamadas em L209 (seleção perfil), L509 (comprimento), L521 (quantidade). Cada uma regenera descricao via helper. |
| AmbienteCard.tsx Select passadas | sis.perfil.passadasPadrao | [1,2,3].filter(n => n <= passadasPadrao ?? 3) | WIRED (com aviso) | L532: filtro implementado. Leitura correta. Write-path (L203) tem inconsistência WR-01 para famílias sem regra. |
| product_variants.passadas_padrao | regras_compatibilidade_perfil.passadas_padrao | UPDATE...FROM...WHERE familia_perfil match | WIRED (no-op) | Migration aplicada; UPDATE foi no-op porque prod já estava sincronizado. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| AmbienteCard.tsx Select passadas | `sis.perfil!.passadasPadrao` | `produto.passadas` via `useProdutoSearch` (query ao banco) + gravado em L214 | Sim, para famílias com regra; `null` para famílias sem regra (WR-01) | FLOWING (com aviso WR-01) |
| AmbienteCard.tsx descricao do perfil | `sis.perfil.descricao` | `aplicarSufixoMetragem(produto.descricao, comprimentoPeca, quantidade)` | Sim — concatena texto real do produto com metragem calculada | FLOWING |
| Step2Ambientes.tsx gate | `sistemasInvalidos[]` | Loop sobre `ambientes` (React state) | Sim — estado real do wizard | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `aplicarSufixoMetragem` exportado de orcamento.ts | `npm run test -- --run sufixoMetragem` | 10/10 passed | PASS |
| Gate Step2 bloqueia null/0 | `npm run test -- --run Step2Gate` | 12/12 passed | PASS |
| Range passadas por família | `npm run test -- --run AmbienteCardPassadas` | 8/8 passed | PASS |
| Suíte completa sem regressão | `npm run test -- --run` | 90/90 passed, exit 0 | PASS |
| Build Vite sem erros | `npm run build` | built in 38.65s, exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CALC-01 | 16-02-PLAN (Task 2), 16-03-PLAN (Task 2) | Fita sem perfil exige metragem manual; bloqueia avanço com 0m silencioso | SATISFIED | Gate em handleNext, testes Step2Gate 12/12 |
| CALC-02 | 16-02-PLAN (Task 3), 16-03-PLAN (Task 1) | Metragem do perfil aparece automaticamente na descrição | SATISFIED | aplicarSufixoMetragem em 3 sites, testes sufixoMetragem 10/10 |
| CALC-03 | 16-01-PLAN, 16-02-PLAN (Task 3), 16-03-PLAN (Task 3) | Passadas editável, restrita por família; sync migration passadas_padrao | SATISFIED (com aviso WR-01) | Migration aplicada, Select filtrado por passadasPadrao, fallback ?? 3. WR-01: famílias sem regra ficam restritas a [1] inadvertidamente. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/AmbienteCard.tsx` | 203 | `passadasAuto = (produto.passadas ?? base.passadas)` — fallback em base.passadas=1 para famílias sem regra | WARNING (WR-01) | Para famílias `light_30` (96 itens), `light_12` (61 itens) e `light_15` (3 itens) que não têm entrada em `regras_compatibilidade_perfil`, `produto.passadas` chega null do banco; o fallback resolve para `base.passadas = 1`, restringindo inadvertidamente o Select de passadas a `[1]` em vez do `[1,2,3]` esperado para famílias sem restrição documentada. Correção: `produto.passadas ?? 3` (alinha com o read-path fallback). |

**Nota:** Nenhum TODO/FIXME/placeholder encontrado nos arquivos modificados. Nenhum `return null` ou `return []` sem data source. O `|| 0` em `calcularDemandaFita` (L152) é intencional e correto — o gate impede que chegue ao cálculo com metragem 0.

### Human Verification Required

#### 1. Gate CALC-01 — Toast de bloqueio

**Test:** No wizard (Step 2), adicionar um sistema com fita selecionada, sem perfil, deixar o campo de metragem em branco ou com 0. Clicar no botão "Próximo".
**Expected:** Toast de erro aparece com a mensagem "Informe uma metragem válida para este sistema antes de continuar." seguida do nome do ambiente e número do sistema. O wizard NÃO avança para o Step 3.
**Why human:** O comportamento de bloqueio depende da renderização real de Step2Ambientes + Sonner toast. Os testes cobrem os predicados puros mas não o componente montado.

#### 2. Sufixo CALC-02 — Aparece automaticamente na descrição

**Test:** No wizard (Step 2), adicionar um sistema, selecionar um perfil qualquer. Observar o campo Descrição. Alterar o comprimento de 1m para 2m e a quantidade para 2.
**Expected:** Imediatamente após selecionar o perfil, a descrição exibe "NOME DO PERFIL — Xm". Ao alterar comprimento para 2m e quantidade para 2, muda para "NOME DO PERFIL — 4m" sem duplicar o sufixo (não "NOME DO PERFIL — 2m — 4m").
**Why human:** A atualização reativa do campo readOnly de descrição em resposta a onChange requer observação visual no browser.

#### 3. Select de passadas CALC-03 — Restrição por família

**Test:** Selecionar um perfil de uma família com regra cadastrada (ex: light_nano_30, que tem passadas_padrao=2 no banco). Observar o Select de passadas.
**Expected:** Select mostra apenas as opções [1, 2]. A opção 3 não aparece no dropdown.
**Why human:** Requer servidor rodando e produto real para que `useProdutoSearch` retorne `produto.passadas` com valor não-null do banco.

#### 4. WR-01 — Famílias sem regra (light_30, light_12, light_15)

**Test:** Selecionar um perfil da família `light_30` (ex: qualquer perfil com 96 itens dessa família). Observar o Select de passadas.
**Expected (DESEJADO):** Select deveria mostrar [1, 2, 3] pois light_30 não tem restrição cadastrada.
**Comportamento atual provável:** Select mostra apenas [1] porque write-path (L203) usa `produto.passadas ?? base.passadas` — para famílias sem regra, `produto.passadas` é null e fallback é `base.passadas = 1`.
**Why human:** Precisa confirmação visual para decidir se WR-01 deve ser corrigido antes de fechar a fase ou pode aguardar.

### Gaps Summary

Nenhum gap bloqueador. Os 5 critérios de sucesso do roadmap estão verificados no código.

**Aviso WR-01 (não-bloqueador):** O write-path de `passadasPadrao` usa `produto.passadas ?? base.passadas` em vez de `produto.passadas ?? 3`. Para as 160 linhas de produto nas famílias `light_30`, `light_12` e `light_15` (que não têm entrada em `regras_compatibilidade_perfil`), o Select de passadas fica restrito a `[1]` ao selecionar esses perfis, em vez de mostrar `[1,2,3]`. Isso não causa R$0 silencioso (o objetivo principal da fase) mas limita inadvertidamente a usabilidade para essas famílias. A correção é uma linha: `produto.passadas ?? 3` na L203 de AmbienteCard.tsx.

A 4ª human_verification acima serve como gate: se o Lenny confirmar que o comportamento de light_30 com [1] é problemático, WR-01 deve ser corrigido. Se for aceitável por ora, a fase pode ser fechada.

---

_Verified: 2026-06-11T14:40:00Z_
_Verifier: Claude (gsd-verifier)_
