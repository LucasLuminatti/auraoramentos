# Phase 3: Produtos & Importação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 03-produtos-importa-o
**Areas discussed:** Schema + Reconciliação, Cruzamento preços ↔ master, AU001..AU016 + PROD-02, Imagens

---

## Schema (produto-pai vs variantes)

| Option | Description | Selected |
|--------|-------------|----------|
| 1 tabela — produtos flat | Adicionar ~25 colunas em produtos. Cada SKU é uma linha independente. | |
| 2 tabelas — produtos_modelo + produtos_variante | products (60 linhas) + product_variants (FK pra modelo + SKU). Espelha planilha 1:1. | ✓ (com ajustes) |
| Tabela atual + JSON column de specs | Coluna jsonb 'specs' com todos os 27 campos. | (parcialmente) |

**User's choice:** 2 tabelas, mas com 3 ajustes:
1. Não fixar quantidade em ~60 — products derivado da master, sem limite fixo
2. Specs vão em `atributos jsonb` (não 27 colunas rígidas)
3. Adicionar `editado_manualmente boolean` pra controlar sobrescrita futura

**Notes:** User levantou risco real do "como agrupar variantes em products" — mitigado pelo fato da master já ter produto_id (P0001..P0060) explícito.

---

## Reconciliação (DB atual vs master)

| Option | Description | Selected |
|--------|-------------|----------|
| Substituir tudo (master vira fonte) | Apaga 4646 atuais, sobe 2088 da master. | |
| Mesclar — upsert por SKU, manter órfãos | Master ganha em comum. Órfãos viram 'descontinuado'. | |
| Mesclar — preserva edições manuais | Como acima mas preço/arquiteto não sobrescritos. | ✓ (variante) |

**User's choice:** Mesclar com regras específicas (texto livre):
- SKU em DB+master: master sobrescreve nome+specs; arquiteto_id preservado; preço ignorado; respeitar editado_manualmente
- SKU só no DB: mantém, origem='legado' (NÃO deletar)
- SKU só na master: cria, origem='master'
- Preço fora desta phase
- Adicionar `editado_manualmente boolean`

**Notes:** User foi enfático "NÃO deletar nada" e "marcar origem".

---

## Legados sem product_id

| Option | Description | Selected |
|--------|-------------|----------|
| 1 produto-pai genérico 'Legado' | products dummy P-LEGADO recebe todos | ✓ |
| product_id NULL nos legados | FK nullable | |
| Inferir produto-pai pelo código | Risco alto de agrupar errado | |

**User's choice:** 1 produto-pai genérico 'Legado'. Reagrupamento manual fica pra phase futura.

---

## Cruzamento preços ↔ master (Área B)

| Option | Description | Selected |
|--------|-------------|----------|
| Defere TUDO de preço pra phase futura | Phase 3 só catálogo. IMP-02 sai do escopo. | ✓ |
| Mantém preço na Phase 3, master é a base | CSV preços faz UPDATE por SKU; bloqueia desconhecido. | |
| Mantém preço na Phase 3, SKU desconhecido cria | Preço entra livre, mesmo sem master/legado. | |

**User's choice:** "preço é algo que vou colocar uma tabela em alguma phase só pra testarmos o projeto, mas acredito que quando a plataforma for utilizada o preço será atualizado uma vez por mes"

**Notes:** Justifica deferir — preço é fluxo periódico mensal, não dia-a-dia. Phase 3 fica focada só em catálogo/specs.

---

## AU001..AU016 vs PROD-02 (Área C)

| Option | Description | Selected |
|--------|-------------|----------|
| AU001..16 = PROD-02 | "16 sem descrição" = AU001..16 | |
| São coisas diferentes | AU001..16 = categorias; PROD-02 = SKUs LMxxxx incompletos | ✓ (verificado) |
| Iguais mas explicar mais | Free-text | |

**Verificação SQL no DB (2026-04-30):**
- Total produtos: 4646
- Produtos com prefixo AU: 0
- Produtos sem descrição: 0
- Produtos com preço 0: 0

**Conclusão:** PROD-02 obsoleto. AU001..16 são entidades novas.

### Papel dos AU001..AU016

| Option | Description | Selected |
|--------|-------------|----------|
| Produtos genéricos pra orçamento abstrato | Cliente pede "fita LED" → orçamento cita AU004 | (parcialmente) |
| Categorias hierárquicas (entidade nova) | Tabela 'categorias' separada | |
| Outro — descrever | Free-text | ✓ |

**User's choice:** "produtos coringa, se faltando um driver por ex no estoque ou não tem um driver específico no sistema, ele pega esse código, pq a partir do código ele já sabe os impostos sobre o produto, compra ele e dps só arruma a descrição"

### Imposto/categoria fiscal dos AU

| Option | Description | Selected |
|--------|-------------|----------|
| Não, sistema externo cuida | AURA só guarda código | (parcialmente) |
| Sim, AURA precisa ter campo | Coluna categoria_fiscal/aliquota | |
| Só categoria/grupo (sem número) | Tag em atributos jsonb | |

**User's choice:** "a unica coisa q tem q ter em relação a esses 16 produtos é adicionar descrição ou mudar e e imagme, então coloca descrição padrão e poder mudar"

**Conclusão:** AU001..16 leves — só descrição editável + imagem editável. Sem campo de imposto no AURA.

---

## Imagens (Área D)

**Verificação SQL:** Coluna `imagem_url` já existe em `produtos`.

| Option | Description | Selected |
|--------|-------------|----------|
| Upload via UI admin (Supabase Storage) | Botão upload no ProdutoEditDialog → bucket | (parcialmente) |
| URL externa (paste link) | Cola URL externa | |
| Ambos | Upload OU paste URL | |

**User's choice:** "pensei em te passar o caminho das imagens na rede, e vc cruza, mas como vc preferir, talvez te passos, vc pega tudo e coloca no supabase?"

**Conclusão final:** Híbrido — bulk upload one-shot inicial pro Supabase Storage (user fornece pasta com SKU.jpg) + UI admin pra uploads recorrentes.

---

## Claude's Discretion

- Estratégia de migração da tabela `produtos` atual pra `product_variants` (rename + view, OU migration com cópia)
- Naming convention exata do bucket Supabase Storage
- Sub-rota da UI de importação master vs CSV regular
- Mapeamento de quais colunas da master vão pra colunas existentes do schema vs `atributos jsonb`

## Deferred Ideas

- IMP-02 (preço via CSV) — phase futura
- Reagrupamento manual de SKUs legados — phase futura
- Mapeamento de imagens via URL na master — phase futura
- Suporte a múltiplas imagens por produto — phase futura se virar requisito
- Compatibility view `produtos` apontando pra `product_variants` — Claude decide na execução
