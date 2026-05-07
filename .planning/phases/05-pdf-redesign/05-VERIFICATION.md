---
phase: 05-pdf-redesign
verified: 2026-05-07T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 5: PDF Redesign — Verification Report

**Phase Goal:** PDF do orçamento reconstruído com layout tipográfico profissional, sem as 4 caixas atuais e com texto final formatado — sem quebrar snapshots antigos.

**Verified:** 2026-05-07
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PDF gerado tem layout tipográfico limpo (tipografia, margens, hierarquia visual) — não parece screenshot de HTML | VERIFIED | `src/lib/pdfTemplates/v2.ts` (430 linhas) implementa hierarquia 5-níveis (`.doc-title` Playfair 32px, `.amb-name` Inter 11px tracking 0.3em laranja, `.local-name` Playfair italic 18px, `.system-label` Inter 9px tracking 0.18em, `.item-row` + `.chip` + `.code-tag`); fontes via `@fontsource/inter@5.2.8` + `@fontsource/playfair-display@5.2.8`; `ensureFontsReady()` chamado nos 2 call sites pre-rasterização. UAT visual via Playwright MCP confirmou Playfair+amb-name+doc-title+5× orange visíveis no PDF gerado. |
| 2 | As 4 caixas abaixo do Total geral (Prazo / Garantia / Pagamento / Observações) foram removidas | VERIFIED | `grep info-grid` em `src/lib/pdfTemplates/v2.ts` retorna 0 ocorrências (4 caixas REMOVIDAS, não escondidas). UAT Playwright confirmou ausência de info-grid no PDF gerado com `pdf_template_version=2`. |
| 3 | Conteúdo dessas caixas reaparece como texto formatado ao final do PDF (parágrafos/lista legível) | VERIFIED | `function blocoTermos()` em `v2.ts` emite `<section class="terms-section">` com título "Termos e Condições" (Playfair 24px) + 4 `<h3 class="term-header">` (Prazo de entrega, Garantia, Condições de pagamento, Observações) em Playfair small-caps laranja + parágrafos `<p>` em Inter 11px line-height 1.65. Conteúdo das 4 caixas preservado integralmente em prose. |
| 4 | Card "TOTAL GERAL" revisto visualmente e consistente com o novo design | VERIFIED | `function blocoTotal()` emite `.total-card` com `.total-accent` (faixa laranja `#E68601` 4px à esquerda) + `.total-label` ("TOTAL GERAL" Inter 9px tracking 0.3em uppercase cinza) + `.total-value` (Playfair 36px valor formatado via `formatarMoeda`). Fundo branco com hairline `border-bottom: 1px solid #e8ecf0`. PDF-02 atendido com redesenho completo, não eliminação. |
| 5 | Orçamento antigo (snapshot já persistido) continua renderizando sem crash | VERIFIED | Router `src/lib/gerarPdfHtml.ts` despacha v1/v2 baseado em `params.templateVersion`; `OrcamentoDetalhe.tsx:183` faz `templateVersion: orc.pdf_template_version ?? 1` (coerção para v1 quando NULL). Migration `20260507180000_backfill_pdf_template_version_legacy.sql` executa `UPDATE ... SET pdf_template_version = NULL WHERE created_at < '2026-05-07'` + `DROP DEFAULT` (corrigindo bug encontrado durante UAT — `ADD COLUMN ... DEFAULT 2` preenchera rows existentes com 2). Template `v1.ts` (409 linhas) preserva byte-a-byte o template legacy com Outfit + info-grid + Google Fonts CDN + dark total. UAT Playwright validou snapshot real `f39ca4b4` (created 2026-04-27) renderizando como v1 sem crash. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260507000001_add_pdf_template_version.sql` | Migration aditiva ADD COLUMN | VERIFIED | Existe com `ALTER TABLE public.orcamentos ADD COLUMN pdf_template_version integer DEFAULT 2` + `COMMENT ON COLUMN` + DO block sanity check |
| `supabase/migrations/20260507180000_backfill_pdf_template_version_legacy.sql` | Backfill NULL para legacy + DROP DEFAULT | VERIFIED | Existe com `UPDATE public.orcamentos SET pdf_template_version = NULL WHERE created_at < '2026-05-07'` + `ALTER TABLE ... DROP DEFAULT`. Fix do bug detectado durante UAT. |
| `src/integrations/supabase/types.ts` | Tipo Row/Insert/Update inclui `pdf_template_version` | VERIFIED | 3 ocorrências (linhas 331/347/363) com tipo `number \| null` (Row) e opcional em Insert/Update |
| `src/types/orcamento.ts` | `SistemaIluminacao.local?: string \| null` | VERIFIED | Linha 86: `local?: string | null;` com JSDoc |
| `src/components/AmbienteCard.tsx` | Input "Local (opcional)" + `local: null` no addSistema | VERIFIED | Linha 65 inicializa `local: null`; linhas 361–375 implementam input com placeholder "Sanca, Rasgo, Pé-direito..." + Badge "Opcional" + maxLength 40 |
| `src/lib/pdfFonts.ts` | `ensureFontsReady()` com 8 imports @fontsource | VERIFIED | 8 imports CSS (Inter 300/400/500/600/700 + Playfair 400/500/400-italic); `ensureFontsReady` força `document.fonts.load()` para 5 pesos críticos (post-WR-02 fix) ANTES de `await document.fonts.ready` |
| `src/lib/pdfImages.ts` | `inlineImagensSnapshot()` com fetch+FileReader em paralelo | VERIFIED | `urlToBase64` usa `fetch` + `FileReader.readAsDataURL` com `onload` (não `onloadend` — post-WR-01 fix); `inlineImagensSnapshot` deduplica URLs via Map + `Promise.all` paralelo + deep-clone imutável |
| `src/lib/pdfTemplates/v2.ts` | Template editorial 430 linhas com 5-níveis | VERIFIED | 430 linhas, exporta `gerarOrcamentoHtmlV2` + `PdfParamsV2`; CSS contém todas as classes de hierarquia (`.amb-header`, `.amb-name`, `.amb-rule`, `.local-name`, `.system-label`, `.chip`, `.code-tag`, `.thumb`, `.total-card`, `.total-accent`, `.total-value`, `.terms-section`, `.term-header`); `agruparPorLocal()` lida com `local` null/undefined/"" via pseudo-grupo "Geral" |
| `src/lib/pdfTemplates/v1.ts` | Template legacy preservado byte-a-byte | VERIFIED | 409 linhas, exporta `gerarOrcamentoHtmlV1` + `PdfParamsV1`; preserva Outfit + info-grid + Google Fonts CDN + dark total (compat retroativa PDF-05) |
| `src/lib/gerarPdfHtml.ts` | Router enxuto v1/v2 baseado em `templateVersion` | VERIFIED | 45 linhas; `gerarOrcamentoHtml(params)` faz `params.templateVersion ?? 2`, despacha `>=2` → V2, `<2` → V1; assinatura pública preservada (Step3 + OrcamentoDetalhe não quebraram) |
| `src/components/Step3Revisao.tsx` | Persiste `pdf_template_version: 2` + chama helpers + templateVersion=2 | VERIFIED | Linha 209 (UPDATE) e linha 225 (INSERT) gravam `pdf_template_version: 2`; linhas 260–267 dynamic-import + Promise.all paralelo (persistir + logo + inlineImagensSnapshot); linha 267 `ensureFontsReady`; linha 276 `templateVersion: 2`; linha 299 `pagebreak: { mode: ["css", "legacy"] }` (Pitfall 3 fix) |
| `src/pages/OrcamentoDetalhe.tsx` | Lê `pdf_template_version` do row + passa para router | VERIFIED | Linha 39 tipo `OrcamentoFull` inclui `pdf_template_version: number \| null`; linha 108 SELECT inclui `pdf_template_version`; linhas 169–172 helpers loaded; linha 183 `templateVersion: orc.pdf_template_version ?? 1` (coerção legacy); linha 206 pagebreak fixed |
| `package.json` | `@fontsource/inter@5.2.8` + `@fontsource/playfair-display@5.2.8` | VERIFIED | Linhas 16–17 confirmam ambas deps fixadas em 5.2.8 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `gerarPdfHtml.ts` (router) | `pdfTemplates/v1.ts` | `import { gerarOrcamentoHtmlV1 }` | WIRED | Linha 21 importa, linha 43 chama no branch `v < 2` |
| `gerarPdfHtml.ts` (router) | `pdfTemplates/v2.ts` | `import { gerarOrcamentoHtmlV2 }` | WIRED | Linha 22 importa, linha 41 chama no branch `v >= 2` |
| `Step3Revisao.tsx` | Supabase `orcamentos.pdf_template_version` | `.insert/.update({ pdf_template_version: 2 })` | WIRED | 2 ocorrências (linhas 209, 225) — INSERT e UPDATE persistem versão |
| `Step3Revisao.tsx` | `gerarOrcamentoHtml` | `templateVersion: 2` | WIRED | Linha 276 passa explicitamente `templateVersion: 2` |
| `Step3Revisao.tsx` | `pdfFonts.ensureFontsReady` | dynamic import + await | WIRED | Linha 260 dynamic import, linha 267 `await ensureFontsReady()` |
| `Step3Revisao.tsx` | `pdfImages.inlineImagensSnapshot` | dynamic import + Promise.all | WIRED | Linha 261 dynamic import, linha 265 chamada em Promise.all |
| `OrcamentoDetalhe.tsx` | `orcamento.pdf_template_version` (do SELECT) | `templateVersion: orc.pdf_template_version ?? 1` | WIRED | Linha 108 select inclui campo, linha 183 coerção legacy |
| `OrcamentoDetalhe.tsx` | `pdfFonts.ensureFontsReady` + `pdfImages.inlineImagensSnapshot` | dynamic import + await | WIRED | Linhas 169–172 |
| `AmbienteCard.tsx` (input Local) | `SistemaIluminacao.local` | `updateSistema(si, { ...sis, local: e.target.value \|\| null })` | WIRED | Linha 372 onChange normaliza string vazia para null |
| Migration `20260507000001` | `public.orcamentos` | `ALTER TABLE ... ADD COLUMN` | WIRED | Confirmado pela UAT ter rodado em prod (snapshot real `f39ca4b4` retornou `pdf_template_version` no SELECT) |
| Migration `20260507180000` | `public.orcamentos` | `UPDATE ... NULL + DROP DEFAULT` | WIRED | Backfill rodou em prod durante UAT — snapshot legacy `f39ca4b4` retorna NULL → coalesce 1 → v1 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `Step3Revisao.tsx` (PDF baixado) | `ambientes` (state) → `ambientesInline` (base64) → HTML | Wizard state populated by usuário em Step1+Step2 | Yes — UAT confirmou PDF gera com dados reais | FLOWING |
| `OrcamentoDetalhe.tsx` (Re-emitir) | `orc.ambientes` (Supabase row) → `ambientesInline` → HTML | `supabase.from("orcamentos").select(...)` linha 105–116 | Yes — UAT validou snapshot real `f39ca4b4` rendendo PDF | FLOWING |
| `gerarOrcamentoHtmlV2` (template) | `params.ambientes` (Ambiente[]) → builders + chips + thumbs | Recebido do call site (Step3 ou OrcamentoDetalhe) | Yes — função pura input → string HTML, validada por inspeção e UAT | FLOWING |
| Migration `pdf_template_version` | Coluna `int` na tabela `orcamentos` | DDL aplicada em prod (project `jkewlaezvrbuicmncqbj`) | Yes — UAT mostrou row `f39ca4b4` com NULL e row patcheada com 2 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command/Method | Result | Status |
|----------|----------------|--------|--------|
| Build limpo | `npm run build` (registrado no SUMMARY 05-05) | exit 0, 3463 modules, pdfFonts + pdfImages aparecem como chunks separados | PASS |
| Router v1 com templateVersion ausente em params (default branch) | Inspeção código `gerarPdfHtml.ts` linha 39 | `params.templateVersion ?? 2` → `>= 2` → v2 (default seguro) | PASS |
| Router v1 com templateVersion=1 ou row legacy | Inspeção `OrcamentoDetalhe.tsx:183` + UAT | `orc.pdf_template_version ?? 1` → router recebe 1 → v1 | PASS |
| Snapshot real legacy renderiza v1 sem crash | UAT Playwright MCP em row `f39ca4b4` | PDF baixou com Outfit + info-grid + Google Fonts + dark total | PASS |
| Orçamento novo (Phase 5+) renderiza v2 | UAT Playwright MCP via PATCH simulando `pdf_template_version=2` | PDF baixou com Playfair + amb-name + doc-title + total-card + 5× orange + sem info-grid/CDN/Outfit | PASS |
| Re-emit após PATCH | UAT Playwright MCP | Mesmo layout v2 reproduzido | PASS |
| Console errors relacionados | UAT Playwright MCP | 0 erros JS | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PDF-01 | 05-02, 05-03, 05-04 | Layout tipográfico limpo (não estilo print HTML) | SATISFIED | Template v2 implementa hierarquia 5-níveis com Playfair + Inter via @fontsource bundle (sem race CDN); paleta neutro+laranja; thumbs 48×48; chips Inter 9px; sem emojis, sem Outfit, sem azul |
| PDF-02 | 05-04 | TOTAL GERAL card mantido ou redesenhado (não eliminado) | SATISFIED | `blocoTotal()` emite card editorial com fundo branco + faixa laranja 4px + Playfair 36px |
| PDF-03 | 05-04 | Remover as 4 caixas (Prazo / Garantia / Pagamento / Observações) | SATISFIED | grep `info-grid` em `v2.ts` retorna 0 (caixas REMOVIDAS, não escondidas); UAT visual confirmou ausência |
| PDF-04 | 05-04 | Conteúdo das 4 caixas vira bloco de texto formatado | SATISFIED | `blocoTermos()` emite título "Termos e Condições" + 4 `<h3 class="term-header">` (Prazo, Garantia, Pagamento, Observações) com parágrafos Inter line-height 1.65 |
| PDF-05 | 05-01, 05-05 | Snapshot antigo continua renderizando (compat) | SATISFIED | Coluna `pdf_template_version` adicionada via migration aditiva; backfill 2026-05-07 corrigiu bug do `DEFAULT 2` retroativo; router v1/v2 + `?? 1` no leitor; UAT Playwright validou snapshot real `f39ca4b4` (created 2026-04-27) renderizando como v1 |

**5/5 requirements satisfied.** Nenhum requisito ORPHANED — todos os 5 IDs em REQUIREMENTS.md mapeados para plans desta phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/Step3Revisao.tsx` | 209, 225 | `pdf_template_version: 2` em ambos UPDATE e INSERT (sem distinguir orçamento legacy editado) | Info | WR-03 do REVIEW.md: re-salvar orçamento v1 silenciosamente promove para v2. Não bloqueante (RESEARCH A1 cobriu o cenário — Lenny está OK com snapshots novos saírem v2). Documentado no REVIEW para decisão futura. |
| `src/lib/pdfTemplates/v2.ts` | 316 | `<img src="${logoBase64}" ...>` sem `esc()` | Info | IN-01 do REVIEW.md: inconsistência de invariante (logo gerado localmente, sem risco real). Não bloqueante. |
| `src/lib/gerarPdfHtml.ts` | 35 | `templateVersion?: number` (tipo largo) | Info | IN-02 do REVIEW.md: tipo aceita qualquer int/float. Comportamento de roteamento `>= 2 → v2, else v1` torna valores estranhos seguros (cai no v1 sem crash). Não bloqueante. |
| `src/lib/pdfTemplates/v2.ts` | 37–39 | `formatarData()` sempre `new Date()` | Info | IN-03 do REVIEW.md: PDF re-emitido estampa data de hoje em vez de data original. Pode ser intencional ("data da emissão") ou bug. Decisão de produto pendente. Não bloqueante para Phase 5 goal. |

