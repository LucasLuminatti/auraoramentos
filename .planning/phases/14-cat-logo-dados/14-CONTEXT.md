# Phase 14: Catálogo & Dados - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Corrigir **dados do catálogo** (e, se o diagnóstico apontar, lógica de código pontual) para que:
1. Todos os produtos de perfil/driver — incluindo WALL WASHER, CANTONEIRA, LM3475, LM3291 e demais famílias com `tipo_produto` nulo/errado — apareçam nos seletores corretos de perfil/driver (CAT-01).
2. A dica/aviso exibida ao adicionar um produto MAGNETO 48V descreva o MAGNETO, não o TINY MAGNETO (CAT-02).

Correções entregues via **migration SQL aditiva** (UPDATE de `tipo_produto`/`sistema_magnetico`) e/ou ajuste pontual de código, conforme a causa raiz.

**Fora de escopo (v1.3):** montagem de sistemas compostos MAGNETO/TINY/MODULAR (seleção de módulos, conectores, drivers como sistema). Esta fase corrige apenas categorização e a *dica* textual.

</domain>

<decisions>
## Implementation Decisions

### Escopo da correção tipo_produto (CAT-01)
- **D-01:** Varredura **ampla com revisão prévia**, não apenas os 4 exemplos do UAT. Objetivo: sair da fase com a base de `tipo_produto` consistente, resolvendo CAT-01 de forma definitiva (inclui UAT ponto 14 "alguns perfis não aparecem"). Primeiro gerar a lista completa de produtos com `tipo_produto` nulo/inconsistente/suspeito; só corrigir os itens revisados e aprovados.

### Estratégia da migration (CAT-01)
- **D-02:** Aprovação **por grupos/regras, não SKU a SKU**. Fluxo:
  1. Varredura ampla → agrupar itens por família/categoria/regra de correção.
  2. Apresentar contagem de produtos afetados por grupo + `tipo_produto` alvo proposto.
  3. Lenny aprova as **regras de correção por grupo** (não cada SKU).
  4. A migration final materializa a **lista explícita de SKUs/códigos** a partir dos grupos aprovados e aplica `UPDATE ... WHERE codigo IN (...)` — determinística e auditável.
- **D-02b:** WALL WASHER deve receber `tipo_produto = 'perfil'` (o valor `'wall_washer'` **não** é aceito pelo CHECK constraint `check_tipo_produto`; valores válidos: `fita, driver, perfil, spot, lampada, acessorio, conector, suporte`).

### Correção da dica MAGNETO (CAT-02)
- **D-03:** Corrigir a **causa raiz onde ela estiver** — sem workaround.
  - Diagnosticar primeiro o produto MAGNETO real: valor de `sistema_magnetico` no banco e a `descricao`.
  - Se a classificação está errada no dado (ex.: `sistema_magnetico = 'tiny_magneto'` num produto MAGNETO 48V) → corrigir no **dado** (migration).
  - Se a detecção em código está errada (ex.: regex `/MAGNETO22/` em `AmbienteCard.tsx:81` não pega "MAGNETO" puro, ou ordem dos `if` faz o branch TINY capturar antes) → corrigir no **código**.
  - Se houver problema dos dois lados → corrigir **ambos**. Não mascarar dado com código nem o contrário.

### Verificação / segurança
- **D-04:** Antes/depois da migration, rodar `SELECT` de **contagem por `tipo_produto`** registrando quantos produtos mudaram.
- **D-05:** Validar (Playwright + manual) que WALL WASHER, CANTONEIRA, LM3475, LM3291 e MAGNETO **aparecem na busca** do seletor correto e que a dica do MAGNETO está certa.
- **D-06:** Confirmar que **snapshots antigos permanecem intactos** — orçamentos salvos usam snapshot jsonb autocontido; recategorizar produto no catálogo NÃO pode alterar orçamentos já existentes.
- **D-07:** Migration **idempotente** (`WHERE` seguros, sem efeito em re-execução) e com **nota de rollback** documentada.

