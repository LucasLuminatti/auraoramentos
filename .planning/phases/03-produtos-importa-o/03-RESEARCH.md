# Phase 3: Produtos & Importação — Research

**Researched:** 2026-04-30
**Domain:** schema redesign (products + product_variants), CSV/XLSX import (master + dia-a-dia), Supabase Storage for images, UPSERT reconciliation
**Confidence:** HIGH (todas as decisões críticas verificadas em código + arquivos físicos do projeto)

## Summary

Phase 3 introduz uma reorganização estrutural do catálogo de produtos: a tabela achatada `produtos` (4646 SKUs hoje) é migrada para um modelo pai→filho (`products` + `product_variants`) alimentado por `base_dados_site_2026.xlsx` (60 pais, 2088 variantes), preservando legados e introduzindo 16 SKUs coringa (AU001..AU016). A importação CSV existente é refatorada de "só upsert simples" para uma ferramenta com preview create-vs-update-vs-erros, suporte a imagens (URL/upload) e tratamento linha-a-linha. Imagens migram pra Supabase Storage. Preço (IMP-02) é explicitamente deferido.

**Decisão técnica chave verificada:** `produtos.codigo` é referenciada por **2 FKs internas** (`vinculos_spot_lampada.codigo_spot` e `vinculos_spot_lampada.codigo_lampada`) e por **5+ leituras client-side** (Admin.tsx, ProdutoEditDialog, ImportImagens, useProdutoSearch, ImportPrecos edge fn) — ou seja: **renomear ou dropar `produtos` é destrutivo e proibido pelo PROJECT.md**. A estratégia segura é **migrar dados pra `product_variants` + manter `produtos` como VIEW de compatibilidade**.

**Primary recommendation:** Implementar Phase 3 em 5 plans nesta ordem: (1) schema + migration de dados + view de compatibilidade, (2) seed de AU001..16, (3) UI form de cadastro manual + extensão de ProdutoEditDialog (PROD-01, D-13, D-16), (4) refator da importação master (XLSX) com reconciliação UPSERT preservando `editado_manualmente`, (5) refator da importação CSV dia-a-dia com preview create/update/erro + bulk upload imagens (one-shot e recorrente).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### A. Schema (produto pai → variantes)
- **D-01:** Duas novas tabelas:
  - `products` (produto pai, derivado da master, sem limite fixo de linhas) — colunas: id, codigo_pai (ex: P0001), nome (ex: "Arandela VISION"), categoria, tipologia, created_at
  - `product_variants` (FK→products, 1 linha por SKU) — colunas: id, product_id (FK), sku/codigo (ex: LM2847, AU001), nome (ex: Variante_Nome da master), origem ('master' | 'legado' | 'coringa'), editado_manualmente boolean default false, atributos jsonb, imagem_url, arquiteto_id, preco_tabela, preco_minimo, ...colunas existentes (potencia_watts, tensao, largura_mm, etc.)
- **D-02:** Specs variáveis vão em `atributos jsonb` — nada de schema rígido com 27 colunas. Colunas existentes (potencia_watts, tensao, largura_mm, tipo_produto, subtipo, sistema, etc.) recebem valores quando aplicável.
- **D-03:** Tabela `produtos` atual é **migrada** pra `product_variants` (não deletada). Dados existentes preservados. Se necessário criar view de compatibilidade `produtos` apontando pra `product_variants`.
- **D-04:** Produto-pai dummy `products[id=P-LEGADO]` com nome="Produtos Legados" recebe FK de TODOS os SKUs legados (sem produto_id na master). Reagrupamento manual fica pra phase futura.

#### B. Reconciliação (UPSERT, nunca deletar)
- **D-05:** SKU em DB+master:
  - se `editado_manualmente = false` → master sobrescreve `nome`, `atributos jsonb`, e colunas mapeadas (potencia_watts, tensao, etc.)
  - se `editado_manualmente = true` → master NÃO sobrescreve (loga em report)
  - `arquiteto_id` SEMPRE preservado do DB
  - `preco_tabela` e `preco_minimo` SEMPRE intocados
- **D-06:** SKU só no DB → mantém, marca `origem='legado'`, `product_id=P-LEGADO`
- **D-07:** SKU só na master → cria, `origem='master'`, `editado_manualmente=false`, `product_id=` ID do products correspondente (de produto_id da master, ex: P0001)
- **D-08:** `editado_manualmente` é setado como TRUE automaticamente quando o admin edita via UI (qualquer mudança em ProdutoEditDialog). Master subsequente respeita.

#### C. AU001..AU016 (produtos coringa)
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

#### D. Imagens
- **D-14:** Storage: Supabase Storage, bucket `produtos-imagens` (criar se não existir).
- **D-15:** Bulk inicial (one-shot): user fornece pasta/caminho com imagens nomeadas por SKU (ex: `LM029.jpg`). Plan dedicado dentro da Phase 3 sobe tudo pro bucket e popula `product_variants.imagem_url`.
- **D-16:** UI admin (recorrente): ProdutoEditDialog ganha botão "Fazer upload" que envia arquivo pro bucket e atualiza `imagem_url`. Funciona pros AU coringa e edições manuais.
- **D-17:** Master atual NÃO traz imagens. CSV master futura, se trouxer coluna URL, AURA baixa e migra pro Storage. Por ora fica fora.

#### E. Preço (deferido)
- **D-18:** IMP-02 (preço via CSV) sai da Phase 3. Vai pra phase futura (3.5 ou nova). Justificativa: em produção real preço atualiza ~1x/mês — operação periódica, não dia-a-dia.
- **D-19:** Schema reserva `preco_tabela`/`preco_minimo` em product_variants — não tocados nesta phase.
- **D-20:** Quando preço entrar (phase futura): fluxo é "1x/mês admin sobe planilha → UPDATE por SKU → bloqueia se SKU desconhecido (não está em product_variants)".

#### F. Importação CSV (IMP-01..06)
- **D-21:** Phase 3 mantém: IMP-01 (criar produtos novos), IMP-03 (imagem via URL ou upload), IMP-04 (instruções+exemplo baixável), IMP-05 (preview create-vs-update-vs-erros), IMP-06 (erro linha-a-linha não aborta batch).
- **D-22:** Phase 3 difere: IMP-02 (preço) — vai junto com a phase futura de preços.
- **D-23:** A "importação master" (sobe a planilha base_dados_site_2026.xlsx) é uma sub-feature dedicada — distinta do CSV dia-a-dia. Pode ser uma sub-tela específica em /admin?tab=importacao&kind=master.

### Claude's Discretion
- Estratégia de migração da tabela `produtos` atual pra `product_variants` (rename + recriar produtos como view, OU migration com cópia + drop) — Claude decide no plan.
- Naming convention exata do bucket Supabase Storage (`produtos-imagens` vs `aura-products` etc.) — Claude decide.
- Sub-rota da UI de importação master vs ímportação CSV regular (sub-tab, dropdown, ou tela separada) — Claude decide com base em UX.
- Mapeamento exato de quais colunas da master vão pra colunas existentes do schema vs `atributos jsonb` — Claude inspeciona o schema atual e a planilha durante research/planning.

