# Phase 11: PDF v2 + Dashboard — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Limpar o PDF v2 (esconder bloco "Sistemas" zerado + inserir prazo médio de 20 dias úteis) e simplificar a tab Início do admin (substituir 6 cards de métrica por 1 card de "em aberto" quebrado por status, mantendo gráfico mensal + Top 5 clientes).

1. **PDF-01 — Sistemas vazio** (`src/lib/pdfTemplates/v2.ts`): Bloco "SISTEMA N" some quando `subtotalFita === 0 && subtotalDriver === 0` (ignora perfil). Cascade leve: ambiente totalmente vazio (zero luminárias + zero sistemas não-vazios) mantém header com placeholder "sem itens neste ambiente".
2. **PDF-02 — Prazo médio** (mesmo arquivo, função `blocoTermos`): Frase fundida com vírgula no fim do "A consultar" — resultado: `"A consultar conforme disponibilidade de estoque, com prazo médio de 20 dias úteis. Pedidos confirmados após aprovação da proposta."` Texto fica hardcoded no template — snapshots antigos re-renderizam com texto novo sem duplicar (snapshot não armazena boilerplate).
3. **DASH-01 — Tab Início** (`src/components/AdminDashboard.tsx`): Remover os 6 cards (Receita Efetiva/Prevista/Pipeline/Ticket Médio/Conversão/Ciclo Médio). Adicionar 1 card grande "Orçamentos em Aberto" quebrado por status (rascunho + pendente) com total. Manter gráfico "Receita Mensal" e tabela "Top 5 Clientes" (renomear "Fechada" → "Aprovada").

**Out of scope da Phase 11 (mas presente no marco):** Automação aniversário (Phase 12), Smoke & UAT closure (Phase 13). PDF v1 legacy continua intacto. Cálculos de fita/driver/perfil intocados.

</domain>

<decisions>
## Implementation Decisions

### A) PDF-01 — Sistema vazio + cascade

