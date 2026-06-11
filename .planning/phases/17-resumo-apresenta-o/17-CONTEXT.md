# Phase 17: Resumo & Apresentação - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Step 3 e o Resumo Global apresentam fitas, perfis e drivers de forma coerente — sem duplicação confusa, com o LOCAL visível (breakdown por "Ambiente — Local") e drivers por ambiente — **tanto na tela (Step3Revisao) quanto no PDF do cliente (pdfTemplates/v2)**. Cobre **RES-01, RES-02, RES-03, RES-05**.

**Fora de escopo (movido para Phase 18):** **RES-04 — Duplicar/reusar sistema em outro ambiente.** Decisão do usuário: pertence à família "duplicação" junto de UX-04 (duplicar ambiente inteiro); planejar juntas. ROADMAP já atualizado (RES-04 → Phase 18; cobertura v1.2 segue 18/18).

**Fora de escopo (outras fases):** redesign estético do PDF (deferido perpetuamente); checklist visual completo pré-PDF (Phase 18, UX-05 — RES-05 aqui é só o aviso na transição Step 2 → Step 3).
</domain>

<decisions>
## Implementation Decisions

### Fita — onde "vive" + dedup (RES-02)
- **D-01:** **Resumo Global de Fitas = fonte oficial de compra** (preço, quantidade de rolos, consolidação, otimização cross-projeto). A linha de fita no card do ambiente é **referência contextual explícita** — deve deixar claro que aquela fita já está contabilizada no Resumo de Fitas (ex.: rótulo "incluída no Resumo de Fitas"), sem repetir preço. Elimina a sensação de duplicação do UAT #17.
- **D-02:** A interface precisa responder sem ambiguidade duas perguntas: (1) **em quais ambientes/locais** essa fita está sendo usada; (2) **onde** ela está sendo contabilizada no orçamento. Critério de sucesso da apresentação.
- **D-03:** Manter a otimização global de rolos 5/10/15m (valor real) — **não** quebrar o agrupamento por código para "deduplicar". A dedup é resolvida por clareza de papéis (global=compra, ambiente=referência), não removendo o agrupamento.

### Fita — LOCAL no resumo global (RES-01)
- **D-04:** **Coluna/área LOCAL com breakdown por local** dentro da linha agrupada por código. Mantém uma única linha por código de fita (rolos otimizados no nível do projeto) e adiciona o detalhamento da metragem por local. Exemplo: `SANCA 12m · MARCENARIA 8m → Total 20m → rolos otimizados`. Torna o total explicável sem perder a consolidação.
- **D-05:** O identificador de LOCAL exibido é **"Ambiente — Local" combinado** quando há `sistema.local` (ex.: `Sala — Sanca`, `Cozinha — Marcenaria`, `Quarto Casal — Rasgo`); **apenas o nome do ambiente** quando `local` é vazio (ex.: `Sala`, `Lavabo`). Identificação inequívoca em projetos com vários ambientes usando o mesmo tipo de local; alinhado com a hierarquia Ambiente → Local já usada no PDF.
- **D-06:** A mudança vai na função de dados compartilhada `calcularRolosPorGrupo` (`src/types/orcamento.ts:380`), que precisa passar a carregar o breakdown por local. Como tela (`Step3Revisao`) e PDF (`blocoResumoFitas`) consomem a mesma função, o LOCAL breakdown flui para ambos automaticamente. **Constraint:** mudança aditiva no tipo `GrupoFita` — não quebrar snapshots/orçamentos antigos nem o PDF v1/v2.