### Deferred Ideas (OUT OF SCOPE)
- **Importação CSV de preços (IMP-02)** — fluxo periódico mensal. Vira phase 3.5 ou phase nova depois. Quando entrar: bloqueia upload se SKU desconhecido.
- **Reagrupamento manual de SKUs legados** — todos vão pra products[P-LEGADO] na Phase 3. Em phase futura, admin pode reagrupar via UI ou outra master.
- **Mapeamento de imagens via URL na master** — se a planilha futura trouxer coluna URL, AURA baixa e migra pro Storage automaticamente. Phase futura.
- **Suporte a múltiplas imagens por produto** — atualmente schema tem `imagem_url` (1). Se virar requisito, criar tabela `product_images`.
- **Compatibility view `produtos`** — listada como deferida no CONTEXT mas a research mostra que **é praticamente obrigatória** (ver "Estado real do acoplamento" na seção de migração abaixo). Plan deve criar a view nesta phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PROD-01** | UI de cadastro manual de produto no admin (form com nome, descrição, imagem upload, preço, preço mínimo, arquiteto) | Estender `ProdutoEditDialog.tsx` para suportar `mode='create'` (espelhando padrão `ClienteDialog`); adicionar botão "Upload imagem" que faz upload no bucket `produtos-imagens` e popula `imagem_url`. Form grava em `product_variants` com `origem='manual'` ou similar (Claude define no plan), e cria pai dummy se admin não escolher um existente. |
| **PROD-02** | (OBSOLETO — D-09) 16 produtos da base atual sem descrição/foto/preço cadastrados | **Marcar como obsoleto em REQUIREMENTS.md.** DB já tem 0 produtos sem descrição/preço (verificado via SQL em 2026-04-30 segundo CONTEXT). Plan inclui patch em REQUIREMENTS.md atualizando status para "Obsoleto / Não aplicável" com referência ao D-09. |
| **IMP-01** | Importação CSV cria produtos novos (não só atualiza) | `import-produtos` edge function já faz UPSERT (`onConflict: 'codigo'`). Refator precisa: (1) trocar tabela alvo de `produtos` para `product_variants` via view OU direto; (2) classificar cada linha como "create" ou "update" antes do upsert para feedback visual; (3) criar pai automaticamente se SKU referencia `produto_id` que não existe (ou anexar ao P-LEGADO). |
| **IMP-02** | (DEFERIDO — D-18) Importação aceita preço e atualiza por SKU | **Marcar como deferido em REQUIREMENTS.md.** Será phase 3.5 ou phase nova. Plan inclui patch em REQUIREMENTS.md atualizando status para "Deferido para phase futura" com referência a D-18. |
| **IMP-03** | Importação CSV aceita coluna de imagem (URL ou caminho de arquivo) | Adicionar campo `imagem_url` na config de `ImportProdutos` (ImportField). Se valor for URL HTTP(S), gravar direto. Se for path local/nome de arquivo, gravar como string e flagar para o admin fazer match no bulk upload posterior. **Não baixar URL externa nesta phase** (D-17 deferido). Bulk upload de imagens (D-15) reusa `ImportImagens.tsx` apontando pra novo bucket. |
| **IMP-04** | Tela de importação tem instruções + exemplo baixável | Criar template XLSX gerável client-side via `XLSX.utils.book_new()` + `XLSX.writeFile`. Botão "Baixar template" no topo de cada sub-tab (Master, CSV diário). Bloco de "Como funciona" expandível com lista de colunas obrigatórias e regras (especialmente: SKU é chave; produto_id determina o pai; sem produto_id vai pra P-LEGADO). |
| **IMP-05** | Preview antes de confirmar (created vs updated vs imagens vs erros) | Refator do componente `ImportMapper.tsx` (já tem preview básico). Após mapeamento + parse, fazer query `SELECT codigo FROM product_variants WHERE codigo IN (...)` para classificar cada linha como "novo" (create) ou "existente" (update) antes do submit. Tela de preview ganha 3 contadores: `Criar N` / `Atualizar M` / `Erros K`. |
| **IMP-06** | Falha em 1 linha não aborta batch + relatório pós-import | Já implementado parcialmente no `import-produtos` edge fn (try-catch por item dentro do batch). Refator: garantir que batch SQL único falhe → cair em loop item-a-item (já faz isso). Adicionar **download de XLSX com erros** (já implementado em `ImportMapper.tsx` linha 137-150 — reutilizar). |

**Mapeamento phases anteriores:** PROD-03/PROD-04 já foram entregues na Phase 2 (vincular arquiteto a produtos via UI — `ProdutoEditDialog`). Phase 3 estende esse mesmo dialog com upload de imagem e cadastro novo (mode='create').
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Impact on Phase 3 |
|------------|--------|-------------------|
| Stack congelada: React 18 + Vite + TS + Supabase + shadcn-ui | CLAUDE.md (root) | Não trocar nada — usar `xlsx` 0.18.5 já no package.json, sem novas deps |
| Schema **aditivo, nunca destrutivo** | CLAUDE.md (root) | `produtos` NÃO pode ser deletada nem renomeada. Migration cria `products`/`product_variants` + COPY data + view de compatibilidade |
| Snapshots antigos não podem quebrar | CLAUDE.md (root) | Snapshot em `orcamentos.ambientes` (jsonb) já contém códigos hardcoded de produto — render só lê dados do JSONB, não consulta `produtos`. Logo: seguro mesmo se schema mudar |
| Wizard 3 passos não pode quebrar | CLAUDE.md (root) | `useProdutoSearch.ts` (autocomplete) lê `produtos` — view de compatibilidade preserva esse caminho |
| RLS produtos: leitura autenticada, escrita admin | Schema atual | Replicar mesma policy em `products` + `product_variants` + bucket Storage |
| `npm run lint` tem 51 erros pré-existentes | Phase 2 SUMMARY (Plan 04) | Plan não pode introduzir erros novos; mas erros pré-existentes são tolerados (D-26 do CLAUDE.md root) |
| Não usar TanStack Query — Supabase direto | Admin.tsx + Phase 2 D-25 | Manter padrão; queries em direct Supabase calls com toast de erro |
| UI text em pt-BR; identifiers code-side podem ser pt ou en | CLAUDE.md (root) | `products`/`product_variants` em inglês (consistente com Postgres convention); `codigo_pai`, `origem`, `atributos` em pt (consistente com `arquiteto_id`, `preco_tabela`) |
| GSD enforcement obrigatório | CLAUDE.md (root) | Já estamos no fluxo (research → plan → execute) |

## Standard Stack

### Core (todas já presentes — sem novas deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `xlsx` | 0.18.5 | Parse/gerar XLSX no browser | [VERIFIED: npm view xlsx version → 0.18.5, 2024-10] Já é a versão atual no registry público; usado em `ImportMapper.tsx` e `ImportProdutos.tsx` para parsear master |
| `@supabase/supabase-js` | 2.95.3 | Client + Storage SDK | [VERIFIED: package.json] Já em uso; suporta `.storage.from(bucket).upload()` e `.getPublicUrl()` (visto em `ImportImagens.tsx:141-143`) |
| `sonner` | 1.7.4 | Toast feedback | [VERIFIED: package.json] Padrão estabelecido (`toast.success/error/warning`) |
| shadcn-ui (Dialog, Table, Tabs, Card, Progress, Collapsible, AlertDialog) | latest stable | UI primitives | [VERIFIED: src/components/ui/] Todas já em uso; nenhuma a adicionar |
| `lucide-react` | 0.462.0 | Icons | [VERIFIED: package.json] |

### Supporting (já presentes)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | 7.61.1 | Form state | OPCIONAL — codebase atual usa `useState` direto. Manter o padrão (D-25 Phase 2) |
| `zod` | 3.25.76 | Schema validation | OPCIONAL — útil para validar payload importado (errar cedo) mas não obrigatório se Claude validar inline |
| `@testing-library/react` + `vitest` | latest | Testes unitários | Útil para testar lógica de reconciliação UPSERT pura (sem componentes) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `xlsx` no client (parsing local) | Edge function processando XLSX server-side | Edge fn evita uploads grandes para o user lento, mas **2088 rows ~1 MB** parseiam em < 500ms no Chrome desktop. Não vale a complexidade [ASSUMED — não testei o tamanho real do arquivo no DOM, mas é precedente do `ImportMapper` que já carrega XLSX no browser] |
| Supabase Storage para imagens | URL externa (Cloudinary, S3 direto) | Storage mantém tudo no mesmo provider, simplifica RLS (auth do mesmo session). Cloudinary teria CDN gratuito mas é over-engineering pra ~2000 fotos |
| Renomear `produtos` → `product_variants` | View de compatibilidade `produtos` apontando pra `product_variants` JOIN `products` | **Renomear quebra FK `vinculos_spot_lampada` (CASCADE/RESTRICT)** + 5+ leituras client-side. View é mais barata e preserva backward compat zero risk |
| `editado_manualmente: boolean` | `edited_at: timestamp` (mais expressivo) | CONTEXT D-08 explicitamente locka `editado_manualmente boolean default false`. Não trocar |

**Installation:** Nenhuma instalação nova. Tudo já em `package.json`.

**Version verification:**
```bash
npm view xlsx version       # → 0.18.5  [VERIFIED 2026-04-30]
npm view sonner version     # → 1.7.4 (current per package.json)
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── ProdutoEditDialog.tsx        # ESTENDIDO: mode='create'|'edit', upload imagem
│   ├── ProdutoCreateForm.tsx        # NOVO (opcional): wrapper especializado se ProdutoEditDialog ficar grande
│   ├── ImportMaster.tsx             # NOVO: importação one-shot da base_dados_site_2026.xlsx
│   ├── ImportProdutos.tsx           # REFATORADO: alvo product_variants, preview create/update
│   ├── ImportPrecos.tsx             # MANTIDO mas marcado "indisponível" (D-18) ou removido da UI
│   ├── ImportImagens.tsx            # REFATORADO: bucket 'produtos-imagens', alvo product_variants
│   ├── ImportMapper.tsx             # REFATORADO: ganha contadores create/update + classificação prévia
│   └── ui/...                        # shadcn (não tocar)
├── hooks/
│   └── useProdutoSearch.ts           # AJUSTAR: query ainda lê 'produtos' via view de compat (sem mudança grande)
├── lib/
│   ├── reconcileProducts.ts          # NOVO: pura — recebe array de master + array do DB → produz {creates, updates, conflicts}
│   ├── parseMasterXlsx.ts            # NOVO: pura — XLSX.read + valida estrutura das 4 abas
│   └── productAttributes.ts          # NOVO: pura — mapeia colunas master → schema (typed cols vs atributos jsonb)
├── pages/
│   └── Admin.tsx                     # AJUSTAR: aba Importação ganha sub-tabs Master / Diário; aba Produtos ganha botão "+ Novo Produto"
└── integrations/supabase/
    └── types.ts                      # REGENERAR após migration (npx supabase gen types typescript)

supabase/
├── migrations/
│   └── 20260501000001_products_and_variants.sql   # NOVO: cria tabelas + view de compat + RLS + índices
│   └── 20260501000002_storage_bucket_produtos_imagens.sql  # NOVO: cria bucket + policies
│   └── 20260501000003_seed_au_coringa.sql         # NOVO: insere 16 AU + pais em products
└── functions/
    ├── import-produtos/index.ts                   # REFATORADO: alvo product_variants
    └── import-master/index.ts                     # NOVO (OPCIONAL — ver Pattern 4): processa master xlsx server-side

.planning/phases/03-produtos-importa-o/
└── 03-RESEARCH.md (este arquivo)
```

