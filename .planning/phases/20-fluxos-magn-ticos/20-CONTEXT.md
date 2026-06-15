# Phase 20: Fluxos Magnéticos - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A camada de **UI de montagem** dos sistemas compostos, em cima da fundação da Phase 19 (`luminarias[].composicao?`, `REGRAS_COMPOSICAO`, tabela vazia, CAT-03). O colaborador monta **MAGNETO 48V** e **TINY MAGNETO 24V** dentro do wizard (Step 2): adiciona o trilho, adiciona módulos com carga derivada automaticamente, recebe recomendação de driver com botão "aplicar", e vê um checklist de componentes obrigatórios por família.

**Decisão estrutural da fase (product-first):** o AmbienteCard é **reorganizado** — as abas Luminárias/Sistemas dão lugar a **uma busca product-first única + lista única** de itens. O colaborador busca o produto ("spot", "fita", "trilho magneto", "tiny") e o sistema **detecta o tipo automaticamente** pelo `sistema`/`tipo_produto` do produto âncora, abrindo o fluxo certo. **Não há seletor de tipo manual** (SIST-05 reescrito).

**Fora de escopo (Phase 21+):** SYSTEM MOLD / modular (SIST-03), aviso bloqueante Step 2→3 (VAL-01), duplicar composto entre ambientes (DUP-01), PDF v3 (PDF-03). O modular entra na *taxonomia de detecção* (a busca reconhece perfil modular) mas a **montagem** modular é Phase 21.

</domain>

<decisions>
## Implementation Decisions

### Arquitetura de entrada — product-first puro (espinho da fase)
- **D-01:** **Busca product-first é o único ponto de entrada.** O AmbienteCard deixa de ter abas Luminárias/Sistemas e passa a ter uma busca única + lista única do ambiente. O colaborador busca o produto; o sistema lê `product.sistema` / `tipo_produto` e **roteia automaticamente**. Sem chips, sem galeria, sem seletor de categoria — o usuário (vendedor/projetista) já conhece as famílias; descoberta não é problema deste usuário (decisão explícita do Lenny: não resolver problema que talvez não exista).
- **D-02:** **Roteamento de detecção** (a partir do produto âncora):
  - luminária avulsa (spot/plafon/pendente) → **item simples** em `luminarias[]` (sem `composicao`).
  - fita LED → **`SistemaIluminacao` em `sistemas[]`** — o **card e o cálculo atuais de Fita Padrão, byte-idênticos**. Só o ponto de entrada muda (busca em vez de "+ Adicionar sistema").
  - trilho MAGNETO 48V (`sistema='magneto_48v'`) → inicia composição em `luminarias[].composicao[]`.
  - trilho TINY 24V (`sistema='tiny_magneto'`) → inicia composição.
  - perfil modular → reconhecido pela detecção, mas montagem é Phase 21.
- **D-03:** **Fallback gracioso, nunca interrompe.** Dado correto → abre a composição certa automaticamente. Dado sujo/ausente (`sistema`/`tipo_produto` faltando) → entra como **item simples** + ação manual **"converter em sistema"**. **Nunca pergunta** "isto é um trilho?" — em product-first a responsabilidade de identificar o fluxo é do sistema, não do usuário.
- **D-04:** **Busca global ancora; card monta.** A busca global só cria a **âncora** (item simples OU início de composição). Os **filhos** — módulos, conector, driver — são adicionados **dentro do card da composição** (via "+ módulo" próprio, atalhos do checklist, painel de driver). Resolve por construção a ambiguidade de ordem (módulo antes do trilho) e de **múltiplas composições da mesma família** no mesmo ambiente.

### SIST-05 reescrito (seletor de tipo removido por design)
- **D-05:** A SIST-05 e o critério de sucesso #1 da Phase 20 foram **reescritos** no ROADMAP e no REQUIREMENTS: de "o colaborador vê/escolhe o seletor de tipo" para "o colaborador adiciona por busca única e o sistema detecta automaticamente o tipo". O seletor de tipo está **oficialmente removido**. Um badge informativo do tipo detectado no card é bem-vindo, mas é **informativo, não um requisito** criado pra preservar a letra antiga.

### Carga & driver (DRV-01/02)
- **D-06:** **Carga total derivada automaticamente** de `Σ(módulo.potenciaW × quantidade)` dos módulos da composição (`potenciaW` é snapshot do catálogo no add-time, D-03 da Phase 19). Sem entrada manual de carga.
- **D-07:** **Painel de recomendação de driver dentro do card**, com botão **"aplicar"** (promove `analisarMagneto48V` de aviso → ação). Buckets: **48V → LM2343 (100W) / LM2344 (200W)** com margem **×1.05**; **24V → menor driver compatível** do catálogo (drivers 24V com `potencia ≥ carga×1.05`, escolher a menor). "Aplicar" preenche o driver da composição num clique; o colaborador **pode revisar/sobrescrever** depois — nunca silencioso nem irreversível.
- **D-08:** **Carga > 200W (48V):** o painel **avisa que excede a capacidade de um único driver e recomenda dividir em N circuitos/drivers** — **NÃO auto-insere** a combinação. A divisão física do trilho e a distribuição dos módulos é decisão de projeto (onde cortar o trilho); o sistema sinaliza a necessidade técnica mas deixa a montagem final com o vendedor. Coerente com "não agir silenciosamente em decisões estruturais".

