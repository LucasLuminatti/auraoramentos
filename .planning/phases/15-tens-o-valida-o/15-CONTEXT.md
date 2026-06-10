# Phase 15: Tensão & Validação - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

O wizard guia o colaborador a escolher o driver certo automaticamente — inferindo voltagem a partir da fita, sugerindo um driver compatível, pré-filtrando o seletor e avisando em caso de divergência — e permite usar tensão diferente em cada ambiente sem bloqueio indevido. Cobre TENS-01, TENS-02, SIST-04, UX-02.

**Fora de escopo (v1.3):** montagem completa de sistemas compostos (TINY/MAGNETO/MODULAR) — seleção assistida de módulos/conectores/drivers como um sistema (SIST-01/02/03). Esta fase é orientação + validação, não montagem automática.
</domain>

<decisions>
## Implementation Decisions

### Sugestão + filtro de driver (UX-02 + TENS-01)
- **D-01:** Ao selecionar a fita → **pré-preencher um driver compatível sugerido E pré-filtrar** o seletor de driver para mostrar só os de voltagem compatível. Comportamento proativo, mas o colaborador continua podendo trocar por outro driver compatível.
- **D-02:** A regra de escolha do driver sugerido sai da **análise do catálogo real de drivers** (potências disponíveis por voltagem). Hipótese provável: "menor potência suficiente para cobrir o consumo da fita, com a margem de segurança". **CHECKPOINT (D-02a):** a pesquisa DEVE apresentar a Lenny, antes da implementação: (1) a regra exata de seleção; (2) a margem de segurança usada (`MARGEM_SEGURANCA_DRIVER` já existe); (3) exemplos reais com produtos do catálogo. A decisão vem dos dados, não de regra arbitrária — e o colaborador deve conseguir entender por que aquele driver foi sugerido.
- **D-03:** A sugestão **só preenche se o driver estiver vazio** — preserva escolha manual. Se a fita mudar e o driver ficar incompatível, o sistema **avisa claramente mas NÃO apaga/substitui** sem ação do usuário.

### Aviso de divergência de voltagem (TENS-01)
- **D-04:** **Badge inline persistente + toast.** Toast chama atenção no momento em que a divergência é criada; badge persistente no card do sistema permanece enquanto o problema existir; texto específico (ex.: "Voltagem incompatível: fita 24V e driver 12V"); o aviso **some automaticamente quando corrigido**.
- **D-05:** O aviso **NÃO bloqueia** o avanço pro Step 3 — só orienta. Coerente com a filosofia "sugerir por padrão, respeitar decisão manual, tornar inconsistência visível". Casos legítimos de prosseguir temporariamente com divergência são permitidos (checklist pré-PDF da Phase 18 reforça no fim).
- **Nota:** já existe um toast de "tensão incompatível" em AmbienteCard.tsx L137-149 com tom de bloqueio ("Selecione um driver de XV"). Reformular para o tom orientativo acima + adicionar o badge persistente.

### Advisory TINY 24V (SIST-04)
- **D-06:** **Toast + badge informativo, advisory puro** (sem montar sistema nem adicionar componentes automaticamente). Toast no momento da inclusão + badge persistente no item "requer driver 24V externo" + mensagem clara do que fazer. Mantém a separação v1.2 (orientação/validação) × v1.3 (montagem composta).
- **D-07:** Detecção da linha TINY **pelo dado `sistema='tiny_magneto'`** (robusto — confirmado na Phase 14 que todos os TINY MAG têm esse valor), NÃO por regex de descrição. Regex (AmbienteCard L89) só como fallback de diagnóstico, se necessário — a regra principal vem do dado.