### Pattern 1: View de Compatibilidade `produtos`

**What:** `produtos` deixa de ser tabela e vira view que JOIN `product_variants` + `products`, expondo o mesmo shape de colunas que existe hoje.

**When to use:** Sempre que houver migração estrutural com leituras spread pelo código. Aqui é mandatório porque `vinculos_spot_lampada` tem FK em `produtos.codigo` (com CASCADE/RESTRICT) e 5+ pontos no front leem `produtos.*`.

**Example:**
```sql
-- Source: padrão Postgres + Supabase. Verificado contra schema atual.

-- 1. Renomear tabela existente (preserva FKs!)
ALTER TABLE public.produtos RENAME TO product_variants;

-- 2. Criar tabela products (pais)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_pai TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  tipologia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Adicionar product_id em product_variants
ALTER TABLE public.product_variants
  ADD COLUMN product_id UUID REFERENCES public.products(id),
  ADD COLUMN origem TEXT NOT NULL DEFAULT 'legado'
    CHECK (origem IN ('master', 'legado', 'coringa')),
  ADD COLUMN editado_manualmente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN nome TEXT;  -- novo: nome do SKU (ex: "VISION 5W")

-- 4. Criar pai dummy P-LEGADO e vincular todos os SKUs sem master
INSERT INTO public.products (codigo_pai, nome, categoria, tipologia)
  VALUES ('P-LEGADO', 'Produtos Legados', NULL, NULL);

UPDATE public.product_variants
  SET product_id = (SELECT id FROM public.products WHERE codigo_pai = 'P-LEGADO');

-- 5. Criar VIEW de compatibilidade chamada `produtos`
CREATE VIEW public.produtos AS
  SELECT
    pv.id, pv.codigo, pv.descricao, pv.preco_tabela, pv.preco_minimo,
    pv.imagem_url, pv.tensao, pv.watts_por_metro, pv.largura_mm, pv.tipo_produto,
    pv.subtipo, pv.sistema, pv.familia_perfil, pv.passadas_padrao, pv.largura_canal_mm,
    pv.driver_max_watts, pv.driver_tipo_permitido, pv.somente_baby, pv.tamanho_rolo_m,
    pv.fator_spot, pv.potencia_watts, pv.cor, pv.aplicacao, pv.arquiteto_id,
    pv.created_at
  FROM public.product_variants pv;

-- 6. Granular permissions/RLS na view (opcional — se schema_atual já tem RLS aceita)
-- Views herdam RLS da tabela base — verificar.
```

**Crítico:** O `RENAME TO product_variants` PRESERVA todas as FKs (`vinculos_spot_lampada.codigo_spot REFERENCES produtos(codigo)` continua válida porque o constraint move com a tabela; só o nome muda). Após o rename, a view `produtos` é só leitura — UPDATE/INSERT/DELETE devem ir direto em `product_variants` ou via INSTEAD OF triggers.

[VERIFIED: padrão `ALTER TABLE ... RENAME TO ...` preserva FKs em PostgreSQL — comportamento documentado]

### Pattern 2: Reconciliação UPSERT (D-05..D-08)

**What:** Função pura que recebe (1) array de variantes da master + (2) snapshot de SKUs no DB, e retorna 3 arrays: `creates`, `updates`, `skipped` (com motivo).

**When to use:** Tanto na importação master one-shot quanto em re-imports incrementais.

**Example:**
```typescript
// Source: pseudocódigo derivado das regras D-05/D-06/D-07/D-08 do CONTEXT.md

interface MasterVariant {
  sku: string;
  produto_id: string;       // P0001 etc
  variante_nome: string;
  atributos: Record<string, unknown>;
  // ... colunas mapeadas (potencia_watts, tensao, etc.)
}

interface DbVariant {
  sku: string;
  product_id: string;        // UUID
  origem: 'master' | 'legado' | 'coringa';
  editado_manualmente: boolean;
  arquiteto_id: string | null;
  preco_tabela: number | null;
  preco_minimo: number | null;
  // ...
}

interface ReconcileReport {
  creates: MasterVariant[];           // SKUs novos (D-07)
  updates: Array<{ sku: string; patch: Partial<DbVariant>; reason: 'master_overrides_unedited' }>;
  skipped: Array<{ sku: string; reason: 'editado_manualmente' | 'origem_coringa' }>;
  legados_preserved: string[];        // SKUs no DB sem match na master (D-06)
}

function reconcile(master: MasterVariant[], db: DbVariant[]): ReconcileReport {
  const dbBySku = new Map(db.map(v => [v.sku, v]));
  const masterSkus = new Set(master.map(v => v.sku));

  const creates: MasterVariant[] = [];
  const updates: ReconcileReport['updates'] = [];
  const skipped: ReconcileReport['skipped'] = [];

  for (const m of master) {
    const existing = dbBySku.get(m.sku);
    if (!existing) {
      // D-07: SKU só na master → cria
      creates.push(m);
      continue;
    }
    if (existing.origem === 'coringa') {
      // D-10: AU coringa nunca sobrescrito por master
      skipped.push({ sku: m.sku, reason: 'origem_coringa' });
      continue;
    }
    if (existing.editado_manualmente) {
      // D-05: master NÃO sobrescreve
      skipped.push({ sku: m.sku, reason: 'editado_manualmente' });
      continue;
    }
    // D-05: master sobrescreve nome + atributos + colunas mapeadas
    // mas NUNCA arquiteto_id, preco_tabela, preco_minimo
    updates.push({
      sku: m.sku,
      patch: {
        nome: m.variante_nome,
        atributos: m.atributos,
        // ...colunas mapeadas (omitidas)
        // arquiteto_id, preco_tabela, preco_minimo: PRESERVADOS (não incluir no patch)
      },
      reason: 'master_overrides_unedited',
    });
  }

  // D-06: SKUs no DB sem match na master mantêm como 'legado'
  const legados_preserved = db
    .filter(v => !masterSkus.has(v.sku))
    .map(v => v.sku);

  return { creates, updates, skipped, legados_preserved };
}
```

**Anti-pattern:** UPSERT cego usando `ON CONFLICT DO UPDATE SET ...`. Isso ignora `editado_manualmente` e sobrescreve dados que o admin editou via UI. **Sempre passar pela função `reconcile()` primeiro** e gerar 3 chamadas separadas (INSERT batch, UPDATE batch, log).

### Pattern 3: Storage Bucket com RLS por Role

**What:** Bucket `produtos-imagens` com leitura pública (PDFs, autocomplete, admin) e escrita só para role admin (replicando padrão `vinculos_spot_lampada` migration).

**Example:**
```sql
-- Source: padrão Supabase Storage + has_role() já existente em migration vinculos_spot_lampada (linha 38)

-- 1. Criar bucket via SQL
INSERT INTO storage.buckets (id, name, public)
  VALUES ('produtos-imagens', 'produtos-imagens', true)
  ON CONFLICT (id) DO NOTHING;

-- 2. Policy: leitura pública (imagens aparecem em PDFs e listas)
CREATE POLICY "Anyone can read produtos-imagens"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produtos-imagens');

-- 3. Policy: insert/update/delete só para admin
CREATE POLICY "Admins can manage produtos-imagens"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'produtos-imagens' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'produtos-imagens' AND public.has_role(auth.uid(), 'admin'));
```

[VERIFIED: `public.has_role(auth.uid(), 'admin')` já existe — visto em `supabase/migrations/20260319000003_vinculos_spot_lampada.sql:38`]

[ASSUMED: Bucket pode ser criado via SQL `INSERT INTO storage.buckets`. Alternativa é criar via Supabase Dashboard UI. Plan deve preferir SQL para reprodutibilidade, mas pode cair pra UI se a sintaxe falhar em sa-east-1.]

### Pattern 4: Master Import — Browser vs Edge Function

**What:** Decisão sobre onde processar o XLSX (60 pais + 2088 variantes).

**Recommendation:** Processar **no browser** (xlsx 0.18.5 já instalado).

