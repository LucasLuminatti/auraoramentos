# Phase 3: Produtos & Importação - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Catálogo de produtos é gerenciável: estrutura pai→variantes (products + product_variants) populada a partir da master `base_dados_site_2026.xlsx` (60 pais, 2088 variantes), legados preservados, AU001..AU016 cadastrados como produtos coringa, imagens migradas pro Supabase Storage, e UI admin pra cadastrar/editar produto manualmente. **Preço fica fora desta phase** — vai pra phase futura.

</domain>

<decisions>
## Implementation Decisions

### A. Schema (produto pai → variantes)
- **D-01:** Duas novas tabelas:
  - `products` (produto pai, derivado da master, **sem limite fixo de linhas**) — colunas: id, codigo_pai (ex: P0001), nome (ex: "Arandela VISION"), categoria, tipologia, created_at
  - `product_variants` (FK→products, 1 linha por SKU) — colunas: id, product_id (FK), sku/codigo (ex: LM2847, AU001), nome (ex: Variante_Nome da master), origem ('master' | 'legado' | 'coringa'), editado_manualmente boolean default false, atributos jsonb, imagem_url, arquiteto_id, preco_tabela, preco_minimo, ...colunas existentes (potencia_watts, tensao, largura_mm, etc.)
- **D-02:** Specs variáveis vão em `atributos jsonb` — nada de schema rígido com 27 colunas. Colunas existentes (potencia_watts, tensao, largura_mm, tipo_produto, subtipo, sistema, etc.) recebem valores quando aplicável.
- **D-03:** Tabela `produtos` atual é **migrada** pra `product_variants` (não deletada). Dados existentes preservados. Se necessário criar view de compatibilidade `produtos` apontando pra `product_variants`.
- **D-04:** Produto-pai dummy `products[id=P-LEGADO]` com nome="Produtos Legados" recebe FK de TODOS os SKUs legados (sem produto_id na master). Reagrupamento manual fica pra phase futura.

### B. Reconciliação (UPSERT, nunca deletar)
- **D-05:** SKU em DB+master:
  - se `editado_manualmente = false` → master sobrescreve `nome`, `atributos jsonb`, e colunas mapeadas (potencia_watts, tensao, etc.)
  - se `editado_manualmente = true` → master NÃO sobrescreve (loga em report)
  - `arquiteto_id` SEMPRE preservado do DB
  - `preco_tabela` e `preco_minimo` SEMPRE intocados
- **D-06:** SKU só no DB → mantém, marca `origem='legado'`, `product_id=P-LEGADO`
- **D-07:** SKU só na master → cria, `origem='master'`, `editado_manualmente=false`, `product_id=` ID do products correspondente (de produto_id da master, ex: P0001)
- **D-08:** `editado_manualmente` é setado como TRUE automaticamente quando o admin edita via UI (qualquer mudança em ProdutoEditDialog). Master subsequente respeita.

### C. AU001..AU016 (produtos coringa)
- **D-09:** PROD-02 do roadmap original está obsoleto — DB já tem 0 produtos sem descrição/preço (verificado via SQL em 2026-04-30). Marcar PROD-02 como "obsoleto / não aplicável" em REQUIREMENTS.md.
- **D-10:** AU001..AU016 viram 16 linhas em `products` + 16 em `product_variants`:
  - products: codigo_pai="P-AU001"..."P-AU016", nome=descrição (ex: "Drivers", "Plug para Fita LED")
  - product_variants: sku="AU001"..."AU016", origem='coringa', editado_manualmente=true (master nunca sobrescreve), descrição padrão definida no plan, imagem_url=null inicialmente
- **D-11:** Lista das 16 descrições padrão (do briefing do user):
  - AU001 — Drivers
  - AU002 — Plug para Fita LED
  - AU003 — Amplificador e Controlador Fita LED
  - AU004 — Fita LED
  - AU005 — Lâmpadas LED
  - AU006 — Luminárias
  - AU007 — Luminárias decorativas sem LED integrado
  - AU008 — Luminárias de mesa
  - AU009 — Luminárias de mesa sem LED integrado
  - AU010 — Projetores, Embutidos e Espelhos
  - AU011 — Partes Luminárias Decorativas Vidro - Teto
  - AU012 — Partes Luminárias Decorativas Vidro - Outros
  - AU013 — Partes Luminárias Decorativas Plástico - Teto
  - AU014 — Partes Luminárias Decorativas Plástico - Outros
  - AU015 — Partes Luminárias Decorativas Outros - Teto
  - AU016 — Partes Luminárias Decorativas Outros - Outros
