---
phase: 05-pdf-redesign
plan: 04
subsystem: pdf-template
tags: [pdf, template-v2, editorial, playfair, inter, hierarchy-5-levels]
requirements:
  - PDF-01
  - PDF-02
  - PDF-03
  - PDF-04
dependency-graph:
  requires:
    - "src/types/orcamento.ts (SistemaIluminacao.local — Plan 05-02)"
    - "src/types/orcamento.ts (calc functions: calcularDemandaFita, calcularConsumoW, calcularQtdDrivers, calcularSubtotal*, calcularTotalAmbienteSemFita, calcularRolosPorGrupo, calcularTotalGeral, formatarMoeda)"
  provides:
    - "src/lib/pdfTemplates/v2.ts (gerarOrcamentoHtmlV2 + PdfParamsV2)"
  affects:
    - "Plan 05-05 (router em gerarPdfHtml.ts vai importar e dispatchar para v2)"
    - "Step3Revisao + OrcamentoDetalhe (call sites — Plan 05-05 conecta)"
tech-stack:
  added: []
  patterns:
    - "Hierarquia visual 5-níveis via tipografia (escala + peso + cor + espaço) — não bordas/caixas"
    - "Híbrido tabela + chips (RESEARCH Pattern 3) — tabela com colunas essenciais + chips Inter 9px abaixo"
    - "Bloco prose final substituindo cards (RESEARCH Pattern 4 — Área C default)"
    - "Total card editorial: fundo branco + faixa laranja 4px + Playfair 36px (RESEARCH Pattern 5 — Área D default)"
    - "Agrupamento por sistema.local com fallback null/undefined → pseudo-grupo Geral (Pitfall 4 — compat snapshot antigo)"
    - "Map preserva ordem de inserção do array (não alfabetiza locais)"
    - "Escape XSS defensivo em strings vindas do snapshot (esc helper)"
key-files:
  created:
    - "src/lib/pdfTemplates/v2.ts (430 linhas)"
  modified: []
decisions:
  - "Default Área C (locked decisions C+D devolvidos para defaults do RESEARCH): bloco prose com 4 termos como h3 (Prazo, Garantia, Pagamento, Observações), título Playfair 24px, headers Playfair small-caps laranja, parágrafos Inter 11px line-height 1.65"
  - "Default Área D: card TOTAL GERAL com fundo branco, faixa laranja 4px à esquerda, label Inter 9px tracking, valor Playfair 36px, alinhado à direita com border-bottom hairline"
  - "Thumbnail 48×48 (decisão A6 do RESEARCH — meio-termo entre 40 e 60 do CONTEXT)"
  - "Subtotal de fita aparece como '— global —' nas linhas de sistema (fitas são consolidadas no bloco RESUMO DE FITAS — comportamento do v1 preservado)"
  - "Chips de fita usam variant 'orange' (W/m, voltagem) — destaque visual da identidade Luminatti em pontos cirúrgicos"
  - "Imports apenas de @/types/orcamento — NÃO importa pdfFonts/pdfImages (Plan 05-05 chama no call site, template é stateless)"
metrics:
  duration: "~15min"
  completed: 2026-05-07
  tasks_completed: "2/2"
  files_created: 1
  lines_added: 430
  commits:
    - "ba9c253 — feat(05-04): scaffold v2.ts with helpers + builders"
    - "ea38221 — feat(05-04): complete v2.ts editorial template (PDF-01..04)"
---

# Phase 05 Plan 04: PDF Template v2 — Summary

Template editorial Apple-like criado em `src/lib/pdfTemplates/v2.ts` (430 linhas, função `gerarOrcamentoHtmlV2(params: PdfParamsV2): string`). Hierarquia 5-níveis via tipografia (Doc → Ambiente → Local → Sistema → Componente), tabela híbrida com chips, thumbnails 48×48, paleta neutro + laranja Luminatti, Playfair Display + Inter, TOTAL GERAL redesenhado e bloco prose final substituindo as 4 caixas. Atende PDF-01, PDF-02, PDF-03 e PDF-04 simultaneamente.

## What Was Built

### Task 1 — Scaffold com helpers + builders (commit `ba9c253`)

`src/lib/pdfTemplates/v2.ts` linhas 1–218:

- Tipo público `PdfParamsV2` exportado (mesmos campos do v1: clienteNome, projetoNome, colaborador, tipo, ambientes, logoBase64?)
- Helpers internos:
  - `formatarData()` — `pt-BR` longa
  - `esc(s)` — escape HTML defensivo (`&` `<` `>` `"`) para strings do snapshot (proteção XSS)
  - `chip(text, variant)` — chip Inter 9px, variants `neutral` (cinza) ou `orange` (`#fff4e0` bg + `#E68601` text — usado em fita)
  - `thumb(url)` — `<img class="thumb">` 48×48 ou `<div class="thumb-empty">` quando ausente
  - `agruparPorLocal(sistemas)` — Map preserva ordem de inserção, key `null` para sistemas sem local (incluindo string vazia, undefined, só whitespace)