- **D-01:** **Sistema some** quando `calcularSubtotalFitaSistema(sis) === 0 && calcularSubtotalDriverSistema(sis) === 0`. Helper inline em `v2.ts`: `function isSistemaVazio(sis): boolean`. Captura cenário "user criou placeholder mas nunca preencheu produto/preço".
- **D-02:** **Perfil é ignorado** na condição de "vazio" — sistema com fita+driver zerados some mesmo se tem perfil > 0. Justificativa: perfil sem LED não faz sentido no mundo real do AURA (sistema = fita LED + driver; perfil é ferragem opcional). Cliente confirmou: literal ao roadmap "0m fita, 0W consumo, 0 driver".
- **D-03:** **Cascade ambiente:** Bloco `AMBIENTE` mantém header MESMO se todos sistemas vazios e zero luminárias. Renderiza `<p class="empty-state">Sem itens neste ambiente</p>` (ou similar, Claude's Discretion no markup). Justificativa: cliente quer ver todos os ambientes do orçamento no PDF, mesmo vazios (transparência). O early-return `const empty = !amb.luminarias.length && !amb.sistemas.length` na l.236 NÃO se aplica aqui — a condição muda: ambiente é "empty para PDF" só se nem luminária nem sistema-não-vazio.
- **D-04:** Função `blocoSistema` segue retornando string normal — o filtro acontece em `blocoLocal` antes do map de sistemas (`.filter(s => !isSistemaVazio(s))`). Mantém função pura testável.
- **D-05:** **Edge case:** sistema com fita preenchida mas preço R$ 0 (cortesia): `subtotalFita = qtd × precoUnitario = X × 0 = 0`. Sistema some — comportamento intencional (não é "venda"). Se cliente quiser "fita cortesia visível no PDF" no futuro, vira phase nova.

### B) PDF-02 — Prazo médio 20 dias úteis

- **D-06:** **Texto exato** em `blocoTermos` (l.308-309 de `v2.ts`):
  ```
  A consultar conforme disponibilidade de estoque, com prazo médio de 20 dias úteis. Pedidos confirmados após aprovação da proposta.
  ```
- **D-07:** Hardcoded no template — sem flag, sem versionamento condicional. Snapshots antigos (pré-v1.1) já não armazenam "Prazo de entrega" no `ambientes` JSONB; o texto sempre vem do template ao renderizar. Logo, re-emit de PDF antigo mostra automaticamente o novo texto, sem duplicação (sem nada no snapshot pra duplicar).
- **D-08:** "Garantia", "Condições de pagamento" e "Observações" continuam intactos. Sem outras edições no `blocoTermos`.

### C) DASH-01 — Tab Início card único

- **D-09:** **Remover** os 6 cards de métrica (linhas 156-162 de `AdminDashboard.tsx`): Receita Efetiva, Receita Prevista, Pipeline, Ticket Médio, Conversão, Ciclo Médio. Inclui a remoção dos `useMemo` que calculam `kpis.receitaEfetiva`, `receitaPrevista`, `pipeline`, `ticketMedio`, `taxaConversao`, `cicloMedio` (lines ~80-100). Cleanup completo — sem ficar código morto.
- **D-10:** **Adicionar 1 card grande** "Orçamentos em Aberto" no lugar dos 6:
  ```
  ┌─────────────────────────────┐
  │ Orçamentos em Aberto        │
  │ Rascunho:    R$ 250,00      │
  │ Pendente:    R$  47,29      │
  │ ──────────────────────      │
  │ Total:       R$ 297,29      │
  └─────────────────────────────┘
  ```
  Card shadcn destacado (border accent? bg sutil? Claude's Discretion na paleta). 2 linhas com label + valor por status + divider + Total no rodapé bold.
- **D-11:** **Definição de "em aberto":** `status IN ('rascunho', 'pendente')`. Soma de `valor` (coluna `orcamentos.valor`). Cross-rep (todos os colaboradores, admin vê tudo). Query: `SELECT status, sum(valor)::numeric FROM orcamentos WHERE status IN ('rascunho','pendente') GROUP BY status`. Frontend agrega total.
- **D-12:** **Manter** gráfico "Receita Mensal" (linha ~200, BarChart) e tabela "Top 5 Clientes" (linha ~250). Esses fornecem visão temporal + ranking que o card único não cobre.
- **D-13:** **Renomear** label "Top 5 Clientes por Receita Fechada" → "Top 5 Clientes por Receita Aprovada" (Phase 7 renomeou enum, label deve seguir). Verificar se `monthlyData` (l.119) ainda usa chaves antigas (`fechado`) — Phase 10 já corrigiu via D-33; conferir e ajustar se sobrou.
- **D-14:** Card único usa TanStack Query (`useQuery`) com `queryKey: ['orcamentos-em-aberto']`. Sem realtime (atualiza no refetch padrão TanStack). staleTime padrão (~0 — fresh sempre que dashboard abre).
- **D-15:** Tratamento de empty state (zero orçamentos em aberto): card mostra `Rascunho: R$ 0,00`, `Pendente: R$ 0,00`, `Total: R$ 0,00`. Sem hide. Indica "nada pendente" de forma clara.

### Claude's Discretion

- Markup HTML do empty-state em `blocoAmbiente` (mantém estilo do PDF — provavelmente `<p class="empty-state muted">Sem itens neste ambiente</p>` ou similar com CSS existente)
- Paleta exata do card único (accent border? bg-card sutil? icon decorativo?)
- Estrutura do `useQuery` (chave estável, errorBoundary, suspense)
- Loading state do card (skeleton ou placeholder text)
- Naming exato de helpers (`isSistemaVazio`, `getOrcamentosEmAberto`, etc.)
- Migração do `monthlyData` se ainda tiver chave `fechado` residual (Phase 10 deveria ter pego, mas conferir)

### Folded Todos

[Nenhum todo dobrado. O ticket de "lag no input Step 3" (Phase 10 polish) é independente — não folded em Phase 11.]

</decisions>

<canonical_refs>
## Canonical References

**Roadmap & Requirements:**
- `.planning/ROADMAP.md` (Phase 11 section, success criteria 1-4)
- `.planning/REQUIREMENTS.md` (PDF-01, PDF-02, DASH-01)
- `.planning/PROJECT.md` (core value, evolution rules)

**Upstream phase context:**
- `.planning/phases/07-schema-prep-v1-1/07-CONTEXT.md` — D-10..D-14 (status enum `'rascunho'|'aprovado'|'perdido'|'pendente'` em prod)
- `.planning/phases/10-wizard-edi-o-status-descri-o-rica/10-CONTEXT.md` — D-25..D-27 (TS sync já feito; "fechado" purgado em D-33)
- `.planning/phases/10-wizard-edi-o-status-descri-o-rica/10-05-SUMMARY.md` — descrição rica + `gerarPdfHtml` async + atributosMap (NÃO regredir Phase 10)

**Files to read at planning time:**
- `src/lib/pdfTemplates/v2.ts` (l.205-216 `blocoSistema`, l.219-226 `blocoLocal`, l.228-244 `blocoAmbiente`, l.302-330 `blocoTermos`) — alvos exatos de PDF-01 e PDF-02
- `src/lib/gerarPdfHtml.ts` (router PDF v1 vs v2) — NÃO mexer, só Phase 10 já tocou
- `src/components/AdminDashboard.tsx` (l.80-100 KPIs useMemo, l.119 monthlyData, l.156-162 statsCards, l.200+ BarChart, l.250+ Top 5) — alvos de DASH-01
- `src/types/orcamento.ts` (l.110 StatusOrcamento — referência ao enum)

**Helpers existentes em `src/types/orcamento.ts`:**
- `calcularSubtotalFitaSistema(sis)` — usar em isSistemaVazio
- `calcularSubtotalDriverSistema(sis)` — usar em isSistemaVazio
- `calcularSubtotalPerfilSistema(sis)` — NÃO usar (D-02)

**Database:**
- `public.orcamentos` em prod (jkewlaezvrbuicmncqbj) com CHECK constraint nos 4 status (Phase 7 D-10..D-12) e RLS UPDATE one-way `aprovado` (Phase 10 / WIZ-04 D-15+D-16). SELECT continua aberto (D-32 da Phase 10) — dashboard admin vê tudo.

</canonical_refs>

<deferred_ideas>
- **Filtrar dashboard por colaborador** — Phase 11 mostra cross-rep. Se virar requisito, vira phase nova com dropdown de filtro.
- **Card "Receita Aprovada Acumulada"** ou outra métrica em substituição parcial aos 6 cards — out-of-scope; cliente foi explícito sobre "1 card de em aberto" no roadmap.
- **Versionar boilerplate do PDF** (texto de prazo/garantia/etc. armazenado no snapshot) — out-of-scope agora; ganha vida quando texto começar a divergir entre orçamentos.
- **Filtro fita cortesia visível no PDF** — atual D-05 some sistema com R$ 0. Se virar requisito, phase nova.

</deferred_ideas>

<success_criteria>
Plans gerados pelo planner devem cobrir os 4 success criteria do ROADMAP (Phase 11):

1. PDF v2: bloco SISTEMA some quando `subtotalFita === 0 && subtotalDriver === 0` (D-01)
2. PDF v2: "Prazo de entrega" mostra a frase fundida exata de D-06
3. AdminDashboard: 6 cards removidos, 1 card único quebrado por status com gráfico + Top 5 mantidos (D-09 + D-10 + D-12)
4. Snapshots pré-v1.1: re-emit PDF v2 não duplica "20 dias úteis" (D-07) e não crasha em ambiente vazio (D-03)

Verificação Phase 11:
- Smoke manual: criar orçamento com sistema preço zero → confirmar bloco some no PDF; abrir orçamento antigo → confirmar texto novo aparece sem duplicação
- Dashboard manual: comparar card único com soma SQL `SELECT sum(valor) FROM orcamentos WHERE status IN ('rascunho','pendente')`
- Build + tests passam (tests novos para `isSistemaVazio` se vier)

</success_criteria>
