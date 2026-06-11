# Phase 16: Cálculo & Metragem - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Nenhuma fita ou perfil some silenciosamente do orçamento como R$0 — a metragem é sempre exigida (bloqueio duro quando obrigatória e ausente), refletida automaticamente na descrição do perfil, e calculada respeitando as regras de passadas por família de perfil. Cobre **CALC-01, CALC-02, CALC-03**.

**Fora de escopo:** apresentação do Resumo Global / PDF (coluna LOCAL, deduplicação de fita, drivers por ambiente, duplicar sistema) — isso é a **Fase 17**. Esta fase garante que o *dado* (metragem, passadas, descrição) esteja correto e completo; como ele é exibido/agrupado é a próxima fase.
</domain>

<decisions>
## Implementation Decisions

### Metragem obrigatória & bloqueio (CALC-01)
- **D-01:** Metragem ausente é **dado obrigatório**, tratamento DIFERENTE da validação de voltagem da Fase 15. Voltagem divergente pode ser intencional (advisory/não-bloqueante); metragem faltando é inválida e **bloqueia**. A filosofia "não bloquear indevidamente" da Fase 15 NÃO se aplica aqui — aqui o bloqueio é devido.
- **D-02:** Marca **inline no card do sistema** (onde o colaborador edita) **E bloqueia o avanço** do Step 2 → Step 3 enquanto a metragem obrigatória estiver faltando. Pega o erro cedo, no lugar certo.
- **D-03:** Gatilho do bloqueio: sistema **com fita mas sem perfil** cuja `metragemManual` seja inválida. `null` (rascunho antigo, nunca preencheu) e `0` (preencheu zero) são tratados **igual** = "metragem inválida" → mesmo aviso, mesmo destaque, mesmo bloqueio. **Não** expor a diferença técnica null vs 0 ao usuário.
- **D-04:** Mesmo comportamento para **dado novo e rascunho antigo** — sem regra diferente por origem do dado. Rascunho antigo abre normalmente, sem crash, sem fix silencioso de dados (apenas marca + bloqueia até o colaborador preencher).
- **D-05:** Mensagem orientativa e específica, ex.: *"Informe uma metragem válida para este sistema antes de continuar."* — diz exatamente o que falta.

### Sistema totalmente vazio (avisar + remover, NÃO bloquear)
- **D-06:** Card de sistema **totalmente em branco** (sem fita, sem driver, sem perfil) é caso diferente de "metragem faltando". Ao avançar: **detectar, avisar claramente que será removido, remover ao continuar — sem bloquear**. Mantém o orçamento limpo sem a sensação de sumiço silencioso. (Distinção-chave: vazio → avisa+remove não-bloqueante; fita com metragem inválida → bloqueia.)
- **D-07:** Reconciliar com o `isSistemaVazio` que **já existe** em `src/lib/pdfTemplates/v2.ts:89` (usado para filtrar sistemas vazios do PDF). A definição de "vazio" deve ser **única/consistente** entre o gate do Step 2 e o filtro do PDF — não criar uma segunda regra divergente. Isso faz parte da disciplina do patch atômico dos sites de cálculo.

### Metragem na descrição do perfil (CALC-02)
- **D-08:** Metragem **embutida no texto da descrição** do perfil, formato `PERFIL X — 2,5m`. Como a descrição já percorre card (Step 2) → Resumo → PDF, a metragem aparece nos três **automaticamente**, sem implementação separada por tela (e sem invadir a apresentação da Fase 17).
- **D-09:** **Sufixo gerenciado pelo sistema.** Separar claramente texto livre do colaborador (ex.: `PERFIL EMBUTIR SALA`) do sufixo calculado (` — 2,5m`). Regra: o colaborador edita a descrição livremente; o sistema só **regenera o sufixo** quando `comprimentoPeca` ou `quantidade` mudam; a parte escrita manualmente **nunca** é apagada/sobrescrita. Resultado: `PERFIL EMBUTIR SALA — 2,5m`.
- **D-10:** A metragem do sufixo é derivada do comprimento real do perfil (`comprimentoPeca × quantidade`, conforme `calcularMetragemTotal`). Atualiza sozinha quando comprimento/quantidade mudam.

