# Phase 19: Fundação Compostos - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Base técnica dos sistemas compostos (MAGNETO / TINY / MODULAR) — **sem UI de montagem** (isso é Phase 20+). Entrega:

1. **Modelo de dados aditivo no TypeScript** — `ItemComposicao` + campo opcional `composicao?: ItemComposicao[]` em `ItemLuminaria`, sem quebrar código/snapshots existentes.
2. **Tabela `produto_composicao`** — migration aditiva, começa vazia, RLS (leitura autenticado, escrita admin).
3. **Fix de catálogo (CAT-03)** — conectores e kits de fixação aparecem na busca via `filtro='conector'` / `filtro='kit_fixacao'`.
4. **Decisão de arquitetura documentada** no PROJECT.md, com os 5 calc sites de Fita Padrão **intocados**.

Fita Padrão funciona exatamente como hoje. Arquitetura conservadora e 100% aditiva.

</domain>

<decisions>
## Implementation Decisions

### Arquitetura (travada — carregada de PROJECT.md + research + success criteria #4)
- **D-01:** Compostos vivem em `luminarias[].composicao?`, **NÃO** em `sistemas[]`. O trilho/perfil é o `ItemLuminaria` raiz; módulos/driver/conectores são `composicao[]` filhos. `sistemas[]` continua limpo (só fita+driver+perfil). Decisão já recomendada pela pesquisa (opção mais conservadora) e exigida pelo success criteria #4. **Não foi reaberta** — é o anchor da fase.

### Shape do `ItemComposicao` (forward-complete)
- **D-02:** O tipo nasce **forward-complete**: além do shape mínimo da pesquisa (`id, codigo, descricao, quantidade, precoUnitario, precoMinimo, imagemUrl?, papel, obrigatorio`), inclui **`comprimento?: number`** (SYSTEM MOLD, Phase 21 deriva fita de `Σ(comprimento × qtd)`) e **`potenciaW?: number`** (auto-load magnético, Phase 20 deriva carga total). Ambos opcionais → zero quebra. Como é a fase de fundação, paga-se o custo de modelagem uma vez e Phase 20/21 não re-editam o interface nem migram snapshots.
- **D-03:** Os campos técnicos (`potenciaW`, `comprimento`) **e o preço** são **snapshot do catálogo** (`product_variants`) no momento de adicionar o módulo — mesmo padrão que preço/descrição já usam hoje. Orçamento autocontido: mudança futura no catálogo não altera orçamento antigo. **Travado** (não fica a critério da implementação).
- **D-04:** **Sem campo `tipoSistema?`** em `ItemLuminaria` nesta fase. Phase 20 infere o tipo via `product.sistema` existente (`'magneto_48v' | 'tiny_magneto' | 's_mode'`). Evita duplicação de informação e mantém a 19 estritamente no escopo. (SIST-05 = Phase 20.)

### Vocabulário de `papel` (segue pesquisa as-is)
- **D-05:** Adotar os **6 papéis da pesquisa** no CHECK constraint da tabela e no union TS do `ItemComposicao`: `'modulo' | 'driver_recomendado' | 'driver_obrigatorio' | 'conector_energia' | 'kit_fixacao' | 'acessorio_opcional'`. Sem ajuste de vocabulário.

### Tabela `produto_composicao`
- **D-06:** Criada **vazia** nesta fase (migration aditiva). Schema da pesquisa: `pai_codigo`, `filho_codigo` (FK `product_variants.codigo`), `papel` (CHECK = os 6 de D-05), `ordem`, `obrigatorio`, `created_at`, `UNIQUE(pai_codigo, filho_codigo, papel)` + índices em `pai_codigo`/`filho_codigo`. RLS: `SELECT` para `authenticated`, `ALL` só via `has_role(auth.uid(), 'admin')`. Populada incrementalmente depois (admin/CSV) — nunca um ponto de falha.
- **D-07:** **Regras de "conector obrigatório por família"** (MAGNETO 48V → LM2338; TINY → LM3168/LM3169; versão embutir → kit LM2987) moram como **constante no código** (ex: `REGRAS_COMPOSICAO` por `sistema`), **NÃO** na `produto_composicao`. São 3 famílias fixas, regra estrutural estável. A `produto_composicao` fica reservada para **sugestões SKU↔SKU** de módulos/acessórios compatíveis. Consequência: o validador da Phase 20 (COMP-01) lê a regra de família direto do produto/código e funciona mesmo com a tabela vazia (desacoplamento). Esta separação define o **propósito** da tabela e deve guiar o planner.