**Justification:**
- Arquivo real (`base_dados_site_2026.xlsx`) tem 4 abas, 2088 variantes — verificado fisicamente em 2026-04-30
- Parsing client-side: ~500ms em hardware moderno (precedente: `ImportMapper.tsx` já parseia XLSX)
- Reconciliação pura é em JS — sem necessidade de Postgres roundtrips
- INSERT/UPDATE em batches via `supabase.from('product_variants').upsert(...)` direto do browser (auth via session admin)
- Edge function só seria útil se tivéssemos timeout do client em parsing — não é o caso

**When to revisit:** Se a master crescer pra 10.000+ rows ou se o parser puxar mais de 30s no browser, mover para edge function.

**When edge function IS necessary:** UPSERT batches grandes em Supabase free tier podem hit rate limits — mas usando `.upsert([...500 rows])` em loop com 500ms throttle no client resolve, sem precisar de edge function.

### Pattern 5: ProdutoEditDialog Estendido (mode='create' | 'edit')

**What:** Espelhar o padrão já validado em `ClienteDialog.tsx` e `ArquitetoDialog.tsx` — um único componente com prop `mode`.

**Example signature:**
```typescript
interface ProdutoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  produto: ProdutoEditRow | null;     // null em create
  onSuccess: () => void;
}
```

**Em mode='create':** form gera novo SKU (input livre ou auto), insere em `product_variants` com `origem='manual'` (sugestão Claude — D-08 é gatilho de UPDATE; CREATE manual via UI fica como nova origem `'manual'` ou `'admin'`. Plan deve travar isso.) + cria pai automaticamente vinculado a `P-LEGADO` (a menos que admin selecione um pai existente via combobox).

**Em mode='edit':** comportamento atual + setar `editado_manualmente = true` (D-08) + suporte a botão "Upload imagem" (D-16) que sobe o arquivo no bucket `produtos-imagens` e atualiza `imagem_url` no UPDATE.

### Anti-Patterns to Avoid

- **Drop e recreate `produtos`**: Quebra FK `vinculos_spot_lampada` + 5+ leituras client-side. **Sempre usar RENAME ou view de compat**.
- **UPSERT direto sem reconcile**: Pula regras de `editado_manualmente`. Reconciliação tem que ser explícita.
- **Múltiplos componentes de Dialog (ProdutoCreateDialog separado)**: Já desbancado em Phase 2 — `ClienteDialog` e `ArquitetoDialog` reusam mode prop. Replicar.
- **Snapshot de orçamento referenciar `product_variants.id` direto**: Snapshot deve continuar usando `codigo` (string estável). UUID muda se o registro for recreated; codigo é a chave de negócio.
- **Bucket name "produto-imagens" (singular)**: O atual `ImportImagens.tsx:141` usa `produto-imagens` (singular). CONTEXT D-14 lockou plural `produtos-imagens`. Plan deve renomear ou criar novo. **Recomendação:** criar bucket NOVO `produtos-imagens`, migrar os ~poucas imagens já lá (se houver), atualizar `ImportImagens.tsx` para o novo nome. Isso evita conflito com policies antigas.
- **Tipos generated stale**: Após cada migration, rodar `npx supabase gen types typescript --project-id jkewlaezvrbuicmncqbj > src/integrations/supabase/types.ts`. Sem isso, TypeScript não enxerga `product_variants.editado_manualmente`.

## Don't Hand-Roll

| Problema | Don't Build | Use Instead | Why |
|----------|-------------|-------------|-----|
| Parse XLSX no browser | parser próprio | `xlsx` 0.18.5 (já instalado) | Edge cases brutais: merge cells, formulas, multi-sheet, encoding, etc. |
| Bulk image upload com classificação | `Promise.all` ad-hoc | Reusar `ImportImagens.tsx` (já tem analyze→ready→upload→done state machine) | 350 linhas de UI já validadas — só trocar bucket name e tabela alvo |
| Reconciliação UPSERT | UPSERT direto SQL | Função `reconcile()` em TS puro + 3 statements separados (INSERT, UPDATE, log) | Regras D-05..D-08 são lógica de negócio, não SQL |
| Image storage com RLS | montar S3 ou Cloudinary | Supabase Storage (já parte da stack) | Mesma session de auth, RLS nativa, public URL grátis |
| CSV preview create/update | rolar à mão | Estender `ImportMapper.tsx` (já tem upload, mapping, preview, error report, batch) + 1 query SELECT classificadora | 397 linhas já comprovadas em produção |
| Validação de payload importado | `if (!row.codigo) ... if (!row.descricao) ...` ad-hoc | `zod` schemas (já em deps) | Erro inline tipado + mensagem amigável "campo X obrigatório na linha Y" |
| Geração do template XLSX baixável (IMP-04) | montar string CSV à mão | `XLSX.utils.book_new() + writeFile()` | Garante encoding UTF-8 BOM, headers em PT-BR sem mojibake |
| Validar e parsear master 2088 rows server-side | edge function nova | xlsx no browser | 500ms parsing, sem timeout, sem complexidade extra (ver Pattern 4) |
| Triggers Postgres pra `editado_manualmente=true` em UPDATE | `BEFORE UPDATE` trigger no DB | Setar no client/server da chamada de update (`...patch, editado_manualmente: true`) | Trigger global é frágil (toda escrita do edge fn de import dispararia também). Setar na origem da intenção. |

**Key insight:** O codebase atual já tem 80% das peças (ImportMapper, ImportImagens, ProdutoEditDialog, Storage SDK). Phase 3 é majoritariamente **estender e religar**, não construir do zero.

## Runtime State Inventory

> Aplicável a esta phase porque envolve refactor estrutural de tabela em produção.

| Categoria | Items encontrados | Ação requerida |
|-----------|-------------------|----------------|
| **Stored data** | 4646 SKUs em `produtos` (Supabase prod, sa-east-1, project jkewlaezvrbuicmncqbj). Snapshots em `orcamentos.ambientes` (jsonb) — **leem `codigo` mas não joinam com produtos no render** (verificado em `gerarPdfHtml.ts` — sem matches para "from('produtos')"). | **Code edit + data migration**: (1) migration SQL renomeia produtos→product_variants, cria products, popula product_id=P-LEGADO em todas as 4646 linhas, cria view de compat. (2) Após migration, rodar 1x o import master: `INSERT` para 2088 SKUs novos da master + `UPDATE` para os que já existem com mesmo codigo + `INSERT` em products de 60 pais. Snapshots ficam intactos. |
| **Live service config** | Bucket Storage `produto-imagens` (singular) já existe em prod — usado por `ImportImagens.tsx:141`. Quantas imagens já estão lá não foi verificado nesta research. | **Manual + code edit**: (1) Criar novo bucket `produtos-imagens` (plural, conforme D-14). (2) Se `produto-imagens` antigo tiver imagens, copiar arquivos via Dashboard ou script (Storage não tem RENAME bucket). (3) Atualizar `ImportImagens.tsx` para apontar para o novo bucket. (4) Atualizar registros `product_variants.imagem_url` para nova URL pública (regex replace `produto-imagens` → `produtos-imagens` em UPDATE em massa). |
| **OS-registered state** | Nenhum — projeto roda em Vercel (frontend) + Supabase (backend), sem agentes OS. | None — verified by checking architecture: Vercel deploy via git, Supabase managed, sem Tailscale/PM2/cron local. |
| **Secrets / env vars** | `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (lidos em `src/integrations/supabase/client.ts`). Edge functions usam `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Deno env). **Nenhum secret muda** — só schema. | None — verified by reading `import-produtos/index.ts` (linhas 23-26) e `import-precos/index.ts` (linhas 16-18). |
| **Build artifacts / installed packages** | Tipos auto-gerados em `src/integrations/supabase/types.ts` (verificado linhas 438-528 — schema produtos atual). | **Code edit obrigatório**: após migration, rodar `npx supabase gen types typescript` (ou via CLI Supabase) para regenerar `types.ts`. Sem isso, TypeScript não enxerga `product_variants` nem `products`. |

**Canonical migration question answered:** Após migration:
- `produtos` (view) continua respondendo SELECT idêntico ao da tabela antiga → 5 leituras client-side seguras
- `product_variants` (renomeada) preserva todas as FKs (`vinculos_spot_lampada.codigo_spot/codigo_lampada` continuam válidas)
- 4646 linhas existentes ganham `product_id = P-LEGADO`, `origem = 'legado'`, `editado_manualmente = false`, `atributos = '{}'`
- Master XLSX adiciona/atualiza incrementalmente (UPSERT via reconcile)

## Common Pitfalls

### Pitfall 1: View `produtos` quebra writes
**What goes wrong:** Após renomear `produtos`→`product_variants` e criar view, qualquer `UPDATE produtos SET ...` falha (views só leitura por padrão).

**Why it happens:** Postgres views simples não suportam INSERT/UPDATE/DELETE direto.