- **D-12:** AU001..16 aparecem no autocomplete de produto do orçamento como qualquer outro SKU. Sem campo de imposto/categoria fiscal — sistema externo (ERP) cuida disso pelo código.
- **D-13:** Admin pode editar descrição e imagem dos AU via ProdutoEditDialog normal.

### D. Imagens
- **D-14:** Storage: Supabase Storage, bucket `produtos-imagens` (criar se não existir).
- **D-15:** Bulk inicial (one-shot): user fornece pasta/caminho com imagens nomeadas por SKU (ex: `LM029.jpg`). Plan dedicado dentro da Phase 3 sobe tudo pro bucket e popula `product_variants.imagem_url`.
- **D-16:** UI admin (recorrente): ProdutoEditDialog ganha botão "Fazer upload" que envia arquivo pro bucket e atualiza `imagem_url`. Funciona pros AU coringa e edições manuais.
- **D-17:** Master atual NÃO traz imagens. CSV master futura, se trouxer coluna URL, AURA baixa e migra pro Storage. Por ora fica fora.

### E. Preço (deferido)
- **D-18:** IMP-02 (preço via CSV) sai da Phase 3. Vai pra phase futura (3.5 ou nova). Justificativa: em produção real preço atualiza ~1x/mês — operação periódica, não dia-a-dia.
- **D-19:** Schema reserva `preco_tabela`/`preco_minimo` em product_variants — não tocados nesta phase.
- **D-20:** Quando preço entrar (phase futura): fluxo é "1x/mês admin sobe planilha → UPDATE por SKU → bloqueia se SKU desconhecido (não está em product_variants)".

### Importação CSV (IMP-01..06)
- **D-21:** Phase 3 mantém: IMP-01 (criar produtos novos), IMP-03 (imagem via URL ou upload), IMP-04 (instruções+exemplo baixável), IMP-05 (preview create-vs-update-vs-erros), IMP-06 (erro linha-a-linha não aborta batch).
- **D-22:** Phase 3 difere: IMP-02 (preço) — vai junto com a phase futura de preços.
- **D-23:** A "importação master" (sobe a planilha base_dados_site_2026.xlsx) é uma sub-feature dedicada — distinta do CSV dia-a-dia. Pode ser uma sub-tela específica em /admin?tab=importacao&kind=master.

### Claude's Discretion
- Estratégia de migração da tabela `produtos` atual pra `product_variants` (rename + recriar produtos como view, OU migration com cópia + drop) — Claude decide no plan.
- Naming convention exata do bucket Supabase Storage (`produtos-imagens` vs `aura-products` etc.) — Claude decide.
- Sub-rota da UI de importação master vs ímportação CSV regular (sub-tab, dropdown, ou tela separada) — Claude decide com base em UX.
- Mapeamento exato de quais colunas da master vão pra colunas existentes do schema vs `atributos jsonb` — Claude inspeciona o schema atual e a planilha durante research/planning.

### Folded Todos
Nenhum — não havia todos pendentes relevantes a esta phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 3: Produtos & Importação" — goal, success criteria, dependências
- `.planning/REQUIREMENTS.md` — PROD-01..04, IMP-01..06 (PROD-02 marcar obsoleto, IMP-02 deferir)

### Master de Produtos (input)
- `C:\Users\lenny\Downloads\base_dados_site_2026.xlsx` — fonte da verdade de products + variants
  - Aba "Produtos" (60 linhas): produto_id, Categoria, Tipologia, e specs comuns
  - Aba "Variantes" (2088 SKUs): SKU, produto_id (FK pro pai), 27 colunas de specs por variante
  - Aba "Base Completa (flat)" (2088 linhas): mesma de Variantes mas com produto_id explícito
  - Aba "Resumo" (51 métricas)

### Phases anteriores
- `.planning/phases/01-schema-prep/` (schema-prep) — base do schema atual
- `.planning/phases/02-cadastros-arquiteto-crud/02-CONTEXT.md` — `arquitetos`, `ArquitetoAutocomplete`, `ProdutoEditDialog` (será estendido nesta phase)
- `.planning/phases/02-cadastros-arquiteto-crud/02-04-SUMMARY.md` — ProdutoEditDialog atual (código readonly, descrição/preço/arquiteto editáveis)