### Claude's Discretion
- Formato exato da query diagnóstica e do agrupamento (família/categoria/regra) que será apresentado para aprovação.
- Estrutura do arquivo de migration e nomenclatura (seguindo o padrão `supabase/migrations/AAAAMMDD......sql`).
- Quais campos exibir na lista de revisão por grupo (sugestão: família, descrição-exemplo, `tipo_produto` atual → alvo, contagem).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CHECK constraint e schema de tipo_produto
- `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql` — define a coluna `tipo_produto`, o `check_tipo_produto` (valores válidos) e o índice `idx_produtos_tipo`. Fonte da verdade sobre valores aceitos (`'wall_washer'` é inválido).

### Filtro de busca por tipo_produto
- `src/hooks/useProdutoSearch.ts` §L20-30 — o seletor filtra por `.eq('tipo_produto', filtro)` para `fita|driver|perfil`. Produto com `tipo_produto` nulo/errado não aparece. Confirma por que CAT-01 depende de corrigir o campo.

### Dica MAGNETO / TINY (CAT-02)
- `src/components/AmbienteCard.tsx` §L80-95 (`handleSelectProdutoLuminaria`) — lógica das dicas magnéticas: branch MAGNETO 48V (`sistema_magnetico === 'magneto_48v'` ou `/MAGNETO22/`) vs branch TINY (`sistema_magnetico === 'tiny_magneto'` ou `/TINY\s+MAG/`). Ponto de diagnóstico/correção de código.

### Requisitos
- `.planning/REQUIREMENTS.md` — CAT-01, CAT-02 (texto completo dos critérios de aceite).
- `.planning/ROADMAP.md` — Phase 14, Success Criteria 1-4.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useProdutoSearch.ts` — hook de busca já existente; nenhuma mudança de código necessária para CAT-01 se o dado for corrigido (o filtro `.eq('tipo_produto', filtro)` já funciona).
- Padrão de migrations Supabase em `supabase/migrations/` — última: `20260602000001_product_variants_ativo.sql`. Migrations aditivas, idempotentes (`IF NOT EXISTS`, `WHERE` guardas).

### Established Patterns
- Schema additivo e não-destrutivo (constraint do projeto). `tipo_produto` já é coluna opcional com CHECK — basta `UPDATE` de valores existentes.
- Dicas exibidas via `toast` (sonner) em `AmbienteCard.tsx`, disparadas no `handleSelectProdutoLuminaria`.

### Integration Points
- Tabela `public.produtos`, coluna `tipo_produto` (e `sistema_magnetico` para CAT-02).
- Snapshot jsonb de orçamentos é autocontido — recategorização do catálogo não propaga para orçamentos salvos (constraint de compatibilidade).

</code_context>

<specifics>
## Specific Ideas

- Famílias/itens conhecidos a corrigir (exemplos do UAT, não exaustivo): **WALL WASHER** (→ `'perfil'`), **PERFIL CANTONEIRA**, **LM3475**, **LM3291**.
- A migration deve ser gerada **após** a aprovação dos grupos — a lista de SKUs nasce dos grupos aprovados.
- "Não quero workaround para mascarar problema de dados nem migration para compensar lógica incorreta" — corrigir na origem (D-03).

</specifics>

<deferred>
## Deferred Ideas

- Montagem completa de sistemas compostos MAGNETO / TINY MAGNETO / MODULAR (seleção de módulos/conectores/drivers como um sistema) → **v1.3** (SIST-01/02/03). UAT pontos 8, 9, 11 e a parte de *montagem* do 10.

### Reviewed Todos (not folded)
- **"PDF gerado tá zuado — input pra Phase 5 (PDF Redesign)"** (`todos/2026-04-27-pdf-zuado-input-para-phase-5.md`) — domínio de PDF/redesign, não de catálogo. Fora do escopo da Fase 14.
- **"PDF orçamento estética ruim"** (`todos/2026-05-06-pdf-orcamento-estetica-ruim.md`) — idem, PDF. Fora do escopo da Fase 14.

</deferred>

---

*Phase: 14-cat-logo-dados*
*Context gathered: 2026-06-10*
