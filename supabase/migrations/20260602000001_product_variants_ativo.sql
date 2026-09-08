-- Migration: coluna `ativo` em product_variants (soft-delete) + recriação da view `produtos`.
-- Motivo: conferência de catálogo 2026 marcou 102 SKUs legado como "Remover" (descontinuados).
-- Em vez de DELETE (irreversível, perde preço/histórico), marcamos ativo=false e o seletor
-- de produtos (useProdutoSearch → view `produtos`) passa a filtrar WHERE ativo.
-- Aditiva e reversível — segue a constraint de schema do projeto. Admin continua vendo tudo
-- (Admin.tsx lê product_variants direto, sem filtro de ativo).

BEGIN;

-- 1. Coluna ativo (default true — nada muda para os SKUs existentes)
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_product_variants_ativo ON public.product_variants (ativo);

COMMENT ON COLUMN public.product_variants.ativo IS
  'false = descontinuado (não aparece no seletor de produtos do orçamento). Soft-delete reversível. Admin ainda enxerga.';

-- 2. Recria a view `produtos` expondo `ativo` (CREATE OR REPLACE: colunas novas só no final)
CREATE OR REPLACE VIEW public.produtos AS
  SELECT
    pv.id,
    pv.codigo,
    pv.descricao,
    pv.preco_tabela,
    pv.preco_minimo,
    pv.imagem_url,
    pv.tensao,
    pv.watts_por_metro,
    pv.largura_mm,
    pv.tipo_produto,
    pv.subtipo,
    pv.sistema,
    pv.familia_perfil,
    pv.passadas_padrao,
    pv.largura_canal_mm,
    pv.driver_max_watts,
    pv.driver_tipo_permitido,
    pv.somente_baby,
    pv.tamanho_rolo_m,
    pv.fator_spot,
    pv.potencia_watts,
    pv.cor,
    pv.aplicacao,
    pv.arquiteto_id,
    pv.created_at,
    pv.ativo
  FROM public.product_variants pv;

GRANT SELECT ON public.produtos TO authenticated;

COMMIT;