### Fita — escopo PDF (RES-01/02)
- **D-07:** **Aplicar LOCAL breakdown + foto da fita no `blocoResumoFitas` do PDF; manter a fita inline por sistema como está.** Preservar o layout v2 aprovado e minimizar risco visual. Filosofia idêntica à tela: Resumo de Fitas = compra/consolidação; fita inline no sistema = referência contextual.
- **D-08 (FOLD do TODO):** Incluir a **foto/thumbnail da fita no Resumo de Fitas do PDF** (TODO `2026-06-10-foto-da-fita-no-resumo-de-fitas-pdf.md`). O `blocoResumoFitas` hoje não mostra imagem; `GrupoFita` precisa carregar `imagemUrl` da fita (campo `sis.fita.imagemUrl` já existe).
- **D-09:** Dedup mais agressivo no PDF (remover preço da fita inline) foi **considerado e adiado** — só se, depois de ver o resultado, ainda houver confusão visual evidente. Nesta fase prioriza-se ganho de clareza sem mexer significativamente no layout aprovado.

### Drivers por ambiente vs bloco global (RES-03)
- **D-10:** **Drivers por ambiente são a fonte oficial** de compra/apresentação (já aparecem como linha em cada ambiente na tela e inline por sistema no PDF — o PDF NÃO tem bloco global de drivers, então RES-03 já está satisfeito no PDF). O problema do UAT #18 é o bloco global competir visualmente.
- **D-11:** O **"Resumo Global de Drivers" (Step3Revisao.tsx:755) é rebaixado a ferramenta de análise interna**: claramente identificado como otimização/análise (consumo consolidado vs soma por ambiente, economia potencial), visualmente secundário, **colapsável/opcional**, sem aparência de item que será comprado ou apresentado ao cliente. Preserva o insight operacional de economia cross-ambiente sem repetir a confusão. **Não** remover (o insight tem valor); **não** levar ao PDF do cliente.

