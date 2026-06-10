# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## foto-produto-nao-aparece-pdf — Foto do produto não aparece no PDF gerado (client-side)
- **Date:** 2026-06-10
- **Error patterns:** foto produto, imagem PDF, espaço em branco, html2pdf, html2canvas, snapdom, img decode, imagemUrl, base64, rasterização
- **Root cause:** Timing entre `container.innerHTML = html` e a rasterização do html2pdf/html2canvas (snapdom deepCloneBasic). O browser decodifica as `<img src="data:...base64">` de forma assíncrona; o clone acontecia antes do decode terminar (`img.currentSrc` vazio), gerando img sem src no clone → espaço em branco. As URLs já eram convertidas corretamente para base64 (CORS, HTTP 200, blob 77KB confirmados); faltava o await do decode.
- **Fix:** Adicionado `await Promise.all(imgs.map(img => img.complete ? resolve : img.decode().catch(()=>{})))` logo após `document.body.appendChild(container)` e antes de chamar `html2pdf()`, nos dois call sites. Fallback onload/onerror para Safari < 14.
- **Files changed:** src/components/Step3Revisao.tsx, src/pages/OrcamentoDetalhe.tsx
---
