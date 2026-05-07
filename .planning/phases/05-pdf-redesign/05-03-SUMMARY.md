---
phase: 05-pdf-redesign
plan: 03
subsystem: pdf
tags: [pdf, fonts, images, helpers, html2pdf]
requires:
  - "@fontsource/inter@5.2.8"
  - "@fontsource/playfair-display@5.2.8"
  - "src/types/orcamento.ts (Ambiente, ItemLuminaria, ItemPerfil, ItemFitaLED, ItemDriver, SistemaIluminacao)"
provides:
  - "src/lib/pdfFonts.ts (ensureFontsReady)"
  - "src/lib/pdfImages.ts (inlineImagensSnapshot)"
  - "Inter + Playfair Display embeddados via @fontsource bundle"
affects:
  - Plan 05-04 (template v2 vai consumir as fontes)
  - Plan 05-05 (call sites Step3Revisao + OrcamentoDetalhe vão chamar ensureFontsReady + inlineImagensSnapshot antes de html2pdf)
tech-stack:
  added:
    - "@fontsource/inter@5.2.8"
    - "@fontsource/playfair-display@5.2.8"
  patterns:
    - "Pre-resolução de fonts (document.fonts.ready) antes de html2canvas"
    - "Pre-conversão de URLs externas para base64 (fetch + FileReader.readAsDataURL) em paralelo (Promise.all)"
    - "Deep-clone imutável de Ambiente[] com swap idempotente de imagemUrl"
key-files:
  created:
    - src/lib/pdfFonts.ts
    - src/lib/pdfImages.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Versões fixadas em 5.2.8 (sem caret/tilde) — bumpar manualmente quando RESEARCH for atualizado"
  - "Inter 700 incluído no bundle mesmo não estando no exemplo do RESEARCH — usado no header de Ambiente do template v2 (Plan 04)"
  - "fetch + FileReader.readAsDataURL preferido sobre <img>+canvas (Step3Revisao:43-57) — mais robusto para signed URLs do Supabase Storage"
  - "credentials: 'omit' deliberado — signed URL não depende de cookies, evita confundir o servidor"
  - "Falha individual de fetch preserva URL original em vez de abortar — degradação graciosa"
metrics:
  duration: ~10min
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  completed: 2026-05-07
---

# Phase 5 Plan 3: Helpers de Fonts e Imagens Summary

Two PDF helpers (`pdfFonts.ts` + `pdfImages.ts`) criados em `src/lib/`, mais 2 deps `@fontsource/*@5.2.8` instaladas — endereçando Pitfalls 1 e 2 do RESEARCH (race com Google Fonts CDN no html2canvas + CORS frágil de thumbnails Supabase).

## Tasks Executed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Instalar @fontsource/inter + @fontsource/playfair-display@5.2.8 | `5f1ee9b` | package.json, package-lock.json |
| 2 | Criar src/lib/pdfFonts.ts (ensureFontsReady) | `ed83289` | src/lib/pdfFonts.ts |
| 3 | Criar src/lib/pdfImages.ts (inlineImagensSnapshot) | `ad016f9` | src/lib/pdfImages.ts |

Build limpo após cada commit (`npm run build` exit 0).

## Versões Exatas

- `@fontsource/inter`: **5.2.8** (fixado, sem caret)
- `@fontsource/playfair-display`: **5.2.8** (fixado, sem caret)

## Imports CSS no `pdfFonts.ts` (8 ao todo)

```typescript
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/400-italic.css";
```

5 pesos de Inter (incluindo 700 para header de Ambiente do template v2) + 3 pesos de Playfair Display (regular, medium, italic).

## Pseudocódigo de `inlineImagensSnapshot` (5 linhas)

```
1. coletar urls únicas (luminárias.imagemUrl + sistemas.{fita,driver,perfil}.imagemUrl), skipando data: URLs
2. fetcha tudo em paralelo via Promise.all → Map<url, base64>
3. deep-clone ambientes trocando imagemUrl → resolved.get(url) || url (preserva original em falha)
4. retorna Promise<Ambiente[]> imutável (não muta input)
5. idempotente: re-rodar não fetcha de novo (data: já é skipped)
```

## Deviations from Plan

None — plan executed exactly as written. As 3 tasks bateram os acceptance_criteria 1:1:

- Task 1: ambas deps em `dependencies` com versão `5.2.8` exata, `node_modules/@fontsource/{inter,playfair-display}` existem, `npm run build` exit 0
- Task 2: 8 imports CSS presentes, `ensureFontsReady` exportada com guard `typeof document === "undefined" || !document.fonts` antes de `await document.fonts.ready`
- Task 3: `inlineImagensSnapshot` exportada, `urlToBase64` interno usa fetch + FileReader.readAsDataURL com try/catch, deep-clone via `ambientes.map(...)`, Promise.all para paralelismo, skipa `data:` URLs

## Threat Surface Scan

Nenhuma nova superfície de ameaça introduzida:

- `pdfFonts.ts` consome bundle local Vite (sem rede de runtime).
- `pdfImages.ts` faz `fetch(url, { credentials: "omit" })` em URLs **já presentes no snapshot Ambiente[]** — não introduz novo trust boundary. As URLs vêm do banco (signed URLs Supabase Storage que o usuário já tem visibilidade), e o GET sem credenciais não exfiltra cookies/auth. Falha de fetch retorna `null` (sem propagação de erro).

## Self-Check: PASSED

- `[FOUND]` src/lib/pdfFonts.ts (25 linhas, > min_lines 15)
- `[FOUND]` src/lib/pdfImages.ts (74 linhas, > min_lines 30)
- `[FOUND]` package.json contém `"@fontsource/inter": "5.2.8"` em dependencies
- `[FOUND]` package.json contém `"@fontsource/playfair-display": "5.2.8"` em dependencies
- `[FOUND]` commit `5f1ee9b` (Task 1)
- `[FOUND]` commit `ed83289` (Task 2)
- `[FOUND]` commit `ad016f9` (Task 3)
- `[FOUND]` `npm run build` exit 0 (verificado após cada task)