**How to avoid:** (1) Antes da migration, listar todos os `from('produtos').update/insert/delete` e migrá-los para `from('product_variants')`. Verificado: `Admin.tsx:96` (select), `ProdutoEditDialog.tsx:74-82` (UPDATE), `ImportImagens.tsx:144` (UPDATE), `ImportPrecos` edge fn (UPDATE), `ImportProdutos` edge fn (UPSERT). (2) Alternativa: criar `INSTEAD OF` triggers na view para tornar gravável — mais código, mais risco. **Não recomendado.**

**Warning signs:** Erro Supabase "cannot update view 'produtos'" no console no primeiro CSV import pós-migration.

### Pitfall 2: `editado_manualmente` não setado em paths não-óbvios
**What goes wrong:** Admin edita produto via SQL Editor (caminho documentado em Phase 2 SUMMARY 02-04 — script SQL pra atribuir arquiteto em massa). Master subsequente sobrescreve o trabalho do Admin.

**Why it happens:** D-08 só dispara em `ProdutoEditDialog`. SQL bypass não seta a flag.

**How to avoid:** (1) Documentar no plan que SQL bypass deve setar `editado_manualmente = true` na mesma transação. (2) Considerar trigger condicional: `IF (OLD.<colunas_editaveis> IS DISTINCT FROM NEW.<colunas_editaveis>) THEN NEW.editado_manualmente = true`. **Risco:** trigger dispara também no UPDATE feito pelo edge fn de import master (que é exatamente o que NÃO queremos). Solução: trigger checa `current_user`/role — se for service_role do edge fn, ignora. Complexo, deixar para phase futura.

**Warning signs:** Bug report "atribui arquiteto via SQL e sumiu na próxima importação".

### Pitfall 3: UUID vs codigo na chave de orçamento
**What goes wrong:** Snapshot de orçamento (em `orcamentos.ambientes` jsonb) referencia `produtos` por `codigo` (string), não por UUID. Após rename para `product_variants` o `id` (UUID) muda? Não — `RENAME TO` preserva tudo, inclusive PKs. Mas se em algum momento Claude resolver "limpar" e recriar, UUIDs mudam.

**How to avoid:** (1) Migration usa `RENAME`, não `CREATE TABLE + INSERT SELECT`. (2) Tarefa de validação no plan: rodar SELECT em alguns SKUs antes da migration, comparar UUID após — devem ser idênticos. (3) Também garantir que código (`codigo`) é UNIQUE NOT NULL e continua sendo a chave de business.

**Warning signs:** Orçamentos antigos abrem com produtos "não encontrados" no autocomplete (UUID mismatch).

### Pitfall 4: Tensão como string vs INTEGER
**What goes wrong:** Master traz `Variante_Tensao` como string (`"127V/220V"`, `"24V DC"`, `"48V DC"`). Schema atual exige `tensao INTEGER` com CHECK constraint `tensao IN (12, 24, 48)`. UPSERT falha em todas as 1264 variantes que não têm tensão padrão.

**How it happens:** Verificado fisicamente: 1264 variantes têm `Variante_Tensao = (none)`, 431 têm `"127V/220V"`, 77 têm `"24V DC"`, 70 têm `"12V DC"`, 21 têm `"48V DC"`, 50 têm `"127V"`, 47 têm `"250V"` (todas mãos master).

**How to avoid:** (1) Parser específico (`parseTensao(s: string): number | null`) que extrai 12/24/48 de strings tipo "12V DC", "24V DC", "48V DC". (2) Strings que não casam (ex: "127V/220V", "250V") vão para `atributos.tensao_raw` em vez de coluna typed. (3) NÃO reescrever CHECK constraint — manter regra de negócio (12/24/48 são tensões DC reais para fitas LED, é proposital). (4) Documentar no exemplo da master: "se você quer tensao DC para fita, use 12, 24 ou 48; valores de luminária que não são DC vão pro jsonb".

**Warning signs:** Toast erro "violates check constraint check_tensao" na primeira import master.

### Pitfall 5: Esquecer de regenerar types.ts
**What goes wrong:** Após migration, `src/integrations/supabase/types.ts` ainda mostra schema antigo (tabela `produtos` com 25 cols). TypeScript não compila chamadas a `from('product_variants').update({editado_manualmente: true})`.

**How to avoid:** Plan inclui task explícita "regenerar types após migration" usando `npx supabase gen types typescript --project-id jkewlaezvrbuicmncqbj > src/integrations/supabase/types.ts` (visto no formato em `types.ts` linha 13: `PostgrestVersion: "14.4"` é metadata da auto-gen).

**Warning signs:** `npx tsc --noEmit` falha em qualquer `.tsx` que toca product_variants.

### Pitfall 6: AU coringa não aparece no autocomplete do orçamento
**What goes wrong:** D-12 exige que AU001..16 apareçam no `useProdutoSearch` igual qualquer outro SKU. Se a query original tem filtro restritivo (ex: `tipo_produto IN (...)`), os AU sem `tipo_produto` setado podem ser filtrados fora.

**How to avoid:** Verificado em `useProdutoSearch.ts:26-29`: filtros são opcionais (`if (filtro === 'fita' || ...)`). Default `'todos'` retorna tudo. **Seguro como está.** Plan só precisa garantir que o seed de AU não complete `tipo_produto` com valor que conflita com filtros.

**Warning signs:** No PDF/orçamento, "AU001" não aparece quando colaborador busca.

### Pitfall 7: Bucket existente conflitante (`produto-imagens` vs `produtos-imagens`)
**What goes wrong:** Já existe bucket `produto-imagens` (singular) usado por `ImportImagens.tsx:141`. CONTEXT D-14 locka `produtos-imagens` (plural). Se Plan criar o novo sem remover o antigo, fica órfão. Se renomear (não suportado), quebra `imagem_url` antigos.

**How to avoid:** (1) Migration SQL cria o NOVO bucket `produtos-imagens`. (2) Script (manual ou Plan task) lista objetos do antigo, copia para o novo (storage API), atualiza URLs em `product_variants.imagem_url` via UPDATE em massa (`REPLACE(imagem_url, '/produto-imagens/', '/produtos-imagens/')`). (3) Após confirmação, deletar bucket antigo via Dashboard. **Plan deve documentar o passo manual ou rodar via SQL com `storage.objects` direto.**

**Warning signs:** Imagens existentes não carregam após migration; PDF gera com placeholder.

## Code Examples

Verified patterns from official sources e do próprio codebase:

### Exemplo 1: SQL Migration (mover produtos → product_variants + view)

```sql
-- Source: convenções já estabelecidas em
-- supabase/migrations/20260423000001_create_arquitetos.sql (RLS pattern)
-- supabase/migrations/20260319000001_campos_tecnicos_produtos.sql (CHECK constraints)
-- supabase/migrations/20260319000003_vinculos_spot_lampada.sql (has_role policy)

-- Migration: 20260501000001_products_and_variants.sql

BEGIN;

-- 1. Cria tabela products (pais)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_pai TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  tipologia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_codigo_pai ON public.products(codigo_pai);
CREATE INDEX idx_products_categoria ON public.products(categoria);

-- 2. Cria pai dummy P-LEGADO
INSERT INTO public.products (codigo_pai, nome, categoria, tipologia)
  VALUES ('P-LEGADO', 'Produtos Legados', NULL, NULL);

-- 3. Renomeia produtos → product_variants (preserva TODAS as FKs!)
ALTER TABLE public.produtos RENAME TO product_variants;

-- 4. Adiciona colunas novas
ALTER TABLE public.product_variants
  ADD COLUMN product_id UUID REFERENCES public.products(id),
  ADD COLUMN origem TEXT NOT NULL DEFAULT 'legado'
    CHECK (origem IN ('master', 'legado', 'coringa', 'manual')),
  ADD COLUMN editado_manualmente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN nome TEXT;

-- 5. Vincula todos os legados ao P-LEGADO
UPDATE public.product_variants
  SET product_id = (SELECT id FROM public.products WHERE codigo_pai = 'P-LEGADO');

-- 6. NOT NULL após backfill
ALTER TABLE public.product_variants
  ALTER COLUMN product_id SET NOT NULL;

CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_origem ON public.product_variants(origem);
CREATE INDEX idx_product_variants_editado ON public.product_variants(editado_manualmente);

-- 7. Cria view de compatibilidade
CREATE VIEW public.produtos AS
  SELECT
    pv.id, pv.codigo, pv.descricao, pv.preco_tabela, pv.preco_minimo,
    pv.imagem_url, pv.tensao, pv.watts_por_metro, pv.largura_mm,
    pv.tipo_produto, pv.subtipo, pv.sistema, pv.familia_perfil,
    pv.passadas_padrao, pv.largura_canal_mm, pv.driver_max_watts,
    pv.driver_tipo_permitido, pv.somente_baby, pv.tamanho_rolo_m,
    pv.fator_spot, pv.potencia_watts, pv.cor, pv.aplicacao,
    pv.arquiteto_id, pv.created_at
  FROM public.product_variants pv;

-- 8. Replicar RLS de produtos antiga para product_variants (se RLS não veio com rename)
-- Verificar: ALTER TABLE produtos ENABLE ROW LEVEL SECURITY (já estava? checar)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read products"
  ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can read product_variants"
  ON public.product_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage product_variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.products IS 'Produto pai (master 2026 + dummy P-LEGADO + AU coringa). Phase 3.';
COMMENT ON TABLE public.product_variants IS 'SKU. FK para products. Phase 3 (renomeada de produtos).';
COMMENT ON VIEW public.produtos IS 'View de compatibilidade backward-compat. Lê de product_variants. Não use para INSERT/UPDATE/DELETE — vá direto em product_variants.';

COMMIT;
```