### Checklist de obrigatórios (COMP-01/02)
- **D-09:** O checklist lê **`REGRAS_COMPOSICAO[sistema]`** (do código, Phase 19/D-07 — funciona com a tabela `produto_composicao` vazia). Marca presença/ausência dos obrigatórios por família, **dentro do card** da composição. Não-bloqueante nesta fase (o aviso bloqueante ao avançar Step 2→3 é VAL-01, Phase 21).
- **D-10:** **TINY — validação por compatibilidade técnica, não cor.** O requisito de conector é satisfeito quando existe **LM3168 (preto) OU LM3169 (branco)** — são tecnicamente equivalentes. O checklist **não acusa falta** por causa da cor. O atalho "adicionar" usa um **default LM3168**; o vendedor troca pra LM3169 depois se quiser. MAGNETO 48V → conector único **LM2338**.
- **D-11:** **Kit de fixação LM2987** é obrigatório **apenas para a versão embutir** do trilho (`REGRAS_COMPOSICAO.kitFixacaoEmbutir`). A detecção de "é embutir?" sai do SKU/descrição do trilho âncora.

### Voltage lock (COMP-03)
- **D-12:** **Lock por construção, não por validação posterior.** A voltagem é **inferida do trilho âncora** (`sistema='magneto_48v'` → 48V) e a composição **nasce travada**. Dentro de uma composição 48V, a **busca de driver só retorna drivers 48V** — driver de outra voltagem nem aparece. Sem toast de erro: o lock é impossível de violar pela própria UI. Este princípio de **"busca escopada ao contexto"** se estende ao card todo (busca de módulos → módulos da família; atalho de conector → conector da família).

### Claude's Discretion
- Mecânica fina da camada de apresentação da lista única (ordenação de `luminarias[]` + `sistemas[]` mesclados na UI; os arrays subjacentes permanecem separados e intactos).
- Forma exata do badge informativo de tipo no card; layout do painel de driver e do checklist (compor primitivos shadcn existentes).
- Como o painel de driver re-reflete mudança de carga após "aplicar" (recomendação é sempre advisory; default: re-sinaliza se o driver aplicado ficar subdimensionado depois de mexer nos módulos).
- `papel` exato do driver aplicado no `composicao[]` (vocabulário D-05 da Phase 19: `driver_recomendado` / `driver_obrigatorio`).
- Detecção precisa de "embutir" (regex em descrição vs flag de catálogo).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisões e fundação desta fase
- `.planning/phases/19-funda-o-compostos/19-CONTEXT.md` — D-01 a D-09 da Phase 19 (modelo de dados `composicao[]`, `REGRAS_COMPOSICAO` no código, snapshot autocontido, tabela não é ponto de falha). **Pré-requisito direto.**
- `.planning/PROJECT.md` §"Key Decisions" — D-01 (compostos em `luminarias[].composicao?`, 5 calc sites de Fita Padrão intocados).
- `.planning/research/ARCHITECTURE.md` — data model `ItemComposicao`, camada de cálculo, **Anti-Patterns** (composto como `SistemaIluminacao` = errado; alterar calc global = errado; bloquear em dado da tabela = errado).
- `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md` — escopo MVP de compostos, armadilhas, stack.