### Schema atual
- `src/integrations/supabase/types.ts` — schema autogerado, tabela `produtos` com 25 colunas (codigo, descricao, preco_tabela, preco_minimo, imagem_url, tensao, watts_por_metro, largura_mm, tipo_produto, subtipo, sistema, familia_perfil, passadas_padrao, largura_canal_mm, driver_max_watts, driver_tipo_permitido, somente_baby, tamanho_rolo_m, fator_spot, potencia_watts, cor, aplicacao, arquiteto_id)

### Project constraints
- `.planning/PROJECT.md` — schema é aditivo, snapshots antigos não podem quebrar
- `.planning/config.json` — config geral
- `CLAUDE.md` (root) — convenções de código

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ProdutoEditDialog.tsx` (Phase 2) — dialog de edição de produto, ganha botão "Upload imagem" e suporte a `atributos jsonb` editáveis
- `src/components/ArquitetoAutocomplete.tsx` (Phase 2) — combobox debounced, padrão pra reusar em form de produto
- `src/pages/Admin.tsx` aba "Produtos" — já existe lista com edit/pencil. Ganha "Nova Importação Master" e "Novo Produto" (form manual PROD-01)
- `src/pages/Admin.tsx` aba "Importação" — já tem ImportProdutos / ImportPrecos / ImportImagens. Será refatorada/expandida pros novos fluxos.

### Established Patterns
- TanStack Query em alguns lugares, Supabase direto em outros — manter consistente com Admin.tsx atual (Supabase direto)
- shadcn-ui (Dialog, AlertDialog, Tabs, Table) — usar nos novos formulários
- Toast via `sonner` — usar pra feedback de import (linha-a-linha)
- Tailwind + design tokens — manter consistência

### Integration Points
- Supabase Edge Function poderá ser usada pra processar CSV master grande (2088+ linhas) sem timeout do client — investigar no research
- Supabase Storage bucket precisa ser criado com policy de read público (imagens dos produtos aparecem em PDF) e write restrito a admin
- Migration SQL vai criar `products` + `product_variants` + alterar/migrar `produtos` atual — escrever migration cuidadosa (não destrutiva)

### Constraints conhecidas
- 4646 SKUs já no DB → migration tem que mover esses dados sem perder
- `produtos.codigo` é referenciado em outras tabelas (orcamento_itens, etc.) → manter view ou rename cuidadoso
- Snapshots de orçamentos antigos não podem quebrar mesmo com schema novo (constraint do PROJECT.md)

</code_context>

<specifics>
## Specific Ideas

- User confirmou: "preço será atualizado uma vez por mês" em produção — operação periódica, não fluxo do dia-a-dia. Justifica deferir preço pra phase futura.
- User confirmou: AU001..16 são "produtos coringa" pra orçamento quando falta SKU específico em estoque ou não existe no sistema. Único requisito é descrição editável + imagem editável.
- User confirmou: regra de imposto fica fora do AURA — sistema externo (ERP) lê o código e calcula imposto.
- Caminho das imagens: a definir no plan — user mencionou "te passar caminho na rede" → pode ser pasta local zipada que vai ser processada one-shot.

</specifics>

<deferred>
## Deferred Ideas

- **Importação CSV de preços (IMP-02)** — fluxo periódico mensal. Vira phase 3.5 ou phase nova depois. Quando entrar: bloqueia upload se SKU desconhecido.
- **Reagrupamento manual de SKUs legados** — todos vão pra products[P-LEGADO] na Phase 3. Em phase futura, admin pode reagrupar via UI ou outra master.
- **Mapeamento de imagens via URL na master** — se a planilha futura trouxer coluna URL, AURA baixa e migra pro Storage automaticamente. Phase futura.
- **Suporte a múltiplas imagens por produto** — atualmente schema tem `imagem_url` (1). Se virar requisito, criar tabela `product_images`.
- **Compatibility view `produtos`** — caso queries antigas dependam de `produtos`, criar view apontando pra `product_variants` JOIN `products`.

</deferred>

---

*Phase: 03-produtos-importa-o*
*Context gathered: 2026-04-30*
