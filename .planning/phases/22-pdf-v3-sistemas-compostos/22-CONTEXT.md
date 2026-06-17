# Phase 22: PDF v3 — Sistemas Compostos - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Apresentar **sistemas compostos** (trilho/perfil + módulos + driver + acessórios obrigatórios) como **bloco estruturado** no PDF de orçamento, via um **router v3 aditivo**, sem alterar nem arriscar o PDF v2 para orçamentos sem composto, e mantendo snapshots/PDFs antigos (v1/v2) renderizando inalterados.

**Fixo (success criteria — não reabrir):**
- Router por `pdf_template_version`: v3 disparado **condicionalmente** quando `ambientes.some(a => a.luminarias.some(l => l.composicao?.length))`; caso contrário continua v2. (SC #2)
- v1/v2/v3 coexistem — o router é aditivo; orçamentos/snapshots antigos não mudam. (SC #3)
- Um composto deve mostrar, no mínimo: SKU+qtd do trilho, tabela de módulos (SKU/qtd), qtd+SKU do driver, acessórios obrigatórios. (SC #1)

**Fora de escopo:** PDF vetorial (backlog 999.1), redesign estético do v2, mudanças no modelo de dados de composto (travado na Phase 19).
</domain>

<decisions>
## Implementation Decisions

### Layout do bloco composto
- **D-01:** O composto aparece **inline dentro do ambiente** onde foi montado, como um bloco "Sistema Composto N — {TIPO}" com o trilho/perfil no topo e sub-linhas dos componentes (módulos, fita modular, driver, acessórios). A "seção Sistemas Compostos" do success criteria é interpretada como **esse bloco estruturado dentro do ambiente**, NÃO um capítulo separado no fim do PDF. Reflete a hierarquia existente Ambiente → Local → Sistema; o cliente pensa por ambiente e enxerga tudo do ambiente em um só lugar. **Rejeitado:** seção dedicada no fim (separa o sistema do local) e híbrido (duplica informação, manutenção mais cara).

### Preço
- **D-02:** **Preço por componente** (unitário, por linha — trilho, cada módulo, fita modular, driver, acessório) + um **subtotal do sistema** destacado ao fim do bloco. Mantém a filosofia de rastreabilidade do v2 (que já mostra preço por linha) — importante em iluminação técnica onde cliente/arquiteto/especificador querem entender de onde vem o valor. **Rejeitado:** só total do sistema (perde rastreabilidade).

### Nível de detalhe técnico
- **D-03:** Mostrar o **atributo técnico relevante por papel**, reusando os chips do v2:
  - trilho/perfil → comprimento/tipo
  - módulo → potência e/ou comprimento (característica principal)
  - fita modular → W/m + voltagem + metragem
  - driver → potência + voltagem
  - acessório (conector/kit) → só descrição
  - **resumo do sistema** → carga total (W) e metragem de fita derivada quando aplicável (SYSTEM MOLD)
  - Regra: exibir só o que ajuda a identificar/validar/comparar o componente; ocultar atributos internos/redundantes. **Rejeitado:** completo (ruído visual em sistemas grandes) e mínimo (perde info de especificação).

### Fita do SYSTEM MOLD
- **D-04:** A `fita_modular` (papel `'fita_modular'` em `composicao[]`) aparece como **linha dentro do bloco do composto**, com a metragem derivada. **Não** entra no "Resumo de Fitas" global do v2 — esse resumo continua só para fitas de sistemas Fita Padrão (independentes, em `sistemas[].fita`). Regra: cada componente aparece no contexto onde é consumido; a fita modular é consumida pelo composto. **Guard de implementação:** o `blocoResumoFitas` do v2 hoje itera `sistemas[].fita`, então a fita modular já fica naturalmente fora; o planner deve garantir que o resumo global **não** passe a varrer `composicao[]`.

### Claude's Discretion
- **Rótulo de tipo no bloco** ("SYSTEM MOLD" / "MAGNETO 48V" / "TINY 24V" vs "Sistema Composto N" genérico): usar o rótulo de tipo é desejável e foi usado nas prévias; o tipo é inferido de `produto.sistema` (`'magneto_48v' | 'tiny_magneto' | 's_mode'`, Phase 19/D-04, Phase 20). Forma exata (badge/chip/texto) fica a critério da implementação, seguindo a linguagem visual do v2.
- Ordem das sub-linhas dentro do bloco (sugestão: trilho → módulos → fita → driver → acessórios), tratamento visual de acessório obrigatório vs opcional, e comportamento de quebra de página do bloco — a critério da implementação dentro do estilo do v2.
- Mecânica fina do router (terceiro branch em `gerarOrcamentoHtml` + novo `pdfTemplates/v3.ts` reusando helpers/CSS do v2 vs estender v2) — decisão técnica do planner, desde que v2 não seja alterado para orçamentos sem composto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Modelo de dados do composto (travado)
- `.planning/phases/19-funda-o-compostos/19-CONTEXT.md` — D-01 (composto em `luminarias[].composicao?`), D-02 (shape `ItemComposicao` forward-complete: `papel`, `comprimento?`, `potenciaW?`), D-03 (preço/técnico são snapshot do catálogo), D-05 (vocabulário dos papéis)
- `src/types/orcamento.ts` — interfaces `ItemLuminaria` (linha ~23) e `ItemComposicao` (linha ~43); `calcularSubtotalComposicao` (~346), `calcularSubtotalLuminaria` (~340), `calcularCargaComposicao` (~183), `calcularMetragemModulosDifusos` (~192)

### PDF (router + template a reusar)
- `src/lib/gerarPdfHtml.ts` — router `gerarOrcamentoHtml` por `templateVersion` (v1/v2); ponto de extensão para v3 + `buildAtributosMap` (lookup de atributos do catálogo)
- `src/lib/pdfTemplates/v2.ts` — template editorial v2: helpers (`esc`, `chip`, `thumb`, `agruparPorLocal`), `rowLuminaria` (~100), `blocoSistema` (~217), `blocoAmbiente` (~244), `blocoResumoFitas` (~266), `blocoTotal` (~302), CSS (~376+). Base de estilo/componentes para o v3.
- `src/lib/pdfTemplates/v1.ts` — legacy; **não modificar** (snapshots pré-Phase 5)
- `src/components/Step3Revisao.tsx` — call site de geração (linhas ~398/414/465 persistem `pdf_template_version`)
- `src/pages/OrcamentoDetalhe.tsx` — leitor (linha ~182: `templateVersion: orc.pdf_template_version ?? 1`)

### Phase/requirement source
- `.planning/ROADMAP.md` § Phase 22 — goal + 3 success criteria
- `.planning/REQUIREMENTS.md` — PDF-03
- `.planning/phases/20-fluxos-magn-ticos/20-CONTEXT.md` — inferência do tipo de sistema via `produto.sistema`
- `.planning/phases/21-system-mold-valida-o-reuso/21-CONTEXT.md` — `fita_modular`, metragem derivada

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/pdfTemplates/v2.ts` helpers: `esc`, `chip(text, variant)`, `thumb(url)`, `agruparPorLocal`, `construirDescricaoRica`, `formatarMoeda` — reusar no v3 para manter consistência visual.
- `buildAtributosMap` em `gerarPdfHtml.ts` — batch lookup de atributos por código; precisa ser estendido para incluir os códigos de `composicao[]` (hoje só varre `luminarias`/`sistemas[].fita/driver/perfil`).
- Funções de cálculo em `orcamento.ts`: `calcularSubtotalComposicao`, `calcularCargaComposicao`, `calcularMetragemModulosDifusos` — alimentam preço e resumo técnico do bloco.

### Established Patterns
- Router de PDF por `templateVersion` (default 2 no writer; leitor coage NULL→1). v3 segue o mesmo padrão aditivo.
- v2 monta HTML por blocos (Ambiente → Local → Sistema/Tabela) com CSS inline; v3 adiciona um bloco de composto dentro do ambiente.
- Preços/atributos são snapshot — o PDF lê do snapshot do orçamento, com enriquecimento opcional via `product_variants`.

### Integration Points
- `gerarOrcamentoHtml` (router) — adicionar branch v3.
- `blocoAmbiente` no v2 renderiza `amb.luminarias` via `rowLuminaria` (que hoje ignora `composicao`) — o v3 precisa, para luminárias com `composicao?.length`, renderizar o bloco composto em vez da linha simples.
- `Step3Revisao` (writer de `pdf_template_version`) e `OrcamentoDetalhe` (reader) — ajustar para persistir/ler a versão 3 condicionalmente.

</code_context>

<specifics>
## Specific Ideas

- Prévias aprovadas durante a discussão (ver DISCUSSION-LOG): bloco inline "Sistema Composto N — SYSTEM MOLD" com trilho no topo, sub-linhas indentadas (módulo / fita / driver), chips técnicos por papel e linha "Subtotal do sistema".
- Resumo do sistema no topo/rodapé do bloco: "36W total · fita 0,8m" (carga + metragem quando aplicável).

</specifics>

<deferred>
## Deferred Ideas

- PDF vetorial (substituir rasterização html2canvas) — backlog Phase 999.1, marco próprio.
- Redesign estético do PDF / "foto da fita no Resumo de Fitas" (todos de UI antigos) — não pertencem ao escopo travado de compostos; revisitar em marco de PDF/estética.
- Seção dedicada "Sistemas Compostos" consolidada no fim — rejeitada em favor do inline (D-01); registrada caso o cliente peça uma visão consolidada no futuro.

</deferred>

---

*Phase: 22-pdf-v3-sistemas-compostos*
*Context gathered: 2026-06-17*
