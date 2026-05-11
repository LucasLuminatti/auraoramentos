# Phase 7 — Audit: product_variants vs descrição rica

**Phase:** 07-schema-prep-v1-1
**Date:** 2026-05-11
**Project:** AURA (Supabase prod `jkewlaezvrbuicmncqbj`)
**Audit type:** read-only — nenhuma mutação aplicada
**Requirement context:** WIZ-05 (Phase 10) consome descrição rica via `product_variants.atributos` JSONB; D-15 mantém em JSONB sem migration adicional; D-16 mede cobertura; D-17 trata gaps como FOLLOW-UP (não bloqueia Phase 7); D-18 exclui `origem='coringa'` (AU001..AU016) e `origem='legado'` do escopo.

## Query executada

```sql
SELECT 'total_masters' AS metric, count(*) AS value
  FROM public.product_variants WHERE origem = 'master'
UNION ALL
SELECT 'masters_com_gaps', count(*)
  FROM public.product_variants
 WHERE origem = 'master'
   AND (atributos->>'temperatura_k' IS NULL
        OR atributos->>'irc' IS NULL
        OR atributos->>'nicho' IS NULL)
UNION ALL
SELECT 'gap_temperatura_k', count(*) FILTER (WHERE atributos->>'temperatura_k' IS NULL)
  FROM public.product_variants WHERE origem = 'master'
UNION ALL
SELECT 'gap_irc', count(*) FILTER (WHERE atributos->>'irc' IS NULL)
  FROM public.product_variants WHERE origem = 'master'
UNION ALL
SELECT 'gap_nicho', count(*) FILTER (WHERE atributos->>'nicho' IS NULL)
  FROM public.product_variants WHERE origem = 'master'
UNION ALL
SELECT 'gap_cor_iluminacao', count(*) FILTER (WHERE atributos->>'cor_iluminacao' IS NULL)
  FROM public.product_variants WHERE origem = 'master'
UNION ALL
SELECT 'count_coringa', count(*) FROM public.product_variants WHERE origem = 'coringa'
UNION ALL
SELECT 'count_legado', count(*) FROM public.product_variants WHERE origem = 'legado';
```

## Resultados

| Métrica | Valor | % de masters |
|---------|-------|--------------|
| `total_masters` (origem = 'master') | **2088** | 100% |
| `masters_com_gaps` (qualquer um dos 3 campos críticos NULL) | **1525** | 73,0% |
| `gap_temperatura_k` | 1252 | 60,0% |
| `gap_irc` | 1468 | 70,3% |
| `gap_nicho` | 823 | 39,4% |
| `gap_cor_iluminacao` | 1189 | 56,9% |
| `count_coringa` (D-18: fora do escopo) | 16 | — |
| `count_legado` (D-18: fora do escopo) | 2871 | — |

## Decisões aplicadas

- **D-15 — descrição rica em JSONB, sem migration:** confirmado. Nenhuma migration nova foi criada nesta phase para campos de descrição rica. Os campos já existem dentro de `product_variants.atributos` JSONB.
- **D-16 — auditoria via SQL:** executada acima, resultado tabelado.
- **D-17 — gaps são FOLLOW-UP, não bloqueiam:** 1525 masters com pelo menos 1 dos 3 campos críticos vazios. **Não bloqueia o fechamento da Phase 7.** Vira FOLLOW-UP-WIZ-05-AUDIT.
- **D-18 — coringa e legado fora do escopo:** confirmado. SKUs `origem='coringa'` (16, faixa AU001..AU016) e `origem='legado'` (2871) **não entram** na auditoria de descrição rica — admin edita coringa via Phase 8 FORM-03; legado é histórico.

## FOLLOW-UPs (não bloqueiam Phase 7)

- **[FOLLOW-UP-WIZ-05-AUDIT]** 1525 masters com gap em ao menos um dos 3 campos críticos (`temperatura_k`, `irc`, `nicho`). Caminhos para fechar:
  1. **Re-importar master via ImportMaster** com XLSX atualizado (camada `mapMasterRow` em `src/lib/productAttributes.ts` já mapeia esses campos para `atributos` JSONB) — preferencial se Lucas tiver planilha completa.
  2. **Edição manual via admin** (Phase 8 FORM-03 cobre coringa; para masters, edição direta no Supabase Studio ou via futura tela admin de produtos).
  3. **Aceitar gap** — Phase 10 WIZ-05 success criteria #5 já trata variant sem dado renderizando só o nome cru. Sem dado = sem descrição rica, mas wizard segue funcionando.

- **[FOLLOW-UP-WIZ-05-PRIORITY]** Priorizar `irc` (70,3% gap) e `temperatura_k` (60,0% gap) — são os mais visíveis na descrição rica do PDF.

## Conclusão

Schema atual de `product_variants.atributos` (JSONB) é suficiente para suportar descrição rica em WIZ-05 (Phase 10). Gaps de conteúdo são problema de **dados**, não de **schema**. **Phase 7 pode fechar sem dependência de novo schema para descrição rica.**

---
*Auditoria executada via Supabase MCP `execute_sql` em 2026-05-11. Read-only, zero mutação.*