### Passadas editáveis + limite por família (CALC-03)
- **D-11:** **Sugere o padrão + permite manual** (mesma filosofia v1.2: sugerir por padrão, respeitar decisão manual, impedir só o inválido):
  - pré-selecionar `passadas_padrao` da família como sugestão inicial;
  - dropdown mostra **apenas opções válidas** para aquela família;
  - colaborador pode **alterar manualmente** para qualquer valor válido (inclui reduzir);
  - **bloquear apenas combinações inválidas** (ex.: 3 passadas em perfil que não é da família 50mm).
- **D-12:** Perfil da família **50mm (`light_50`)** aceita **até 3 passadas**. A sugestão automática deve refletir `passadas_padrao = 3` para essa família. Requer **migration de sync** `regras_compatibilidade_perfil` → `produtos.passadas_padrao` aplicada **ANTES** do unlock da UI (senão perfil 50mm fica sugerindo 1 em vez de 3). A migration vem antes de mexer no componente.
- **D-13:** NÃO sugerir passadas por consumo/metragem (opção considerada e rejeitada — mais complexa e tangencia o cálculo de driver). A sugestão sai do padrão da família, não de cálculo dinâmico.

### Patch atômico (constraint herdada do roadmap/STATE)
- **D-14:** As mudanças de cálculo tocam **5 sites simultaneamente** e NÃO devem ser divididas: `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita` (`src/types/orcamento.ts`) e `isSistemaVazio` (`src/lib/pdfTemplates/v2.ts`). Risco: fita com `wm=0`/metragem 0 sumindo do PDF silenciosamente se um site ficar inconsistente com os outros.

### Claude's Discretion
- Mecânica exata de como o gate do Step 2 (em `Step2Ambientes`) coleta e exibe os sistemas inválidos antes de chamar `onNext` (lista de erros, foco no primeiro, etc.).
- Forma visual do marcador inline de metragem inválida no card (badge/borda/texto) — desde que visível no card e atrelado ao bloqueio (D-02).
- Texto/copys exatos do aviso de remoção de sistema vazio (D-06) e do bloqueio de metragem (D-05).
- Estrutura da migration de sync de `passadas_padrao` (D-12), desde que idempotente, aditiva e aplicada antes do unlock da UI.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos & roadmap
- `.planning/REQUIREMENTS.md` — CALC-01 (L29), CALC-02 (L30), CALC-03 (L31); mapa UAT: metragem só-fita (L62), passadas travadas (L70), 50mm até 3 passadas (L71), perfil→descrição (L55)
- `.planning/ROADMAP.md` §"Phase 16: Cálculo & Metragem" (L54-65) — goal + 5 success criteria
- `.planning/STATE.md` §"Build Order & Key Constraints" — patch atômico (5 sites), migration antes da UI

### Código a tocar — cálculo (patch atômico, D-14)
- `src/types/orcamento.ts` — `calcularDemandaFita` (L126), `calcularConsumoW` (L143), `calcularQtdDrivers` (L156), `calcularSubtotalSistemaSemFita` (L234), `calcularMetragemTotal` (L121); tipos `SistemaIluminacao` (`metragemManual: number|null` L83, `passadasManual: 1|2|3` L84) e `ItemPerfil` (`comprimentoPeca: 1|2|3` L40, `quantidade`, `passadas: 1|2|3` L42)
- `src/lib/pdfTemplates/v2.ts` — `isSistemaVazio` (L89, usado no filtro L237); reconciliar definição única de "vazio" (D-07)

### Código a tocar — UI
- `src/components/Step2Ambientes.tsx` — gate de avanço: `onNext()` chamado em L39, wired em `src/pages/Index.tsx:192` (`onNext={() => setStep(3)}`). Bloqueio CALC-01 (D-02) e detecção/remoção de vazios (D-06) entram aqui, antes de `onNext()`.
- `src/components/AmbienteCard.tsx` — criação do sistema/perfil (`novoSistema` L72, `ItemPerfil` base L202, `descricao` L209); inputs de `comprimentoPeca`/`quantidade`/`passadas`; montagem do sufixo de metragem na descrição (D-08/D-09) e dropdown de passadas por família (D-11)