### Aviso de item faltando ao avançar (RES-05)
- **D-12:** **Advisory + "avançar mesmo assim" (NÃO bloqueante).** Distinção mantida da Phase 16: metragem inválida = erro estrutural → bloqueia (Phase 16 D-01/D-02, continua valendo); sistema parcialmente preenchido = potencialmente intencional (ex.: cliente fornece o próprio driver/lâmpada) → aviso forte, não bloqueio. Coerente com a filosofia v1.2 (tornar inconsistência visível · não bloquear indevidamente).
- **D-13:** Comportamento: ao avançar Step 2 → Step 3, **listar claramente os sistemas/itens suspeitos**, explicar o que está faltando, permitir revisar ou continuar conscientemente, e **registrar visualmente que o colaborador decidiu prosseguir** mesmo com o aviso.
- **D-14:** **Gatilhos (todos selecionados):** (1) fita sem driver (fita preenchida, `driver.codigo` vazio); (2) driver sem fita (driver preenchido, fita vazia); (3) perfil sem fita (sistema com perfil mas sem fita LED — distinto do "vazio" da Phase 16, que tem tudo vazio); (4) peça/luminária sem lâmpada esperada (UAT #4).
- **D-15 (CHECKPOINT de pesquisa):** O gatilho "peça/luminária sem lâmpada" **requer investigação do modelo de dados** — como identificar que uma luminária/peça "espera lâmpada" (atributo do produto? categoria? campo na ImportMaster?). A pesquisa DEVE apresentar a regra de detecção antes de implementar; se não houver dado confiável, sinalizar antes de inventar heurística.
- **D-16:** Reaproveitar o **mesmo ponto de saída** do gate da Phase 16 (`Step2Ambientes`, antes de `onNext()`) — não criar um segundo caminho de validação. Ordem de severidade no gate: bloqueio de metragem (Phase 16) → remoção de vazio (Phase 16) → aviso advisory de incompleto (RES-05).

### Claude's Discretion
- Forma visual exata do rótulo "incluída no Resumo de Fitas" na fita do card do ambiente (D-01) e do breakdown por local na tabela (D-04) — desde que responda D-02.
- Mecânica de colapso/rotulagem do bloco global de drivers (D-11).
- Copy exato do aviso advisory de RES-05 e do registro visual de "prosseguiu mesmo assim" (D-13).
- Estrutura aditiva exata do tipo `GrupoFita` para carregar breakdown por local + `imagemUrl` (D-06/D-08).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos & roadmap
- `.planning/REQUIREMENTS.md` — RES-01 (LOCAL no resumo), RES-02 (dedup fita), RES-03 (drivers por ambiente), RES-05 (aviso item faltando); mapa UAT: #5 LOCAL, #17 fita duplicada, #18 drivers global, #4 lâmpada faltando. **Nota:** RES-04 movido para Phase 18.
- `.planning/ROADMAP.md` §"Phase 17: Resumo & Apresentação" — goal + 4 success criteria (atualizado: RES-04 saiu)

### Código a tocar — dados (compartilhado tela + PDF)
- `src/types/orcamento.ts:380` — `calcularRolosPorGrupo` + interface `GrupoFita` (L368): adicionar breakdown por local + `imagemUrl` (D-04/D-06/D-08), aditivo
- `src/types/orcamento.ts:305` — `calcularDriversPorProjeto` + `ResumoDriverProjeto` (L292): consumido pelo bloco global rebaixado (D-11); já agrupa por código+voltagem (Phase 15 D-08)
- `src/types/orcamento.ts:88-89` — `SistemaIluminacao.local` (sub-área Sanca/Rasgo), `Ambiente.nome` (L97): fontes do "Ambiente — Local" (D-05)

### Código a tocar — tela (Step 3)
- `src/components/Step3Revisao.tsx:712-753` — Resumo Global de Fitas: coluna LOCAL breakdown (D-04/D-05), papel "compra" (D-01)
- `src/components/Step3Revisao.tsx:638-656` — linha de fita inline no card do ambiente: rótulo "referência / incluída no Resumo de Fitas" (D-01), hoje mostra "Global →" em L655
- `src/components/Step3Revisao.tsx:755-802` — Resumo Global de Drivers: rebaixar a análise interna colapsável (D-11)

### Código a tocar — PDF
- `src/lib/pdfTemplates/v2.ts:265` — `blocoResumoFitas`: adicionar LOCAL breakdown (vem de `calcularRolosPorGrupo`) + foto da fita (D-07/D-08). Hierarquia 5-níveis Doc → Ambiente → Local → Sistema → Componente já existe (L5, `agruparPorLocal` L71)
- `src/lib/pdfTemplates/v2.ts:126` — `rowFita`/blocoFita inline: **manter como está** (D-07); não tem bloco global de drivers (RES-03 já ok no PDF)

### Código a tocar — gate RES-05
- `src/components/Step2Ambientes.tsx` — `onNext()` (gate herdado da Phase 16): adicionar aviso advisory de incompleto antes de `onNext()` (D-16); wired em `src/pages/Index.tsx:192`

### Contexto de fases anteriores
- `.planning/phases/15-tens-o-valida-o/15-CONTEXT.md` — D-08 (driver grouping codigo+voltagem), D-09 (labeling voltagem no resumo), filosofia v1.2
- `.planning/phases/16-c-lculo-metragem/16-CONTEXT.md` — gate Step 2 → Step 3, distinção vazio (avisa+remove) × inválido (bloqueia); D-07 `isSistemaVazio` definição única; RES-05 estende o mesmo ponto de saída
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calcularRolosPorGrupo` (orcamento.ts:380) — função única consumida por tela E PDF; estendê-la com breakdown por local propaga RES-01 para os dois sem código duplicado.
- `agruparPorLocal` (pdfTemplates/v2.ts:71) — já agrupa sistemas por `sis.local` (null/"" → "Geral"); padrão de referência para a regra "Ambiente — Local" (D-05).
- `sis.fita.imagemUrl` (ItemFitaLED, orcamento.ts:64) — já existe; base da foto no Resumo de Fitas do PDF (D-08), reusa o helper `thumb()` do v2.ts.
- `ResumoDriverProjeto` (orcamento.ts:292) + bloco da tela (Step3 L755) — já calculados; RES-03 é só reapresentação visual (colapso/rótulo), sem mexer no cálculo.
- Gate de avanço da Phase 16 em `Step2Ambientes` antes de `onNext()` — ponto único de saída; RES-05 pendura nele (D-16).

### Established Patterns
- Hierarquia de apresentação do PDF: Doc → Ambiente → Local → Sistema → Componente (v2.ts:5). LOCAL já é cidadão de primeira classe no PDF; a tela é que não expõe LOCAL no resumo.
- Fita no card do ambiente já é "sem preço por ambiente" (subtotal = "Global →", Step3 L655) — a dedup é mais rotulagem/clareza do que remoção (D-01).
- Driver: `calcularQtdDrivers` por sistema = compra real por ambiente; `calcularDriversPorProjeto.qtdGlobal` = sugestão de otimização (não o pedido) — origem da confusão do UAT #18 (D-10/D-11).

### Integration Points
- `GrupoFita` é serializado? Verificar se o tipo aparece em snapshots — a extensão deve ser aditiva e opcional para não quebrar PDF v1/v2 de orçamentos antigos.
- Gate RES-05: mesma função de validação do Step 2 que a Phase 16; ordenar severidades (bloqueio metragem → remoção vazio → aviso advisory incompleto).
- Detecção "espera lâmpada" (D-15): cruzar com `useProdutoSearch`/ImportMaster para descobrir o atributo/categoria correto antes de implementar.
</code_context>

<specifics>
## Specific Ideas

- Exemplo literal do breakdown desejado pelo usuário: `SANCA 12m` / `MARCENARIA 8m` → `Total 20m` → quantidade de rolos otimizada (mantida no nível global).
- Formato literal do LOCAL: `Ambiente — Local` (ex.: `Sala — Sanca`, `Cozinha — Marcenaria`); só `Ambiente` quando sem local.
- Filosofia transversal v1.2 reafirmada: tornar inconsistência visível · sugerir o caminho correto · evitar bloqueios desnecessários para casos legítimos. RES-05 é aviso, não erro.
- Separação de responsabilidades do marco que o usuário quer preservada: **Phase 17 = apresentação/resumo/PDF/clareza**; **Phase 18 = produtividade/UX operacional/checklist/duplicação**. Por isso RES-04 foi para a Phase 18.
- Preferência do usuário por conservadorismo no PDF aprovado: melhorar leitura sem mexer significativamente no layout v2 (D-07/D-09).
</specifics>

<deferred>
## Deferred Ideas

- **RES-04 — Duplicar/reusar sistema em outro ambiente:** movido para **Phase 18** (junto de UX-04 duplicar ambiente; mesma família de duplicação/reaproveitamento). ROADMAP atualizado. Não é remoção de prioridade — é reagrupamento por responsabilidade.
- **Dedup mais agressivo no PDF** (remover preço da fita inline, deixando só o Resumo de Fitas como fonte): adiado (D-09); reabrir só se a confusão visual persistir após esta fase.

### Reviewed Todos (not folded)
- `2026-04-27-pdf-zuado-input-para-phase-5.md` ("PDF gerado tá zuado — input pra Phase 5 (PDF Redesign)") — redesign estético de PDF, não apresentação/resumo. Fora de escopo (deferido perpetuamente, igual nas fases 15/16).
- `2026-05-06-pdf-orcamento-estetica-ruim.md` ("PDF orçamento estética ruim") — idem, redesign de PDF. Fora de escopo.

### Folded Todos
- `2026-06-10-foto-da-fita-no-resumo-de-fitas-pdf.md` ("Mostrar foto da fita no Resumo de Fitas do PDF") — **folded em RES-01 (D-08)**: o `blocoResumoFitas` do PDF passa a exibir a foto da fita.

</deferred>

---

*Phase: 17-resumo-apresenta-o*
*Context gathered: 2026-06-11*