### CAT-03 — Catálogo & busca (segue pesquisa as-is)
- **D-08:** Fix via **migration de UPDATE aditiva** em `product_variants` corrigindo `tipo_produto` para `'conector'` / `'kit_fixacao'` (não toca snapshots — padrão Phase 14 CAT-01). A lista autoritativa de SKUs é **auditada contra o DB** pelo researcher/planner (sementes conhecidas: conectores LM2338, LM3168, LM3169; kit de fixação LM2987 — confirmar se já existem com `tipo_produto` errado/null vs ausentes). No código: adicionar `'conector'` e `'kit_fixacao'` ao type `ProdutoFiltro` e à query builder de `useProdutoSearch` (`.eq('tipo_produto', filtro)`).

### Documentação
- **D-09:** A decisão de arquitetura (D-01) deve ser registrada no **PROJECT.md → Key Decisions** (exigência do success criteria #4), junto com a verificação de que os 5 calc sites não foram alterados.

### Claude's Discretion
- Lista exata de SKUs da CAT-03 (auditar DB) + mecânica fina da migration de UPDATE por família.
- Detalhes de índices/constraints e cobertura de testes unitários para o novo `calcularSubtotalComposicao` + a versão estendida de `calcularTotalAmbienteSemFita` (guard `?.length` mantém backward-compat).
- Nome/forma exata da constante `REGRAS_COMPOSICAO` e onde ela vive (provável `src/types/orcamento.ts` ou módulo dedicado).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Blueprint de arquitetura (fonte primária — extremamente prescritiva, HIGH confidence)
- `.planning/research/ARCHITECTURE.md` — Data model completo (`ItemComposicao`, `composicao?` em `ItemLuminaria`), schema SQL de `produto_composicao` (§a), backward-compat de snapshots (§b), camada de cálculo (`calcularSubtotalComposicao`, modificação de `calcularTotalAmbienteSemFita`), CAT-03 fix (§a "categorization bug"), e **Anti-Patterns to Avoid** (§final — composite como SistemaIluminacao = errado; mudança no calc global errado; bloquear em dado da tabela = errado).
- `.planning/research/FEATURES.md` — escopo do MVP de compostos e anti-features.
- `.planning/research/PITFALLS.md` — armadilhas de implementação.
- `.planning/research/STACK.md` — confirmação de stack para a fase.

### Requisitos & escopo
- `.planning/REQUIREMENTS.md` — CAT-03 (catálogo/busca); "Out of Scope (v1.3)" define os limites (sem BOM genérico, sem multi-voltagem, etc.).
- `.planning/ROADMAP.md` §"Phase 19: Fundação Compostos" — Success Criteria 1-4 (os 4 critérios verificáveis).

### Código a estender (full paths)
- `src/types/orcamento.ts` — `ItemLuminaria` (linha 23), `calcularSubtotalLuminaria` (236), `calcularTotalAmbienteSemFita` (473). Onde `ItemComposicao` + `calcularSubtotalComposicao` entram.
- `src/hooks/useProdutoSearch.ts` — `ProdutoFiltro` (linha 5), query builder `.eq('tipo_produto', filtro)` (28-31). Alvo do CAT-03.
- `src/lib/pdfTemplates/v2.ts` — contém `isSistemaVazio` (1 dos 5 calc sites intocáveis).
- `.planning/PROJECT.md` §"Key Decisions" — onde D-09 documenta a arquitetura.

### Os 5 calc sites que NÃO podem ser alterados (success criteria #4)
- `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita` (em `src/types/orcamento.ts`) + `isSistemaVazio` (em `src/lib/pdfTemplates/v2.ts`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ItemLuminaria` (orcamento.ts:23)** — estender com `composicao?: ItemComposicao[]` (aditivo; structural subtyping ignora campo ausente em snapshots antigos).
- **`calcularTotalAmbienteSemFita` (orcamento.ts:473)** — único calc a modificar: somar `calcularSubtotalComposicao(i)` por luminária. Guard `?.length` → retorna 0 para snapshots sem composicao.
- **Padrão RLS `has_role(auth.uid(), 'admin')`** — já usado em várias tabelas; reaproveitar na policy de escrita de `produto_composicao`.
- **Padrão de migration aditiva de `tipo_produto`** — Phase 14 (`20260610000001_tipo_produto_correcao_catalogos.sql`) é o template direto para a migration CAT-03.
- **`useProdutoSearch` filtro `'luminaria'` (linha 31)** — já inclui `'conector'` no OR; CAT-03 adiciona filtros dedicados `'conector'`/`'kit_fixacao'`.

### Established Patterns
- **Snapshot autocontido** — `ItemLuminaria`/`ItemFitaLED`/etc. já congelam `precoUnitario`/`descricao` no add-time. `potenciaW`/`comprimento` seguem o mesmo (D-03).
- **Colunas já existentes em `product_variants`** — `tipo_produto`, `sistema` (`'magneto_48v'|'tiny_magneto'|'s_mode'|...`), `potencia_watts`, `tensao`, `familia_perfil`. Fonte dos snapshots e da detecção de tipo (D-04). **Nenhuma coluna nova de produto é necessária.**

### Integration Points
- `src/types/orcamento.ts` — novo `ItemComposicao`, `calcularSubtotalComposicao`, edição de `calcularTotalAmbienteSemFita`, constante `REGRAS_COMPOSICAO` (D-07).
- `src/hooks/useProdutoSearch.ts` — `ProdutoFiltro` + query builder (CAT-03).
- `supabase/migrations/` — 1 migration `produto_composicao` (tabela vazia + RLS) + 1 migration UPDATE de `tipo_produto` (CAT-03). Aplicar via service role conforme [[project_aura_migration_divergence]] (db push é inseguro neste projeto).

</code_context>

<specifics>
## Specific Ideas

- "Pago o custo de modelagem uma vez na fundação" — `ItemComposicao` forward-complete é decisão consciente de Lenny pra não reabrir o tipo nas Phases 20/21.
- "A tabela não pode ser um ponto de falha" — `produto_composicao` vazia + regras de família no código garantem que o fluxo da Phase 20 funcione sem dado seedado.
- Snapshot como fonte congelada é princípio inegociável de Lenny (auditoria/histórico do orçamento), reforçando o padrão já validado em v1.0-v1.2.

</specifics>

<deferred>
## Deferred Ideas

- **Seletor de tipo de sistema (SIST-05)** — Phase 20. Detecção via `product.sistema` (D-04); campo `tipoSistema?` explícito só se surgir necessidade real de desacoplamento do catálogo.
- **Checklist/sugestões de componentes (COMP-01/02) e auto-load/driver (DRV-01/02)** — Phase 20. Usam `REGRAS_COMPOSICAO` (código) + `potenciaW` (snapshot) definidos aqui.
- **População de `produto_composicao`** (sugestões SKU↔SKU via admin/CSV) — pós-fundação, incremental.
- **PDF v3 — seção de compostos (PDF-03)** — Phase 22.
- **Nuance família-vs-SKU totalmente realizada** — a separação está decidida (D-07); a implementação do validador que a consome é Phase 20 (COMP-01).

</deferred>

---

*Phase: 19-funda-o-compostos*
*Context gathered: 2026-06-12*
