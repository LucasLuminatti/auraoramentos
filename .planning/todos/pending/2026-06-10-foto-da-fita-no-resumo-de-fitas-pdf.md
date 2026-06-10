---
created: 2026-06-10
title: Mostrar foto da fita no "Resumo de Fitas" do PDF
area: ui
phase_target: 17
related: [RES-01]
files:
  - src/types/orcamento.ts
  - src/lib/pdfTemplates/v2.ts
  - src/lib/pdfTemplates/v1.ts
---

## Problem

Na seção "RESUMO DE FITAS" do PDF, a miniatura do produto é um quadrado vazio
(`<div class="thumb-empty">` em `v2.ts:275`). A foto da fita NUNCA apareceu nessa seção,
em nenhum template — porque `GrupoFita` (`orcamento.ts:346`) não carrega `imagemUrl` e
`calcularRolosPorGrupo` (`orcamento.ts:358`) não captura.

Não é regressão nem o bug de decode (esse foi corrigido em `2f5b02d` — a foto aparece
normalmente na LINHA DO AMBIENTE quando a fita está preenchida). É limitação de design
pré-existente, só da seção agregada de resumo.

Confirmado visualmente em 2026-06-10 (PDF de teste): fita preenchida mostra foto na linha
SISTEMA→FITA do ambiente; o mesmo produto no "Resumo de Fitas" fica com box vazio.

## Solution

Mudança aditiva (não altera cálculos nem subtotais):
1. Adicionar `imagemUrl?: string` em `GrupoFita` (`orcamento.ts:346`).
2. Em `calcularRolosPorGrupo`, capturar `sis.fita.imagemUrl` (primeira não-vazia) por grupo.
3. Trocar `<div class="thumb-empty">` por `thumb(g.imagemUrl)` em `v2.ts:275` (blocoResumoFitas).
4. Espelhar no `v1.ts` (Resumo de Fitas LED) se quiser paridade.

**Por que Phase 17 (RES-01):** a diretiva v1.2 pediu pra NÃO tocar `calcularRolosPorGrupo` fora
da Phase 17, e a Phase 17 (Resumo & Apresentação) já mexe nesse resumo (anotação de LOCAL).
Fazer junto evita dois toques na mesma função. Decisão do Lenny (2026-06-10): registrar aqui.
