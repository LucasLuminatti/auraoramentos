---
status: awaiting_human_verify
trigger: "foto-produto-nao-aparece-pdf — A foto do produto não aparece no PDF de orçamento gerado (client-side). Orçamento Ablim Cozinha, criado 2026-06-10."
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:20:00Z
---

## Current Focus

hypothesis: Timing issue — após container.innerHTML = html, o browser inicia o decode das <img src="data:..."> de forma assíncrona. O html2pdf (via snapdom deepCloneBasic + html2canvas) captura antes do decode completar → img.currentSrc está vazio → imagem não renderiza.
test: APLICADO — await Promise.all(imgs.map(img => img.complete ? resolve : img.decode())) antes de chamar html2pdf().
expecting: Imagens aparecem no PDF gerado.
next_action: Lenny verificar no browser se as fotos aparecem ao gerar PDF.

## Symptoms

expected: O PDF do orçamento mostra a foto de cada produto (como antes).
actual: A foto não aparece no PDF gerado (espaço em branco). Orçamento: Ablim Cozinha, criado 2026-06-10.
errors: Desconhecido — sem erro de console reportado.
reproduction: Montar orçamento novo no wizard → Step 3 → Gerar PDF. Produto com foto selecionado.
started: Percebido 2026-06-10. Antes aparecia (suíte e2e/imagens cobria isso).

## Eliminated

- hypothesis: CORS bloqueando fetch da imagem no browser
  evidence: Access-Control-Allow-Origin:* confirmado via curl + HEAD request com headers de browser. HTTP 200. Blob 77KB. Sem Vary:Origin problemático.
  timestamp: 2026-06-10T00:10:00Z

- hypothesis: imagemUrl nulo no catálogo para os produtos do orçamento reportado
  evidence: LM2842AC e LM1400 têm imagem_url válida no banco. AU003 não tem (produto sem foto — correto, não é bug).
  timestamp: 2026-06-10T00:11:00Z

- hypothesis: Mixed content (http vs https)
  evidence: Todas as URLs de imagem são https://. Sem produtos com http://.
  timestamp: 2026-06-10T00:12:00Z

- hypothesis: Phase 14 causou regressão
  evidence: Commit cd5443d só toca tipo_produto — não toca imagem_url nem pipeline de PDF.
  timestamp: 2026-06-10T00:13:00Z

- hypothesis: esc() quebra data: URL no template
  evidence: data: URL base64 não contém &, <, >, " — esc() não altera a URL.
  timestamp: 2026-06-10T00:14:00Z

- hypothesis: Serialização/desserialização jsonb perde imagemUrl
  evidence: JSON raw do banco inspecionado — campo imagemUrl está presente e correto.
  timestamp: 2026-06-10T00:15:00Z

- hypothesis: CSP do site bloqueia fetch para supabase.co
  evidence: Headers da produção não têm Content-Security-Policy restritiva.
  timestamp: 2026-06-10T00:16:00Z

## Evidence

- timestamp: 2026-06-10T00:01:00Z
  checked: src/lib/pdfImages.ts — função inlineImagensSnapshot
  found: Função faz fetch com credentials:omit de cada imagemUrl. Retorna null silenciosamente em erro. Template v2 usa thumb() que renderiza <div class="thumb-empty"> quando imagemUrl é undefined/null.
  implication: Se fetch falhar por CORS ou 4xx, a imagem cai de volta para URL original. O template usa a URL original no <img src>. html2canvas com useCORS:true ainda pode renderizar se CORS estiver ok no bucket.

- timestamp: 2026-06-10T00:02:00Z
  checked: src/components/Step3Revisao.tsx handlePDF
  found: Pipeline: inlineImagensSnapshot(ambientes) → gerarOrcamentoHtml com ambientesInline → html2pdf useCORS:true. Imagens pré-convertidas para base64 ANTES de rasterizar. Correto.
  implication: Se inlineImagensSnapshot converte corretamente, imagens aparecem. Se falha, cai para URL original — e html2canvas com useCORS:true pode ou não conseguir renderizar dependendo do CORS do bucket.

- timestamp: 2026-06-10T00:03:00Z
  checked: src/components/AmbienteCard.tsx handleSelectProdutoLuminaria / handleSelectProdutoSistema
  found: imagemUrl: produto.imagem_url || undefined. Correto — copia do catálogo no momento da seleção.
  implication: Se produto.imagem_url for null/empty no catálogo, imagemUrl fica undefined no snapshot → espaço em branco. Isso seria problema de dado, não de código.

## Resolution

root_cause: Timing issue entre container.innerHTML = html e a rasterização pelo html2pdf/html2canvas. Após setar o innerHTML, o browser inicia o decode das <img src="data:image/jpg;base64,..."> de forma assíncrona. O html2pdf (snapdom deepCloneBasic) clona o elemento imediatamente e usa img.currentSrc — que ainda está vazio se o decode não terminou — resultando em img sem src no clone e espaço em branco no PDF. O fix de inlineImagensSnapshot já converte as URLs para base64 corretamente (CORS, HTTP 200, blob 77KB confirmados), mas esse await de decode estava ausente.
fix: Adicionado await Promise.all(imgs.map(img => img.complete ? resolve : img.decode().catch(()=>{}))) imediatamente após document.body.appendChild(container) e antes de chamar html2pdf(), nos dois call sites (Step3Revisao.tsx e OrcamentoDetalhe.tsx). img.decode() resolve quando a imagem está pronta para exibição; fallback onload/onerror para Safari < 14.
verification: lint sem novos erros, 55 testes passando. Verificação human: gerar PDF com produto que tem foto e confirmar que aparece.
files_changed:
  - src/components/Step3Revisao.tsx
  - src/pages/OrcamentoDetalhe.tsx