### Exemplo 2: Function reconcile() em TypeScript puro

```typescript
// src/lib/reconcileProducts.ts
// Source: derivado das regras D-05/D-06/D-07/D-08 do CONTEXT.md

export type Origem = 'master' | 'legado' | 'coringa' | 'manual';

export interface MasterVariantRow {
  sku: string;
  produto_id: string;        // P0001 etc
  variante_nome: string;
  categoria: string;
  tipologia: string;
  atributos: Record<string, unknown>;
  // colunas mapeadas (opcionais)
  tensao?: number | null;
  watts_por_metro?: number | null;
  largura_mm?: number | null;
  potencia_watts?: number | null;
  cor?: string | null;
  // ...
}

export interface DbVariantRow {
  id: string;
  sku: string;
  product_id: string;
  origem: Origem;
  editado_manualmente: boolean;
  arquiteto_id: string | null;
  preco_tabela: number | null;
  preco_minimo: number | null;
}

export type SkippedReason = 'editado_manualmente' | 'origem_coringa';

export interface ReconcileReport {
  creates: MasterVariantRow[];
  updates: Array<{ id: string; sku: string; patch: Record<string, unknown> }>;
  skipped: Array<{ sku: string; reason: SkippedReason }>;
  legados_preserved: string[];
}

export function reconcile(
  master: MasterVariantRow[],
  db: DbVariantRow[],
): ReconcileReport {
  const dbBySku = new Map(db.map(v => [v.sku, v]));
  const masterSkus = new Set(master.map(v => v.sku));

  const creates: MasterVariantRow[] = [];
  const updates: ReconcileReport['updates'] = [];
  const skipped: ReconcileReport['skipped'] = [];

  for (const m of master) {
    const existing = dbBySku.get(m.sku);
    if (!existing) {
      creates.push(m);  // D-07
      continue;
    }
    if (existing.origem === 'coringa') {
      skipped.push({ sku: m.sku, reason: 'origem_coringa' });  // D-10
      continue;
    }
    if (existing.editado_manualmente) {
      skipped.push({ sku: m.sku, reason: 'editado_manualmente' });  // D-05
      continue;
    }
    // D-05: master sobrescreve, mas preserva preço + arquiteto
    updates.push({
      id: existing.id,
      sku: m.sku,
      patch: {
        nome: m.variante_nome,
        atributos: m.atributos,
        tensao: m.tensao ?? null,
        watts_por_metro: m.watts_por_metro ?? null,
        largura_mm: m.largura_mm ?? null,
        potencia_watts: m.potencia_watts ?? null,
        cor: m.cor ?? null,
        origem: 'master',
        // NÃO incluir: arquiteto_id, preco_tabela, preco_minimo, editado_manualmente
      },
    });
  }

  const legados_preserved = db
    .filter(v => !masterSkus.has(v.sku))
    .map(v => v.sku);

  return { creates, updates, skipped, legados_preserved };
}
```

### Exemplo 3: Mapper colunas master → schema typed vs jsonb

```typescript
// src/lib/productAttributes.ts
// Source: derivado da inspeção física da master + schema atual

const PARSE_TENSAO_RE = /^(\d+)V\s*DC\b/i;

/** Extrai 12, 24 ou 48 de strings tipo "12V DC", "24V DC", "48V DC". Retorna null para outros casos (vão pro jsonb). */
export function parseTensao(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(PARSE_TENSAO_RE);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return [12, 24, 48].includes(v) ? v : null;
}

/** Extrai watts numéricos de "10W/m", "5W", "38W" etc. */
export function parsePotencia(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^([\d,.]+)\s*W/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return isFinite(n) ? n : null;
}

/** Mapeia uma linha da aba Variantes da master para shape de product_variants. */
export function mapMasterRow(row: Record<string, unknown>): MasterVariantRow {
  const sku = String(row.SKU ?? '').trim();
  const produto_id = String(row.produto_id ?? '').trim();
  const variante_nome = String(row.Variante_Nome ?? '').trim();

  // Colunas typed (mapeadas)
  const tensao = parseTensao(row.Variante_Tensao);
  const wpm_raw = row.Tipologia === 'Fita LED' ? parsePotencia(row.Variante_Potencia) : null;
  const watts_por_metro = wpm_raw;
  const potencia_watts = row.Tipologia !== 'Fita LED' ? parsePotencia(row.Variante_Potencia) : null;

  // Tudo o que não cabe em coluna vai pra atributos (para preservar dado original)
  const atributos: Record<string, unknown> = {
    instalacao: row.Variante_Instalacao,
    tipo: row.Variante_Tipo,
    cor_peca: row['Variante_Cor da peca'],
    temperatura_k: row['Variante_Temperatura da luz (K)'],
    cor_iluminacao: row['Variante_Cor da iluminacao'],
    lumens: row.Variante_Lumens,
    eficiencia: row.Variante_Eficiencia,
    irc: row.Variante_IRC,
    angulo: row.Variante_Angulo,
    tensao_raw: row.Variante_Tensao,  // preserva string original
    fator_potencia: row['Variante_Fator de Potencia'],
    frequencia: row.Variante_Frequencia,
    material: row.Variante_Material,
    cabo: row.Variante_Cabo,
    driver_incluso: row['Variante_Driver incluso'],
    dimensao: row.Variante_Dimensao,
    nicho: row.Variante_Nicho,
    variante: row.Variante_Variante,
    familia: row.Variante_Familia,
    pagina: row.Variante_Pagina,
    observacoes: row.Variante_Observacoes,
  };

  return {
    sku,
    produto_id,
    variante_nome,
    categoria: String(row.Categoria ?? ''),
    tipologia: String(row.Tipologia ?? ''),
    atributos,
    tensao,
    watts_por_metro,
    potencia_watts,
    largura_mm: null,  // master não traz
    cor: typeof row['Variante_Cor da peca'] === 'string' ? row['Variante_Cor da peca'] as string : null,
  };
}
```

### Exemplo 4: Gerar template XLSX baixável (IMP-04)

```typescript
// Source: padrão xlsx 0.18.5 — XLSX.utils + writeFile (cliente)
import * as XLSX from 'xlsx';

export function downloadProdutosTemplate() {
  const data = [
    {
      codigo: 'LM9999',
      descricao: 'Exemplo: Spot LED 5W 24V',
      categoria: 'Sistemas Lineares',
      tipologia: 'Spot',
      tensao: 24,
      watts_por_metro: '',
      potencia_watts: 5,
      cor: 'Preto',
      imagem_url: 'https://exemplo.com/img.jpg ou nome-do-arquivo.jpg',
      preco_tabela: '',  // deferido — D-18
      preco_minimo: '',  // deferido
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

  // Aba de instruções
  const instrucoes = [
    ['Coluna', 'Obrigatório?', 'Formato', 'Notas'],
    ['codigo', 'SIM', 'string', 'Chave única (SKU). Ex: LM2847'],
    ['descricao', 'SIM', 'string', 'Descrição do produto'],
    ['categoria', 'NÃO', 'string', 'Ex: Area Externa, Fitas e Drivers'],
    ['tipologia', 'NÃO', 'string', 'Ex: Arandela, Fita LED'],
    ['tensao', 'NÃO', 'integer', 'Apenas 12, 24 ou 48 (DC). Outros valores vão pra atributos.'],
    ['watts_por_metro', 'NÃO', 'numeric', 'Para fitas LED apenas'],
    ['potencia_watts', 'NÃO', 'numeric', 'Potência total do produto'],
    ['cor', 'NÃO', 'string', 'Ex: Preto, Branco, Dourado'],
    ['imagem_url', 'NÃO', 'string', 'URL pública (https://...) OU nome do arquivo (subir em "Importar imagens")'],
    ['preco_tabela', 'DEFERIDO', '—', 'Não importado nesta versão (D-18). Use a tela "Atualizar preços".'],
    ['preco_minimo', 'DEFERIDO', '—', 'Idem.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  XLSX.writeFile(wb, 'template-produtos.xlsx');
}
```

### Exemplo 5: Upload imagem com botão no ProdutoEditDialog

