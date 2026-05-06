---
captured: 2026-05-06
source: Phase 4 UAT (Re-emitir PDF smoke)
status: pending
priority: medium
tags: [pdf, ui, polish, gerarPdfHtml]
---

# PDF de orçamento — estética horrível

## Contexto

Validado em UAT da Phase 4 que o botão "Re-emitir PDF" em `/admin/orcamento/:id` funciona — baixa o PDF refletindo o snapshot. Mas Lenny reportou que o **visual do PDF gerado está ruim**.

Não é regressão de Phase 4: a Phase 4 só reusa `gerarOrcamentoHtml` + `html2pdf` já existente em produção desde Phase 1 (mesmo template usado pelo Step3Revisao do wizard de criação).

## O que precisa ser arrumado

(a confirmar com Lenny — pedir prints do PDF atual antes de planejar)
- Possíveis suspeitos: layout/quebra de página, tipografia, hierarquia visual, espaçamento, cores, branding Luminatti, cabeçalho/rodapé
- Verificar se html2pdf.js está respeitando todos os estilos do template HTML

## Arquivos relevantes

- `src/lib/gerarPdfHtml.ts` — gera o HTML do PDF
- `src/components/Step3Revisao.tsx` — chama a geração no wizard
- `src/pages/OrcamentoDetalhe.tsx` — chama a geração na página admin (Phase 4)

## Próximos passos

Quando Lenny levantar para tratar:
1. Pedir prints do PDF atual + referência de "como deveria ficar"
2. Decidir se é polish incremental ou redesign completo
3. Considerar troca de lib (html2pdf.js → react-pdf, jspdf+autotable, ou server-side via puppeteer/Playwright)

## Resolution

[pending]