- Builders por componente: `rowLuminaria`, `rowFita`, `rowPerfil`, `rowDriver`
- Builders agregadores: `blocoSistema` (fita+perfil+driver), `blocoLocal` (header italic + sistemas), `blocoAmbiente` (header laranja + rule + luminárias + grupos)

### Task 2 — Resumo Fitas + Total + Termos + Main com CSS (commit `ea38221`)

`src/lib/pdfTemplates/v2.ts` linhas 220–430:

- `blocoResumoFitas(ambientes)` — replica cálculo `calcularRolosPorGrupo` do v1 em layout editorial (chips com demanda/rolos/qtd)
- `blocoTotal(totalGeral)` — card editorial: bg branco, faixa laranja 4px à esquerda, label Inter 9px tracking 0.3em, valor Playfair 36px, hairline inferior
- `blocoTermos()` — bloco prose substituindo as 4 caixas: título "Termos e Condições" Playfair 24px, 4 `<h3 class="term-header">` (Prazo de entrega, Garantia, Condições de pagamento, Observações) com cores Playfair small-caps laranja, parágrafos Inter line-height 1.65
- `gerarOrcamentoHtmlV2(params)` — entry point exportado: monta HTML completo com `<!DOCTYPE html>`, CSS inline (~150 linhas), header com logo + meta, ambientes, resumo fitas, total, termos

### Hierarquia 5-níveis renderizada

| Nível | Classe CSS | Tipografia |
|-------|-----------|-----------|
| 1. Doc | `.doc-title` | Playfair Display 32px regular `#1a1f2e` |
| 2. Ambiente | `.amb-name` + `.amb-rule` | Inter 11px 700 letter-spacing 0.3em uppercase `#E68601` + linha gradient horizontal |
| 3. Local | `.local-name` | Playfair italic 18px regular `#5a6475` indent 16px |
| 4. Sistema | `.system-label` | Inter 9px 600 letter-spacing 0.18em uppercase `#9aa3b0` indent 32px |
| 5. Componente | `.item-row` + `.chip` + `.code-tag` | Inter 11–12px regular + chips secundárias |

## Verification

| Acceptance Criterion | Status | Evidence |
|---|---|---|
| `export function gerarOrcamentoHtmlV2` presente | OK | grep retornou 1 |
| `function blocoResumoFitas`, `function blocoTotal`, `function blocoTermos` | OK | grep retornou 3 |
| Classes `.amb-header`, `.amb-name`, `.amb-rule` (PDF-01 hierarquia) | OK | presentes no `<style>` |
| Classes `.local-name`, `.system-label` (níveis 3+4) | OK | presentes |
| Classes `.chip`, `.code-tag`, `.thumb` (Pattern 3 híbrido) | OK | presentes |
| Classes `.total-card`, `.total-accent`, `.total-value` (PDF-02) | OK | presentes |
| `.terms-section` + `.term-header` (PDF-04 prose) | OK | presentes |
| Literal "Termos e Condições" | OK | grep retornou 1 |
| 4 headers (Prazo/Garantia/Pagamento/Observações) como `<h3 class="term-header">` | OK | grep retornou 5 ocorrências dos termos |
| `#E68601` (laranja Luminatti) presente | OK | 7 ocorrências (header rule + chip orange + comp-fita + total-accent + term-header + amb-name + extras) |
| `Playfair Display` em corpo CSS | OK | 7 contextos (doc-title, logo-text, local-name, total-value, terms-title, term-header) |
| `'Inter'` em corpo CSS | OK | 14 contextos (body, doc-meta-row, amb-name, amb-subtotal, system-label, desc-name, comp-tag, chip, qty/watts/price-cell, subtotal-cell, code-tag, total-label, term-block p, empty-note) |
| `npm run build` exit 0 | OK | 43.61s, 3445 módulos transformados, sem errors |
| `npm run lint` errors em v2.ts | OK (zero) | grep -E "v2\.ts" sobre output do lint retornou vazio |

### Os 6 NÃO-contém (locked A2 + A3)

| Não-deve-conter | Resultado |
|---|---|
| `info-grid` (4 caixas REMOVIDAS, não escondidas) | 0 ocorrências |
| `Outfit` (fonte legacy substituída por Inter) | 0 ocorrências |
| `var(--blue)` ou `#2E78A6` ou `#4a93c0` ou `#c8e2f0` (paleta neutro+laranja) | 0 ocorrências |
| Emojis (📦 🛡 💳 📋 ⚡ 📂) | 0 ocorrências |
| `Outfit` em font-family | 0 ocorrências |
| Backgrounds de cor sólida em headers (azul/laranja sólidos como cards) | 0 ocorrências (todos via texto + linha) |

## Deviations from Plan

### Auto-fixed Issues

Nenhum. Plan executou exatamente como descrito — sem necessidade de Rule 1/2/3 fixes. Todos os acceptance criteria atendidos diretamente.