```typescript
// Trecho a adicionar em ProdutoEditDialog.tsx (D-16)
// Source: padrão visto em ImportImagens.tsx:141-144

const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Imagem maior que 2MB');
    return;
  }
  setUploading(true);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${produto?.codigo}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('produtos-imagens')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) {
    toast.error('Erro no upload: ' + upErr.message);
    setUploading(false);
    return;
  }

  const { data } = supabase.storage.from('produtos-imagens').getPublicUrl(path);
  setImagemUrl(data.publicUrl);
  setUploading(false);
  toast.success('Imagem enviada');
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tabela achatada `produtos` (25 colunas) | Pai/filho `products`+`product_variants` com `atributos jsonb` | Phase 3 (esta) | Master tem 27 specs por variante; jsonb evita schema explosion |
| Image upload via 1 input por linha em CSV mapper | Bulk uploader dedicado (`ImportImagens.tsx`) com filename → SKU matching | já em prod (Phase pré-Marco 1) | Reaproveitado nesta phase |
| `produtos` UPSERT cego com `onConflict: codigo` | UPSERT condicional via `reconcile()` honrando `editado_manualmente` | Phase 3 | Edits manuais do admin não somem na próxima master |
| Importação CSV única para todo tipo de mudança | Dois fluxos: master (one-shot/anual) + diário (CSV manual) | Phase 3 | Cadências diferentes; UX dedicada para cada |

**Deprecated/outdated:**
- `ImportPrecos.tsx` → marcar "indisponível nesta versão" ou esconder da UI (D-18 deferido). Plan decide se mantém o arquivo dormente ou move pra `_deferred/`.
- `import-precos` edge function → mantida no repo mas não invocada da UI nesta phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | xlsx 0.18.5 parseia 2088 rows em < 1s no browser | Pattern 4 / Standard Stack | Se demorar mais de 30s, user pensa que travou. Mitigação: spinner + progress (já tem em ImportMapper). |
| A2 | Bucket Supabase Storage pode ser criado via SQL `INSERT INTO storage.buckets` | Pattern 3 / Code Example 3 | Se falhar, criar via Dashboard UI (1 clique). Plan deve aceitar fallback. |
| A3 | `RENAME TO product_variants` preserva TODAS as FKs (`vinculos_spot_lampada.codigo_spot`/`codigo_lampada`) | Pattern 1 | Se quebrar (improvável), reverter via DOWN migration e usar abordagem CREATE+COPY+DROP (mais arriscada). |
| A4 | Bucket antigo `produto-imagens` (singular) tem poucas/nenhuma imagem em prod | Pitfall 7 / Runtime State | Não inspecionei prod via Dashboard. Plan deve incluir task de auditoria (listar `storage.objects` filtrando por `bucket_id='produto-imagens'`) ANTES de criar o novo bucket, e decidir se migra ou não. |
| A5 | Snapshots em `orcamentos.ambientes` lêem só de jsonb interno, sem JOIN com `produtos` | Project Constraints / Pitfall 3 | Se algum lugar lê `orcamentos.ambientes` e enriquece com query de `produtos`, view de compat resolve. Verifiquei `gerarPdfHtml.ts` — sem `from('produtos')`. Outros callers não 100% inspecionados. Plan deve incluir grep `from('produtos')\|from('product_variants')` antes de aplicar migration. |
| A6 | Trigger Postgres pra setar `editado_manualmente=true` em UPDATE não compensa | Pitfall 2 / Pattern 2 | Se admin usar SQL bypass com frequência, master vai sobrescrever silenciosamente. Mitigação: documentar no plan que SQL bypass deve incluir `SET editado_manualmente = true`. |
| A7 | Validar-sistema-orcamento edge fn não consulta `produtos` | Project Constraints | VERIFICADO: lê apenas `regras_compatibilidade_perfil`. Confirmação 100%. |
| A8 | A coluna `codigo` em product_variants continuará UNIQUE NOT NULL após rename | Pattern 1 / Code Example 1 | Verificado em types.ts:469 — `codigo: string` (não nullable na Insert). Constraint preserva-se com RENAME. |
| A9 | Phase 3 não precisa migrar 4646 imagens existentes (a maioria não tem imagem ainda) | Runtime State | Não inspecionei prod. Plan deve incluir SQL de auditoria: `SELECT count(*) FROM produtos WHERE imagem_url IS NOT NULL` para dimensionar esforço de migração de bucket. |
| A10 | UI "+Novo Produto" pode aparecer só na aba Produtos (não em outro lugar) | UI Surface | Lock D-23 fala de sub-tab para master vs diário, mas não menciona localização do botão "+Novo Produto". Recomendação: dentro da aba Produtos. Plan pode redefinir. |

**Observação:** A1, A2, A4, A5, A9 são as mais sensíveis. Plan deve incluir tasks de auditoria/preflight para A4 e A9 antes da migration.

## Open Questions

1. **Origem 'manual' deve existir no CHECK constraint?**
   - **What we know:** D-08 fala em `editado_manualmente=true` quando admin edita via UI. CONTEXT D-01 lista origens master/legado/coringa apenas.
   - **What's unclear:** Quando admin cria um produto NOVO via "+Novo Produto" (PROD-01), qual `origem` recebe?
   - **Recommendation:** Adicionar `'manual'` ao CHECK constraint (visto no Code Example 1) — semanticamente diferente de `master` (vem da master xlsx) e `legado` (já estava). Plan deve confirmar com user no `/gsd-discuss-phase` ou trava como decisão própria.

2. **Bucket antigo `produto-imagens` tem dados?**
   - **What we know:** `ImportImagens.tsx:141` aponta para `produto-imagens` (singular).
   - **What's unclear:** Quantos objetos existem? Quantos `product_variants.imagem_url` apontam para ele?
   - **Recommendation:** Plan task #1 da fase: query `SELECT count(*) FROM storage.objects WHERE bucket_id='produto-imagens'` e `SELECT count(*) FROM produtos WHERE imagem_url LIKE '%produto-imagens%'`. Se for 0, criar bucket novo do zero. Se > 0, migrar.

3. **Pais (products) pra SKUs OR (Orluce — 54 unidades)?**
   - **What we know:** OR1764 etc. estão na master com `produto_id=P0039`. Estão dentro do escopo "60 pais + 2088 variantes".
   - **What's unclear:** Eles devem aparecer no autocomplete do orçamento? Têm preço? Estão em prod hoje?
   - **Recommendation:** Tratá-los como qualquer outro SKU master. Sem regra especial. Se em prod o Lenny tiver feedback diferente, fold em phase futura.

4. **Mapping completo das 27 colunas Variante_X → schema atual: typed columns vs atributos?**
   - **What we know:** Schema typed cobre: tensao, watts_por_metro, largura_mm, tipo_produto, subtipo, sistema, familia_perfil, passadas_padrao, largura_canal_mm, driver_max_watts, driver_tipo_permitido, somente_baby, tamanho_rolo_m, fator_spot, potencia_watts, cor, aplicacao (17 cols).
   - **What's unclear:** Master tem 27 cols (incluindo Lumens, Eficiencia, IRC, Angulo, Material, Cabo, Dimensao, Nicho, Familia, Pagina, Observacoes — 11 que NÃO têm coluna typed).
   - **Recommendation:** Plan especifica:
     - Para typed (17 cols): plan tabela de mapeamento exato (ex: `Variante_Potencia` → `potencia_watts` via `parsePotencia()`).
     - Para untyped (11 cols + 5 redundantes): tudo pra `atributos jsonb` (ver Code Example 3).
     - **Observação técnica:** `Variante_Tipo` existe em 270 variantes (12%) — provavelmente vai pra `tipo_produto` mas precisa parser ('Luminaria' → ?, 'Fita' → 'fita', 'Acessorio' → 'acessorio', 'Lampada' → 'lampada'). Plan decide se preenche ou deixa null.

5. **Precisamos de seed/script de teste para reconciliação?**
   - **What we know:** vitest + RTL já configurados (`src/test/example.test.ts` existe).
   - **What's unclear:** Plan deve incluir testes unitários de `reconcile()` (lógica pura, alta cobertura)?
   - **Recommendation:** SIM — função pura é alvo perfeito para testes. Casos: (a) SKU only-master → create, (b) SKU only-DB → preserved, (c) SKU em ambos com `editado_manualmente=true` → skipped, (d) SKU em ambos com origem=coringa → skipped, (e) SKU em ambos sem flags → updated com patch sem preço/arquiteto. Adicionar 1 plan-task "tests for reconcile()".

## Environment Availability

> Phase 3 toca infra Supabase + assets físicos (planilha master). Aplicável.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `xlsx` | Master parsing + template download | ✓ | 0.18.5 | — |
| `@supabase/supabase-js` | DB + Storage | ✓ | 2.95.3 | — |
| `vitest` | Tests for reconcile() | ✓ | 3.2.4 | — |
| `base_dados_site_2026.xlsx` | Master import | ✓ | versão atual em `C:\Users\lenny\Downloads\` | Inspecionar via xlsx no plan se layout mudar |
| Supabase CLI | Aplicar migration + regenerar types | ✓ (assumido — já em uso desde Phase 1) | Phase 1 SUMMARY confirma | Aplicar via Dashboard SQL Editor |
| Node 18+ | dev e build | ✓ (assumido — projeto roda em Vercel) | sem .nvmrc | Vercel já usa LTS |
| Bucket `produtos-imagens` (Supabase Storage) | Imagens | ✗ — precisa criar | — | Migration cria + Dashboard como fallback |
| Tabela `products` | Master FK + AU coringa | ✗ — precisa criar | — | Migration |
| Tabela `product_variants` | (= `produtos` renomeada) | ✓ via rename | — | — |
| View `produtos` | Backward-compat com 5+ leituras client-side | ✗ — precisa criar | — | Migration |

**Missing dependencies with no fallback:** Nenhuma — toda peça tem fallback ou já existe.

**Missing dependencies with fallback:** Bucket Storage e tabelas novas — todas criáveis na própria phase.

## Validation Architecture

> `workflow.nyquist_validation` está `false` em `.planning/config.json`. **Seção opcional, mantida abaixo como guidance ligth para o Plan.**

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 + @testing-library/react 16.0.0 + jsdom 20.0.3 |
| Config file | `vitest.config.ts` (verificado: alias `@`, env jsdom, setupFiles `./src/test/setup.ts`) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Existing? |
|--------|----------|-----------|-------------------|-----------|
| PROD-01 | Form de novo produto cria registro com `origem='manual'`, `editado_manualmente=true` | unit (mock supabase) | `vitest src/components/ProdutoEditDialog.test.tsx` | ❌ Wave 0 |
| IMP-01 | UPSERT cria SKU novo e atualiza existente | unit | `vitest src/lib/reconcileProducts.test.ts` | ❌ Wave 0 |
| IMP-05 | reconcile() retorna creates/updates/skipped corretos | unit | `vitest src/lib/reconcileProducts.test.ts` | ❌ Wave 0 |
| IMP-06 | Erro em 1 linha não para batch | unit (mock edge fn) | `vitest src/components/ImportProdutos.test.tsx` | ❌ Wave 0 |
| Schema migration aplicada | view `produtos` retorna mesmo shape | manual (SQL Editor query antes/depois) | n/a | n/a |

### Sampling Rate
- **Per task commit:** `npm run test` (rápido, < 5s)
- **Per wave merge:** `npm run test && npm run lint && npx tsc --noEmit`
- **Phase gate:** Smoke manual com 1 SKU master + 1 AU coringa + 1 SKU legado em prod

### Wave 0 Gaps
- [ ] `src/lib/reconcileProducts.ts` (função + tests) — covers IMP-01, IMP-05
- [ ] `src/lib/parseMasterXlsx.ts` (mapper) + tests
- [ ] `src/lib/productAttributes.ts` (parsers tensao/potencia) + tests

(Plan pode descartar 1 ou todos se não precisar — `nyquist_validation: false` no config.)

## Security Domain

> `security_enforcement` não é mencionado no config — assume habilitado. Análise resumida (escopo Phase 3).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim | Supabase Auth (já em uso). Rotas admin via `AdminRoute` |
| V3 Session Management | sim | Supabase Auth (autorefresh, localStorage) — sem mudança nesta phase |
| V4 Access Control | sim | RLS em `products` + `product_variants` + bucket `produtos-imagens`: read autenticado / write admin via `has_role(auth.uid(), 'admin')` |
| V5 Input Validation | sim | Validação de XLSX rows — usar `zod` schemas para `MasterVariantRow` e `CsvProdutoRow`. Limitar tamanho de arquivo upload (2MB já em ImportImagens). Sanitizar `codigo` (no espaços, no caracteres especiais SQL — embora Supabase prepared statements protejam) |
| V6 Cryptography | n/a | — |
| V7 Error Handling | sim | Erros toast pt-BR para user; console.error só na origem; relatório XLSX baixável (já em ImportMapper) |

### Known Threat Patterns for {React+Vite+Supabase stack}

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Admin sobe XLSX malicioso (formula injection ou ZIP bomba) | Tampering / DoS | xlsx 0.18.5 não executa formulas. Limitar tamanho via `<input accept=".xlsx,.csv">` + checagem de bytes ANTES de parsing. |
| Bypass de RLS em `product_variants` via service_role inadvertido | Elevation | Edge functions usam `SERVICE_ROLE_KEY` (bypass RLS) — somente edge fns devem usar. Client SDK usa anon/auth keys. Plan não deve introduzir novos service_role calls fora de import-master/import-produtos. |
| User não-admin escreve no bucket | Elevation | Policy SQL na criação do bucket (ver Pattern 3) restringe `INSERT/UPDATE/DELETE` a admin via `has_role`. |
| User upload imagem com extensão .exe/.html (XSS via SVG) | Tampering | `accept=".jpg,.jpeg,.png,.webp"` (já em ImportImagens). Plan estende validação no ProdutoEditDialog upload (mesma whitelist). |
| Filename traversal (`../../foo.jpg`) | Tampering | Path = `${codigo}.${ext}` derivado, não direto do filename do user (já em ImportImagens). Mantém. |
| SQL injection via importação CSV (codigo com `'; DROP ...`) | Tampering | Supabase JS SDK usa prepared statements. Mitigado por design. Validar formato de `codigo` (regex `^[A-Z0-9-]+$`) como defesa em profundidade. |
| Reconcile sobrescreve preço do admin | Tampering (Lossy data) | `reconcile()` exclui explicitamente preco_tabela/preco_minimo do patch (D-05). Test cobre. |

