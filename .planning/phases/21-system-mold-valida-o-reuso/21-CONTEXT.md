# Phase 21: SYSTEM MOLD + Validação & Reuso - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Três frentes em cima da fundação de compostos (Phase 19) e da UI de montagem (Phase 20):

1. **SIST-03 — Montagem SYSTEM MOLD (modular).** O colaborador ancora um **perfil modular** e adiciona **módulos difusos "PARA FITA LED"** (que abrigam fita LED). A **metragem de fita é derivada automaticamente** de `Σ(comprimento × qtd)` dos módulos difusos. É o terceiro fluxo composto, ao lado de MAGNETO 48V e TINY 24V da Phase 20 — mesma arquitetura `luminarias[].composicao?`, mesmo card de composição.
2. **VAL-01 — Aviso não-bloqueante Step 2→3.** Estende o advisory que **já existe** no `Step2Ambientes.handleNext` para incluir condições de **composto incompleto** (composto magnético sem driver, composto sem conector obrigatório, SYSTEM MOLD sem fita).
3. **DUP-01 — Duplicar composto.** Duplicar um sistema composto inteiro (trilho/perfil + módulos + driver + conectores) **para um ambiente escolhido**, com novos UUIDs em toda a árvore.

**Fora de escopo:** PDF v3 / seção de compostos (PDF-03 → Phase 22). Módulos concentrados (spots com watts) do SYSTEM MOLD não fazem parte do fluxo principal de derivação de fita (ver Claude's Discretion). Sem multi-voltagem, sem BOM genérico (herdado v1.3).

</domain>

<decisions>
## Implementation Decisions

### SYSTEM MOLD — fita & driver derivados (SIST-03)
- **D-01:** **Deriva metragem + botão "Adicionar fita".** Ao montar perfil modular + módulos difusos, o card calcula e exibe a metragem necessária (`Σ(comprimento × qtd)` dos difusos) e oferece um botão **"Adicionar fita"**. Ao clicar, abre a **busca de fita**; o vendedor **escolhe o SKU** (cor/temperatura/voltagem são decisões de projeto — nunca auto-escolhidas), a fita entra na composição **com a metragem já pré-preenchida**, e dispara a **recomendação de driver** reaproveitando o fluxo de Fita Padrão (`buscarDriverSugerido(voltagem, wm, metragem)`).
  - **Rejeitado** "só mostrar metragem" (perde a integração da composição) e "auto-criar fita+driver padrão" (presunçoso, contraria "não agir silenciosamente em decisão estrutural").
  - A recomendação de driver permanece **advisory** (o vendedor pode revisar/sobrescrever), igual aos fluxos magnéticos.

### Aviso não-bloqueante Step 2→3 (VAL-01)
- **D-02:** **Estende o advisory existente**, não cria fluxo novo. O `Step2Ambientes.handleNext` já monta `itensIncompletos: AdvisoryItem[]` e abre o `AlertDialog` "Alguns itens parecem incompletos" com botão de continuar (RES-05 / D-12..D-16). VAL-01 **adiciona novos tipos** de `AdvisoryItem` percorrendo `amb.luminarias` onde `l.composicao?.length`. **Permanece não-bloqueante** (o colaborador continua mesmo assim).
- **D-03:** **Condições que disparam o aviso** (as 3 marcadas):
  1. **Composto magnético sem driver aplicado** — composição com `sistema ∈ {magneto_48v, tiny_magneto}` e módulos, mas sem nenhum item `papel==='driver_recomendado'`.
  2. **Composto sem o conector obrigatório da família** — falta o conector de `REGRAS_COMPOSICAO[sistema].conectoresObrigatorios` (MAGNETO → LM2338; TINY → LM3168 **ou** LM3169, equivalência por D-10 da Phase 20).
  3. **SYSTEM MOLD sem fita adicionada** — perfil modular com módulos difusos (metragem derivada > 0) mas sem a fita LED na composição.
  - **Não dispara** por "trilho de embutir sem kit LM2987" (evita ruído — o kit costuma ser cotado à parte).

### Duplicar composto (DUP-01)
- **D-04:** **Botão "duplicar" no header do card da composição** (ao lado da lixeira/`Trash2`).
- **D-05:** **Destino = ambiente escolhido.** Ao clicar duplicar, abre um **seletor com os ambientes do orçamento**; o clone vai pro ambiente escolhido. Se só existe 1 ambiente, cai no mesmo. Atende direto o critério "para outro ambiente" (reusar montagem entre cômodos sem remontar).
- **D-06:** **Clone com novos UUIDs em toda a árvore** — o `ItemLuminaria` raiz e **todos** os `ItemComposicao` filhos recebem `crypto.randomUUID()` (consistente com `clonarSistema`/`clonarAmbiente` e a decisão v1.2 "clones com randomUUID em toda a árvore; cálculo agrupa por código, não por id"). Os valores somam corretamente no Step 3 porque o cálculo agrupa por código.

### Claude's Discretion
- **Entrada dos módulos (área não selecionada para discussão):**
  - **Comprimento do módulo difuso** vem do **catálogo** (parse do "132MM"/"264MM" da descrição → metros, gravado como snapshot em `ItemComposicao.comprimento` no add-time), **editável** pelo colaborador. Coerente com "snapshot autocontido".
  - **Escopo difuso primeiro:** o fluxo SYSTEM MOLD desta fase cobre os **módulos difusos** (que derivam fita). Módulos **concentrados** (spots com `potencia_watts`, "PARA USO NO PERFIL MODULAR") **não** são o foco — podem entrar como item simples; integração ao card modular fica como follow-up se necessário.
  - **Sem checklist obrigatório para modular** nesta fase — `REGRAS_COMPOSICAO` permanece com 2 famílias (magneto_48v, tiny_magneto). Conectores/kits do SYSTEM MOLD entram como componentes **opcionais**, não como obrigatórios marcados.
- Layout/copy exatos do painel de fita derivada, do seletor de ambiente de destino (dropdown vs dialog) e do texto dos novos `AdvisoryItem`.
- `papel` exato da fita/driver na composição modular (reusar vocabulário `driver_recomendado`; a fita pode usar um papel novo `fita_modular` ou reaproveitar a estrutura — decisão do planner).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisões e fundação (pré-requisitos diretos)
- `.planning/phases/19-funda-o-compostos/19-CONTEXT.md` — modelo `ItemComposicao` (com `comprimento?`/`potenciaW?` forward-complete para SYSTEM MOLD), `REGRAS_COMPOSICAO` no código, `calcularSubtotalComposicao`, snapshot autocontido.
- `.planning/phases/20-fluxos-magn-ticos/20-CONTEXT.md` — arquitetura product-first (busca ancora, card monta), detecção via `detectarTipoAncora`, voltage lock/escopo por construção, painel de driver advisory com "Aplicar", checklist `REGRAS_COMPOSICAO`.
- `.planning/PROJECT.md` §"Key Decisions" — compostos em `luminarias[].composicao?`, 5 calc sites de Fita Padrão **intocados**.

### Requisitos & escopo
- `.planning/ROADMAP.md` §"Phase 21: SYSTEM MOLD + Validação & Reuso" — Goal + 3 Success Criteria.
- `.planning/REQUIREMENTS.md` — SIST-03 (linha 18), VAL-01 (linha 33), DUP-01 (linha 41).

### Código a estender (full paths)
- `src/types/orcamento.ts` — `ItemComposicao` (`comprimento?` já existe, ~53), `detectarTipoAncora` (~173, já retorna `'modular'` para `s_mode`), `REGRAS_COMPOSICAO` (~150), `calcularCargaComposicao`/`calcularSubtotalComposicao`, helpers de driver. **Provável novo helper** `calcularMetragemModulosDifusos(composicao)` = `Σ(comprimento × qtd)`. **NÃO tocar os 5 calc sites de Fita Padrão.**
- `src/components/ComposicaoCard.tsx` — card de composição (Phase 20). Estender para o fluxo modular (painel de fita derivada + "Adicionar fita") e adicionar **botão duplicar** no header.
- `src/components/AmbienteCard.tsx` — `handleSelectProdutoGlobal` (~324): a rota `'modular'` hoje cai em "item simples"; passa a **iniciar composição modular**. Lógica de duplicação de composto (clonar `ItemLuminaria` com `composicao[]` → ambiente escolhido) — precisa orquestrar entre ambientes (provável subir pro `Step2Ambientes`).
- `src/components/Step2Ambientes.tsx` — `handleNext` (~70) e o `AlertDialog` de advisory (~196): **estender** `itensIncompletos` com as 3 condições de composto (D-03). É o dono dos ambientes → bom lugar para orquestrar o destino da duplicação (D-05).
- `src/hooks/useProdutoSearch.ts` / `src/components/ProdutoAutocomplete.tsx` — busca de fita ("Adicionar fita") e detecção do perfil modular.
- `src/types/orcamento.ts` — `clonarSistema`/`clonarAmbiente` como referência do padrão de clone com novos UUIDs.

### Os 5 calc sites que NÃO podem ser alterados (regressão Fita Padrão)
- `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita` (`src/types/orcamento.ts`) + `isSistemaVazio` (`src/lib/pdfTemplates/v2.ts`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Advisory existente (`Step2Ambientes.handleNext` + `AlertDialog` "Alguns itens parecem incompletos", RES-05)** — VAL-01 só estende `itensIncompletos: AdvisoryItem[]`. Tipos atuais: `fita-sem-driver`, `driver-sem-fita`, `perfil-sem-fita`, `peca-sem-lampada`. Adicionar tipos de composto.
- **`ComposicaoCard` (Phase 20)** — card de montagem com módulos, painel de driver advisory, checklist. Base direta do fluxo modular e do botão duplicar.
- **`buscarDriverSugerido` / fluxo de driver de Fita Padrão** — reaproveitado para a recomendação de driver da fita derivada do SYSTEM MOLD (D-01).
- **`clonarSistema` / `clonarAmbiente` (orcamento.ts)** — padrão de clone com `crypto.randomUUID()` em toda a árvore; base do clone de composto (D-06).
- **`ItemComposicao.comprimento?`** — campo opcional já existe (forward-complete da Phase 19) para a metragem por módulo difuso. **Nenhuma coluna/tipo novo necessário** no shape.

### Established Patterns
- **Compostos em `luminarias[].composicao?`** — array separado; "lista única" é só apresentação. Snapshots antigos e PDF não mudam.
- **Detecção via colunas existentes** + **snapshot autocontido** (preço/descrição/comprimento congelados no add-time).
- **Clones com `crypto.randomUUID()`; cálculo agrupa por código, não por id** (v1.2).

### Integration Points / Achado técnico (para o researcher/planner)
- **⚠ Os produtos SYSTEM MOLD têm `sistema = null` no catálogo** (verificado via MCP: ~72 produtos "SYSTEM MOLD 22 ...", todos `sistema=null`; difusos "PARA FITA LED" têm `tipo_produto='acessorio'`; concentrados têm `potencia_watts`). Como `detectarTipoAncora` roteia `'modular'` por `sistema_magnetico === 's_mode'`, **a detecção do perfil modular não funciona com os dados atuais**. Decisão para o planner (recomendação: **migration aditiva** marcando `sistema='s_mode'` nos perfis/módulos SYSTEM MOLD, no precedente CAT-03 da Phase 19; alternativa: detecção por descrição "SYSTEM MOLD"/"PERFIL MODULAR"). Migration é mais consistente com a arquitetura de detecção da Phase 20.
- O **comprimento** do módulo difuso está embutido na descrição ("132MM", "264MM") — parse em metros como snapshot.

</code_context>

<specifics>
## Specific Ideas

- **"Cor/temperatura/SKU da fita são decisões de projeto"** — o sistema deriva a metragem e oferece a busca, mas **nunca escolhe o SKU da fita** automaticamente (Lenny, 2026-06-16).
- **"Não agir silenciosamente em decisão estrutural"** (herdado Phase 20) — vale para fita e driver do SYSTEM MOLD: deriva e sugere, mas o vendedor confirma.
- **Aviso não-bloqueante** — VAL-01 nunca impede o avanço; só informa. Reaproveita o dialog existente (Lenny escolheu estender, não criar).
- **Duplicação como reuso entre cômodos** — o ganho é não remontar o composto em cada ambiente; por isso o destino é um ambiente escolhido, não o mesmo (Lenny, 2026-06-16).

</specifics>

<deferred>
## Deferred Ideas

- **Módulos concentrados (spots) do SYSTEM MOLD integrados ao card modular** — fora do fluxo principal de derivação de fita desta fase; podem entrar como item simples por enquanto.
- **Checklist de obrigatórios para o modular** (`REGRAS_COMPOSICAO['s_mode']`) — não nesta fase; conectores/kits SYSTEM MOLD são opcionais.
- **PDF v3 — seção de Sistemas Compostos (PDF-03)** — Phase 22.
- **Mover (não duplicar) composto entre ambientes** — não pedido; só duplicação.

</deferred>

---

*Phase: 21-system-mold-valida-o-reuso*
*Context gathered: 2026-06-16*