### Banco / migration (CALC-03)
- `supabase/migrations/20260319000002_regras_compatibilidade_perfil.sql` — origem das regras de passadas por família; base para a migration de sync `passadas_padrao` → `produtos` (D-12)
- `src/hooks/useProdutoSearch.ts` — já lê `passadas_padrao`/`familia_perfil` (referência para o consumo no front)

### Contexto de fases anteriores
- `.planning/phases/15-tens-o-valida-o/15-CONTEXT.md` — filosofia v1.2 (sugerir por padrão · respeitar manual · tornar inconsistência visível · não bloquear indevidamente); D-01 contrasta com ela deliberadamente
- Fase 14 (completa) — `tipo_produto`/`passadas_padrao` corrigidos no DB; pré-requisito da migration de sync D-12
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calcularMetragemTotal(perfil)` (orcamento.ts:121) = `comprimentoPeca × quantidade` — fonte da metragem do sufixo (D-10) e da demanda quando há perfil.
- `isSistemaVazio` (pdfTemplates/v2.ts:89) — já define "sistema vazio" para o PDF; centralizar/reusar para o gate do Step 2 (D-07).
- Combobox de passadas já existe no `AmbienteCard` (campo `passadas`/`passadasManual`) — estender para restringir por família + pré-selecionar padrão (D-11).
- `useProdutoSearch` já expõe `passadas_padrao` e `familia_perfil` — base para a regra por família sem nova query.

### Established Patterns
- `calcularDemandaFita` sem perfil = `(metragemManual || 0) * (passadasManual || 1)` (orcamento.ts:135) — o `|| 0` é exatamente a origem do "0m → R$0 silencioso" (CALC-01). O fix de validação acontece ANTES desse cálculo (no gate), não trocando o cálculo.
- Sistema novo nasce com `metragemManual: null, passadasManual: 1, perfil: null` (AmbienteCard:72) — por isso null é o estado inicial padrão a validar.
- Avanço de step é controlado em `Index.tsx` via `setStep`; `Step2Ambientes.onNext` é o ponto único de saída do Step 2.

### Integration Points
- Gate de validação: dentro de `Step2Ambientes` antes de `onNext()` — único caminho Step 2 → Step 3.
- Sufixo de metragem: montado/atualizado onde a descrição do perfil é composta e onde `comprimentoPeca`/`quantidade` mudam (AmbienteCard).
- Migration de `passadas_padrao`: aplicada via service role + `migration repair` (histórico de migrations diverge do repo — ver memória de migration divergente).
</code_context>

<specifics>
## Specific Ideas

- Distinção mental que o usuário quer preservada: **vazio** (card em branco → avisa + remove, não bloqueia) × **incompleto/inválido** (fita com metragem null/0 → bloqueia). Dois tratamentos diferentes, propositalmente.
- Formato literal do sufixo: `— 2,5m` (travessão + valor + "m"), anexado à descrição livre do colaborador.
- Mensagem de bloqueio sugerida pelo usuário: *"Informe uma metragem válida para este sistema antes de continuar."*
- Filosofia reafirmada para CALC-03: sugerir por padrão, respeitar decisão manual, impedir só o que é realmente inválido.
</specifics>

<deferred>
## Deferred Ideas

- Sugestão de passadas baseada em consumo/metragem (não só padrão da família) — considerada e rejeitada nesta fase (D-13); reabrir só se virar necessidade real.
- Apresentação do Resumo Global / PDF (coluna LOCAL, deduplicação de fita, drivers por ambiente, duplicar sistema) — **Fase 17** (RES-01..05).

### Reviewed Todos (not folded)
- "PDF gerado tá zuado — input pra Phase 5 (PDF Redesign)" — estética do PDF, não cálculo/metragem. Fora de escopo da Fase 16.
- "Mostrar foto da fita no Resumo de Fitas do PDF" — apresentação do Resumo, registrado para a Fase 17 (RES-01). Fora de escopo.
- "PDF orçamento estética ruim" — redesign de PDF, não cálculo. Fora de escopo.
</deferred>

---

*Phase: 16-c-lculo-metragem*
*Context gathered: 2026-06-11*
