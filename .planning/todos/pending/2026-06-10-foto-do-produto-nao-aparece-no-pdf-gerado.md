---
created: 2026-06-10
title: Foto do produto não aparece no PDF gerado
area: ui
files:
  - src/lib/gerarPdfHtml.ts
  - src/lib/pdfTemplates/v1.ts
  - src/lib/pdfTemplates/v2.ts
---

## Problem

Ao gerar um PDF de orçamento em 2026-06-10, a **foto do produto não apareceu** no documento.
Exemplo reportado pelo Lenny: `Proposta_Ablim_Cozinha_Ablim (1).pdf` (em `C:\Users\lenny\Downloads\`).

Independente da Phase 14 (o fix de `tipo_produto` não toca o pipeline de imagem). É bug de
geração de PDF / imagem.

Contexto conhecido:
- PDF é gerado client-side via `src/lib/gerarPdfHtml.ts` (HTML→PDF com html2pdf.js/html2canvas).
- Há suíte e2e `e2e/imagens` que cobria imagem no PDF — verificar se ainda passa (pode ter
  regredido) ou se o caso reportado é um SKU específico sem imagem válida.
- Carga de dados: ~85% dos produtos têm foto; 745 sem. Confirmar se o produto do orçamento Ablim
  tem `imagem_url` válida no catálogo.

## Solution

TBD — investigar quando priorizado. Hipóteses a checar:
1. `imagem_url` do(s) produto(s) do orçamento está nula/quebrada (caso pontual, não bug global).
2. Conversão para base64 / fetch da imagem falhando (CORS do bucket Supabase storage, ou
   `imageToBase64` retornando vazio) — html2canvas não rasteriza `<img>` com src remoto sem CORS.
3. Snapshot antigo do orçamento (jsonb `ambientes`) sem `imagemUrl` preenchido nos itens.
4. Regressão recente no template (v1 vs v2 — `pdf_template_version`).

Passo 1 sugerido: reproduzir com o orçamento Ablim, abrir console do navegador ao gerar o PDF,
checar erros de fetch/CORS e se os itens do snapshot têm `imagemUrl`. Rodar `npm run test:e2e -- imagens`.
Relacionado: backlog 999.1 (PDF vetorial — substituir rasterização html2canvas) pode resolver de vez.