Nenhum anti-pattern bloqueante. Os 4 itens INFO ficam registrados no REVIEW.md para iteração futura.

### Gaps Summary

Nenhum gap. Phase 5 entrega:

1. **Goal achievement:** Os 5 success criteria do ROADMAP estão verificáveis no codebase (template editorial novo + 4 caixas removidas + bloco prose final + total redesenhado + compat retroativa de snapshots).
2. **Pitfall fixes incorporados:**
   - WR-02 (race CSSOM × `document.fonts.ready`): `ensureFontsReady` força `document.fonts.load()` para 5 pesos críticos antes de `.ready` (linhas 27–36 de `pdfFonts.ts`).
   - WR-01 (FileReader race em erro): `urlToBase64` usa `onload` em vez de `onloadend` (linhas 20–24 de `pdfImages.ts`).
   - Pitfall 2 do RESEARCH (CORS frágil de signed URLs): `inlineImagensSnapshot` pre-converte para base64 ANTES de `html2pdf()` em ambos call sites.
   - Pitfall 3 do RESEARCH (`avoid-all` em docs longos): `pagebreak.mode: ["css", "legacy"]` em ambos call sites.
3. **Migration de prod aplicada:** UAT Playwright (registrado em 05-05-SUMMARY) confirmou row legacy `f39ca4b4` (created 2026-04-27) com `pdf_template_version=NULL` rendendo v1, e mesma row com `pdf_template_version=2` (PATCH simulando Phase 5+) rendendo v2. Migration `20260507180000_backfill_pdf_template_version_legacy.sql` corrigiu bug crítico onde `ADD COLUMN ... DEFAULT 2` preencheu rows existentes com 2 (quebraria PDF-05) — backfill ZERA para NULL em rows pré-2026-05-07 e DROP DEFAULT.
4. **Compat verification end-to-end:** Snapshot real anterior à phase renderiza com layout legacy fielmente preservado (Outfit + info-grid + Google Fonts + dark total). Nenhum campo quebrado, nenhum crash.

UAT já completado via Playwright MCP em 2026-05-07 — não há itens de human verification pendentes para Phase 5.

---

_Verified: 2026-05-07_
_Verifier: Claude (gsd-verifier)_
