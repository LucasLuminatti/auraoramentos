---
phase: 22-pdf-v3-sistemas-compostos
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/pdfTemplates/v3.ts
  - src/lib/gerarPdfHtml.ts
  - src/lib/pdfTemplateVersion.ts
  - src/components/Step3Revisao.tsx
  - src/pages/OrcamentoDetalhe.tsx
  - src/lib/pdfTemplates/__tests__/v3.test.ts
  - src/lib/__tests__/pdfTemplateVersion.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: resolved
resolution:
  WR-01: fixed in 18e303d — inlineImagensSnapshot now walks l.composicao[] (enqueue + deep-clone swap)
  WR-02: benign — fix to WR-01 preserves composicao length, so resolverTemplateVersion(ambientes) === resolverTemplateVersion(ambientesInline); left as-is
  IN-01: pre-existing (not introduced by Phase 22)
---

# Phase 22: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 22 adds composite-system PDF support (v3 template) branching from the existing v2 router. The XSS surface is well-covered — every catalog-derived string entering the v3 HTML builder passes through `esc()`. Backward compat and NULL→1 coercion in the reader are correct. Two real issues were found: a composicao image URL gap in `pdfImages.ts` (not a Phase 22 file, but the gap is exposed by Phase 22 data), and an `ambientesInline` vs `ambientes` divergence between the persist and PDF paths that can produce a wrong version stamp. One info item on `any` casts.

---

## Critical Issues

None.

---

## Warnings

### WR-01: `inlineImagensSnapshot` does not walk `composicao[]` — thumbnail images silently missing in v3 PDF

**File:** `src/lib/pdfImages.ts:47-53` (called by `src/components/Step3Revisao.tsx:454` and `src/pages/OrcamentoDetalhe.tsx:169`)

**Issue:** `inlineImagensSnapshot` pre-resolves image URLs for luminarias and sistemas, but it does not iterate `luminaria.composicao[]`. When a composite system item has an `imagemUrl`, the URL is never fetched and converted to a base64 data URL before rasterization. In v2 this field was unused, so the gap was invisible. In v3 `rowComponente` renders `thumb(c.imagemUrl)` — a real URL that will fail CORS/timing under `html2canvas`, silently producing a blank square for every component thumbnail.

**Fix:** Extend `inlineImagensSnapshot` in `src/lib/pdfImages.ts` to also walk `composicao[]`:

```typescript
for (const amb of ambientes) {
  for (const l of amb.luminarias) {
    enqueue(l.imagemUrl);
    // Phase 22: composicao thumbnails
    for (const c of l.composicao ?? []) enqueue(c.imagemUrl);
  }
  // ...sistemas (unchanged)
}
```

And in the deep-clone section:
```typescript
luminarias: amb.luminarias.map((l) => ({
  ...l,
  imagemUrl: swap(l.imagemUrl),
  composicao: l.composicao?.map((c) => ({ ...c, imagemUrl: swap(c.imagemUrl) })),
})),
```

---

### WR-02: `persistirOrcamento()` and `handlePDF()` evaluate `resolverTemplateVersion` on different inputs — version stamp can diverge from generated PDF

**File:** `src/components/Step3Revisao.tsx:392` (persist) and `src/components/Step3Revisao.tsx:468` (PDF)

**Issue:** Inside `handlePDF`, three async tasks run in parallel:
```typescript
const [, logoBase64, ambientesInline] = await Promise.all([
  persistirOrcamento(),        // ← resolverTemplateVersion(ambientes) — raw ambientes
  carregarLogoBase64(),
  inlineImagensSnapshot(ambientes),  // ← produces ambientesInline
]);
```
Then the PDF is generated with:
```typescript
templateVersion: resolverTemplateVersion(ambientesInline)
```

`inlineImagensSnapshot` only swaps `imagemUrl` fields and does not add/remove `composicao` entries, so the two calls to `resolverTemplateVersion` should return the same value in all current code paths. However, if `inlineImagensSnapshot` is ever extended to strip or transform composicao (e.g., to handle a future "compact snapshot" format), the persisted version and the generated PDF version can silently diverge. The comment in `persistirOrcamento` at line 392 ("resolver versão do template uma vez para consistência writer↔persist") suggests the intent was to reuse a single resolved value, but the implementation does not share it.

**Fix:** Resolve the template version once, after `ambientesInline` is available, and share it between both the persist call and the PDF generation call. This requires sequencing persist after inline-image resolution or passing the resolved version through:

```typescript
const [, logoBase64, ambientesInline] = await Promise.all([
  carregarLogoBase64(),
  inlineImagensSnapshot(ambientes),
]);
const templateVersion = resolverTemplateVersion(ambientesInline);
await persistirOrcamento(templateVersion); // pass as arg or compute inside after ambientesInline

const html = await gerarOrcamentoHtml({
  // ...
  ambientes: ambientesInline,
  templateVersion,
});
```

Note: this changes `persistirOrcamento` to run sequentially after the image pass (adding ~0ms because image fetch is the bottleneck), but eliminates the divergence risk entirely.

---

## Info

### IN-01: `any` cast on `ex` in realtime subscription handler

**File:** `src/components/Step3Revisao.tsx:245-248`

**Issue:** The `postgres_changes` payload is typed as `any` in two places:
```typescript
.on("postgres_changes", ..., (payload) => {
  const ex = payload.new as any;
```
This is a pre-existing pattern in this file and not introduced by Phase 22. However it means typos in `ex.produto_codigo` or `ex.preco_solicitado` will not be caught at compile time. Low risk given TypeScript strict mode is off, but worth noting.

**Fix:** Define a minimal inline type for the payload:
```typescript
const ex = payload.new as { produto_codigo: string; preco_solicitado: number; status: string };
```

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