### Resumo de drivers por (código + voltagem) (TENS-02)
- **D-08:** Fix da chave de agrupamento em `calcularDriversPorProjeto` (`src/types/orcamento.ts:288`): hoje agrupa só por `sis.driver.codigo` (L300) → mudar a chave do Map para **`(codigo + voltagem)`**. Dois sistemas com o mesmo driver em voltagens diferentes geram linhas distintas. (Decisão C-4 travada na pesquisa v1.2.)
- **D-09:** Apresentação do resumo: **Claude decide pelo layout atual** do Step 3 a forma mais clara de mostrar a voltagem (ex.: "LM2343 · 24V" / "LM2343 · 48V" no rótulo, OU coluna de voltagem). **CHECKPOINT (D-09a):** mostrar a proposta final antes de implementar. Critérios: diferença de voltagem imediatamente visível, sem dúvida sobre por que há duas linhas do mesmo código, leitura simples, sem complexidade visual desnecessária.
- **D-10:** Validação de voltagem **sempre por-sistema** (compara fita vs driver dentro do mesmo sistema, nunca contra outro ambiente). Ambientes 100% independentes — um ambiente nunca influencia a validação de outro. Hipótese: o "bloqueio indevido" do UAT (#6) vem do default 24V + fluxo atual, não de vínculo real entre ambientes; o pré-fill + filtro (D-01) + validação por-sistema deve fazer a dor desaparecer. **Se houver evidência concreta de vínculo indevido entre ambientes durante a implementação → sinalizar antes de expandir o escopo da investigação.**

### Claude's Discretion
- Regra exata de seleção do driver (D-02, com aprovação prévia via D-02a).
- Forma visual de mostrar voltagem no resumo (D-09, com aprovação prévia via D-09a).
- Mecânica do pré-filtro do seletor (estende `filtro="driver"` em `ProdutoAutocomplete`/`useProdutoSearch`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos & roadmap
- `.planning/REQUIREMENTS.md` — TENS-01 (L24), TENS-02 (L25), SIST-04 (L20), UX-02 (L44); mapa UAT (L56, L61, L67)
- `.planning/ROADMAP.md` §"Phase 15: Tensão & Validação" — goal + 5 success criteria

### Código a tocar
- `src/types/orcamento.ts:288` — `calcularDriversPorProjeto` (grouping key codigo→codigo+voltagem, D-08); `MARGEM_SEGURANCA_DRIVER`, `limiteExtensaoMetros`, `calcularConsumoW`, `calcularQtdDrivers`
- `src/components/AmbienteCard.tsx:130` — `handleSelectProdutoSistema` (pré-fill+filtro D-01, aviso divergência D-04, advisory TINY D-06); L137-149 toast atual de tensão; L89 branch tiny_magneto
- `src/hooks/useProdutoSearch.ts` — filtro `.eq('tipo_produto', filtro)` e alias `sistema_magnetico:sistema` (base do pré-filtro de driver por voltagem)
- `src/components/Step3Revisao.tsx` — renderização do Resumo Global de drivers (D-09 labeling)

### Contexto de estado
- `.planning/STATE.md` §"v1.2 Technical Notes" (C-4 grouping key) e §"Execution Directives" (filosofia: causa-raiz + difícil de configurar errado; sinalizar antes de absorver)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProdutoAutocomplete` + `useProdutoSearch` (filtro perfil/fita/driver) — base para o pré-filtro de driver por voltagem; já expõe `produto.voltagem` e `sistema_magnetico`.
- Toast (sonner) já usado para avisos em `handleSelectProdutoSistema` — reusar para toast de divergência; badge persistente é UI nova no card do sistema.
- `ResumoDriverProjeto` (orcamento.ts:275) já carrega `voltagem` — disponível para o labeling D-09 sem recálculo.

### Established Patterns
- Voltagem do driver/fita vem do produto selecionado (`produto.voltagem`), default 24V na criação do sistema (`novaFita`/`novoDriver` voltagem:24) — provável origem do "bloqueio indevido" (D-10).
- Validação de tensão hoje é toast bloqueante por-sistema (L137-149) — já é por-sistema, falta tom orientativo + badge + não-bloqueio.

### Integration Points
- Pré-fill do driver acontece dentro de `handleSelectProdutoSistema` quando `component==='fita'`.
- Pré-filtro do seletor: passar a voltagem da fita como parâmetro extra ao `ProdutoAutocomplete`/`useProdutoSearch` para o componente driver.
</code_context>

<specifics>
## Specific Ideas

- Lenny pede **transparência antes de codar** em 2 pontos (D-02a, D-09a): regra de sugestão de driver e forma de mostrar voltagem no resumo. Tratar como checkpoints de aprovação na pesquisa/planejamento.
- Texto de aviso deve ser **específico e explicável** (mostrar as voltagens reais; explicar por que o driver foi sugerido).
- Filosofia transversal v1.2: sugerir por padrão · respeitar decisão manual · tornar inconsistência visível · não bloquear indevidamente.
</specifics>

<deferred>
## Deferred Ideas

- Montagem assistida completa de sistemas compostos (TINY/MAGNETO/MODULAR) — v1.3 (SIST-01/02/03). O advisory TINY desta fase é só orientação.
- Botão de ação que adiciona o driver 24V automaticamente ao incluir item TINY — considerado e **rejeitado** nesta fase (tangencia montagem composta v1.3).

### Reviewed Todos (not folded)
- "PDF gerado tá zuado — input pra Phase 5 (PDF Redesign)" — PDF redesign, não é tensão/validação. Fora de escopo da Phase 15.
- "Mostrar foto da fita no Resumo de Fitas do PDF" — já registrado para a Phase 17 (RES-01). Fora de escopo da Phase 15.
</deferred>

---

*Phase: 15-tens-o-valida-o*
*Context gathered: 2026-06-10*