### Requisitos & escopo (texto JÁ ajustado nesta sessão)
- `.planning/ROADMAP.md` §"Phase 20: Fluxos Magnéticos" — Goal + Success Criteria 1-6 (critério #1 reescrito para detecção product-first).
- `.planning/REQUIREMENTS.md` — SIST-05 (reescrito, product-first), SIST-01/02, COMP-01/02/03, DRV-01/02. "Out of Scope (v1.3)" define limites (sem BOM genérico, sem multi-voltagem).

### Código a estender (full paths)
- `src/components/AmbienteCard.tsx` — **alvo principal**: abas Luminárias/Sistemas → busca product-first única + lista única + cards de composição. Hoje: `addLuminaria`/`addSistema`/`activeTab` (~654 linhas). `analisarMagneto48V` já importado (vira painel DRV-02).
- `src/components/Step2Ambientes.tsx` — container dos AmbienteCard.
- `src/components/ProdutoAutocomplete.tsx` — a busca de produto (base da busca product-first e das buscas escopadas dentro do card).
- `src/hooks/useProdutoSearch.ts` — `ProdutoFiltro` (já tem `'conector'`/`'kit_fixacao'` da CAT-03) + query builder; base do roteamento de detecção e da busca escopada por voltagem/família.
- `src/types/orcamento.ts` — `ItemComposicao` (43), `composicao?` em `ItemLuminaria` (36), `REGRAS_COMPOSICAO` (150), `calcularSubtotalComposicao` (286), `analisarMagneto48V` (317), `MARGEM_SEGURANCA_DRIVER` (144). Onde a lógica de carga/driver/checklist se apoia.

### Os 5 calc sites que NÃO podem ser alterados (regressão Fita Padrão — herdado da Phase 19)
- `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita` (em `src/types/orcamento.ts`) + `isSistemaVazio` (em `src/lib/pdfTemplates/v2.ts`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`analisarMagneto48V` (orcamento.ts:317)** — já calcula carga total, driver recomendado (LM2343/LM2344 ×1.05), e detecta conector/driver presentes. Base direta do painel DRV-02 e do checklist 48V; "aplicar" promove de aviso → ação.
- **`REGRAS_COMPOSICAO` (orcamento.ts:150)** — magneto_48v→`['LM2338']`+kit `LM2987`; tiny_magneto→`['LM3168','LM3169']`+kit `LM2987`. Fonte do checklist (COMP-01).
- **`ItemComposicao` + `calcularSubtotalComposicao` (orcamento.ts:43,286)** — modelo de dados e cálculo de subtotal dos compostos já prontos da Phase 19. `potenciaW`/`comprimento` opcionais já no shape.
- **`ProdutoAutocomplete` + `useProdutoSearch`** — busca já existe; CAT-03 já adicionou filtros `'conector'`/`'kit_fixacao'`. Reaproveitar para a busca escopada (voltagem/família) dentro do card.
- **Card de Fita Padrão (`sistemas[]` em AmbienteCard)** — **intocado**; só passa a ser alcançado via busca.

### Established Patterns
- **Snapshot autocontido** — preço/descrição/`potenciaW`/`comprimento` congelados no add-time. Driver/conector adicionados seguem o mesmo.
- **Detecção via colunas existentes** — `product_variants.sistema` (`'magneto_48v'|'tiny_magneto'|'s_mode'`), `tipo_produto`, `tensao`, `potencia_watts`, `familia_perfil`. **Nenhuma coluna nova necessária.**
- **`luminarias[]` e `sistemas[]` permanecem arrays separados** — a "lista única" é camada de apresentação; snapshots antigos e PDF não mudam.

### Integration Points
- `src/components/AmbienteCard.tsx` — reorganização da entrada + cards de composição (montagem, módulos, driver, checklist, voltage lock).
- `src/hooks/useProdutoSearch.ts` / `ProdutoAutocomplete.tsx` — roteamento de detecção + buscas escopadas.
- `src/types/orcamento.ts` — possível helper de detecção de tipo a partir do produto, helper de recomendação de driver 24V (menor compatível), e leitura de `REGRAS_COMPOSICAO` no validador do checklist. **Não tocar os 5 calc sites.**

</code_context>

<specifics>
## Specific Ideas

- **"A melhor taxonomia é nenhuma."** O usuário é vendedor/projetista que conhece as famílias — ele pensa em **produto**, não em categoria. Forçar escolha de categoria (Luminária/Sistema/Fita/MAGNETO) é redundante com o que o catálogo já sabe. (Lenny, 2026-06-15.)
- **"Não resolver problema que talvez não exista."** Recusa explícita de chips/galeria/seletor de descoberta — só adicionar se observarmos problema de uso real depois.
- **"Lock por construção, não por validação posterior."** Preferência forte por filtrar opções inválidas (busca escopada) em vez de mostrar e bloquear com erro. Vale pra voltagem, módulos e conector.
- **"Não agir silenciosamente em decisões estruturais."** >200W não auto-insere drivers; a divisão de circuito é decisão de projeto do vendedor.
- **Fita Padrão intocável** — princípio herdado: o cálculo da fita não muda em nenhum cenário; só o ponto de entrada unifica.

</specifics>

<deferred>
## Deferred Ideas

- **Elementos de descoberta** (chips de família, galeria visual de tipos, badge prominente) — só se um problema de uso real aparecer pós-lançamento (Lenny, "não resolver problema que talvez não exista").
- **Montagem SYSTEM MOLD / modular (SIST-03)** — Phase 21. A detecção product-first reconhece o perfil modular; a montagem (módulos difusos + fita derivada de Σ comprimento×qtd) é Phase 21.
- **Aviso bloqueante Step 2→3 com sistema incompleto (VAL-01)** — Phase 21. Nesta fase o checklist é informativo/não-bloqueante.
- **Duplicar sistema composto entre ambientes (DUP-01)** — Phase 21.
- **PDF v3 — seção de compostos (PDF-03)** — Phase 22.

### Reviewed Todos (not folded)
- **PDF zuado — input pra Phase 5 (PDF Redesign)** — escopo de PDF, não Phase 20. Casou só por keyword fraca.
- **Mostrar foto da fita no "Resumo de Fitas" do PDF** — escopo de PDF (Phase 22).
- **PDF orçamento estética ruim** — escopo de PDF.

</deferred>

---

*Phase: 20-fluxos-magn-ticos*
*Context gathered: 2026-06-15*