## Sources

### Primary (HIGH confidence)
- **Codebase do projeto** (verificado linha-a-linha):
  - `src/integrations/supabase/types.ts:438-528` — schema atual de `produtos`
  - `src/components/ProdutoEditDialog.tsx` — Dialog atual (Phase 2 entrega)
  - `src/components/ArquitetoAutocomplete.tsx` + `ImportProdutos.tsx` + `ImportImagens.tsx` + `ImportPrecos.tsx` + `ImportMapper.tsx` — patterns reusáveis
  - `src/pages/Admin.tsx:42-104` — abas Importação e Produtos
  - `src/hooks/useProdutoSearch.ts` — leitura `produtos` cliente-side
  - `supabase/functions/import-produtos/index.ts` — edge fn UPSERT pattern
  - `supabase/functions/validar-sistema-orcamento/index.ts` — confirmado: NÃO consulta `produtos`
  - `supabase/migrations/20260319000003_vinculos_spot_lampada.sql:38` — `has_role(auth.uid(), 'admin')` pattern + FK em `produtos.codigo`
  - `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql` — 25 colunas técnicas + CHECK constraints
  - `supabase/migrations/20260423000003_produtos_arquiteto.sql` — `arquiteto_id` FK em produtos
- **base_dados_site_2026.xlsx** (inspecionado fisicamente em 2026-04-30 via `node -e "const XLSX = require('xlsx'); ..."`):
  - 4 abas confirmadas: Produtos (61 rows), Variantes (2089 rows), Base Completa flat (2089), Resumo (52)
  - 27 colunas Variantes_X verificadas + distribuição de tensão
- **CONTEXT.md** Phase 3 — 23 decisões locked (D-01..D-23)
- **REQUIREMENTS.md** — PROD-01..04, IMP-01..06
- **ROADMAP.md** §"Phase 3" — goal e success criteria
- **Phase 2 SUMMARIES** — patterns ClienteDialog/ArquitetoDialog/ProdutoEditDialog estabelecidos

### Secondary (MEDIUM confidence)
- npm registry: `xlsx` 0.18.5 confirmada como versão atual em 2024-10-22 (verificado via `npm view`)
- Supabase Storage docs (WebFetch) — confirma RLS pattern com policies em `storage.objects` + bucket público

### Tertiary (LOW confidence)
- ASSUMED A1 (parsing speed 2088 rows < 1s) — extrapolação de precedente ImportMapper, não medido nesta master específica
- ASSUMED A2 (criar bucket via SQL) — padrão documentado mas não rodei nesta sessão
- ASSUMED A4 (estado do bucket antigo `produto-imagens`) — não inspecionei prod via Dashboard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas as deps verificadas em package.json + funcionando em prod (precedentes Phase 1 e 2)
- Architecture: HIGH — pai/filho + view de compat é padrão Postgres bem documentado; `ALTER TABLE RENAME` preserva FKs por design
- Pitfalls: HIGH (1, 3, 4, 5, 6) / MEDIUM (2, 7) — pitfall 2 depende de comportamento OS-bypass do admin (anedótico), pitfall 7 depende de inspeção prod não feita
- Schema mapping: MEDIUM — typed cols vs jsonb foi planejado mas mapeamento exato fica para o plan inspecionar 1-by-1
- Security: HIGH — replicação direta dos patterns RLS já validados em `vinculos_spot_lampada` e `arquitetos`

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 dias — codebase estável; única coisa que pode mudar é a master xlsx receber nova versão)

---

*Phase 3 research complete. Planner pode prosseguir para 5 plans recomendados (ver "Primary recommendation" no Summary).*