### Authentication / UAT Gates

Nenhuma. Template v2 é função pura (input → string HTML) sem dependência de auth, network, ou serviços externos em runtime. Validação visual via UAT acontece no Plan 05-05 (router + Step3Revisao + Re-emitir PDF — a cargo do orchestrator).

### Deferred Issues

**Lint errors pré-existentes (38 errors, 12 warnings):** todos em arquivos não tocados por este plan (`src/pages/Admin.tsx`, `supabase/functions/*`, `tailwind.config.ts`). Mesma situação documentada nos Plans 05-01 e 05-02 — scope boundary, fica para fase de qualidade futura. `v2.ts` não introduz novo erro de lint.

## Áreas C + D — Decisão Documentada

CONTEXT.md delegou para Claude:

- **Área C (bloco final substituindo as 4 caixas):** aplicado default do RESEARCH Pattern 4 — bloco prose com título "Termos e Condições" (Playfair 24px), 4 sub-headers em Playfair small-caps laranja, parágrafos Inter 11px line-height 1.65. Conteúdo replicado do v1 (linhas 322–376 de `gerarPdfHtml.ts`) sem alteração de copy — Lenny só pediu reformatação. Texto extenso de "Observações" preservado em 4 parágrafos quebrados por tema (validade, recomendação técnica, instalação/devolução, recebimento).
- **Área D (TOTAL GERAL):** aplicado default do RESEARCH Pattern 5 — fundo branco, faixa laranja 4px à esquerda (`.total-accent`), label "TOTAL GERAL" em Inter 9px tracking 0.3em cinza, valor em Playfair 36px regular `#1a1f2e`, alinhado à direita com `border-bottom: 1px solid #e8ecf0` (hairline).

Ambas decisões facilmente ajustáveis no UAT visual com Lenny (constantes CSS isoladas).

## Threat Flags

Nenhum. Template é função pura client-side, não introduz network endpoint, auth path, ou trust boundary novo. Helper `esc()` proteje contra injection de HTML em strings do snapshot (cliente, projeto, ambiente.nome, sistema.local, descrições) — supera v1 que usa template literals raw em alguns campos.

## Known Stubs

Nenhum. Template é entrega completa — recebe `Ambiente[]` real e renderiza tudo. Não há campo placeholder, mock, ou "TODO". A passagem de imagens base64 e fontes prontas é responsabilidade do call site (Plan 05-05) — documentada na assinatura `PdfParamsV2` (logoBase64 opcional + ambientes pré-processados).

## Notes for Plan 05-05 (Router + Call Sites)

Para Plan 05-05 conectar este template:

```typescript
// src/lib/gerarPdfHtml.ts (router refatorado)
import { gerarOrcamentoHtmlV2, type PdfParamsV2 } from "./pdfTemplates/v2";
// ...
export function gerarOrcamentoHtml(params: PdfParams): string {
  const v = params.templateVersion ?? 2;
  if (v >= 2) return gerarOrcamentoHtmlV2(params);
  return gerarOrcamentoHtmlV1(params); // legacy
}
```

E nos call sites antes de chamar:

```typescript
await ensureFontsReady();  // de src/lib/pdfFonts.ts (Plan 05-03)
const ambientesComBase64 = await inlineImagensSnapshot(ambientes);  // de src/lib/pdfImages.ts (Plan 05-03)
const html = gerarOrcamentoHtml({ ...params, ambientes: ambientesComBase64, templateVersion: 2 });
```

Snapshot antigo (sem `pdf_template_version` ou com `1`) cai no v1 — sem regressão.
Snapshot antigo com `pdf_template_version: 2` mas sem `local` em sistemas — `agruparPorLocal` trata graciosamente (todos caem no pseudo-grupo Geral sem header).

## Self-Check: PASSED

**Files exist:**
- FOUND: `src/lib/pdfTemplates/v2.ts` (430 linhas)

**Commits exist:**
- FOUND: `ba9c253` (feat(05-04): scaffold v2.ts with helpers + builders)
- FOUND: `ea38221` (feat(05-04): complete v2.ts editorial template (PDF-01..04))

**Build/lint:**
- `npm run build` exit 0 (verificado)
- `npm run lint` zero erros em `src/lib/pdfTemplates/v2.ts` (38 errors pré-existentes em outros arquivos — scope boundary)

**Locked decisions implementadas:**
- Hierarquia 5-níveis presente (5 classes CSS distintas com tipografia diferenciada)
- 4 caixas REMOVIDAS, não escondidas (`info-grid`: 0 ocorrências)
- Bloco prose final com 4 termos como `<h3>` (PDF-04)
- TOTAL GERAL redesenhado: bg branco + faixa laranja + Playfair 36px (PDF-02)
- Sem emojis (0 ocorrências), sem Outfit (0), sem azul (0)
- Playfair em 7 contextos, Inter em 14, `#E68601` em 7 contextos
