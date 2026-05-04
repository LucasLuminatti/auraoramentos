-- Phase 3 / Plan 01: cria tabelas products + product_variants (rename de produtos)
-- Estratégia: ALTER TABLE produtos RENAME TO product_variants preserva TODAS as FKs
-- (vinculos_spot_lampada.codigo_spot/codigo_lampada continuam válidas — só o nome da
--  tabela base muda; o constraint move com ela). View `produtos` recriada para backward-compat.
-- Refs: D-01, D-02, D-03, D-04 (CONTEXT.md Phase 3) + Pattern 1 (RESEARCH.md)

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

COMMENT ON TABLE public.products IS 'Produto pai (master 2026 + dummy P-LEGADO + AU coringa). Phase 3.';

-- 2. Cria pai dummy P-LEGADO (D-04: recebe FK de TODOS os SKUs legados)
INSERT INTO public.products (codigo_pai, nome, categoria, tipologia)
  VALUES ('P-LEGADO', 'Produtos Legados', NULL, NULL);

-- 3. Renomeia produtos -> product_variants (preserva TODAS as FKs externas e UUIDs)
ALTER TABLE public.produtos RENAME TO product_variants;

-- 4. Adiciona colunas novas em product_variants
ALTER TABLE public.product_variants
  ADD COLUMN product_id UUID REFERENCES public.products(id),
  ADD COLUMN origem TEXT NOT NULL DEFAULT 'legado'
    CHECK (origem IN ('master', 'legado', 'coringa', 'manual')),
  ADD COLUMN editado_manualmente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN nome TEXT;

-- 5. Backfill: vincula TODOS os SKUs existentes a P-LEGADO (D-04 / D-06)
UPDATE public.product_variants
  SET product_id = (SELECT id FROM public.products WHERE codigo_pai = 'P-LEGADO');

-- 6. NOT NULL após backfill
ALTER TABLE public.product_variants
  ALTER COLUMN product_id SET NOT NULL;

CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_origem ON public.product_variants(origem);
CREATE INDEX idx_product_variants_editado ON public.product_variants(editado_manualmente);

COMMENT ON TABLE public.product_variants IS 'SKU. FK para products. Phase 3 (renomeada de produtos). Não DROP/RECREATE — preserva UUIDs e FKs externas.';
COMMENT ON COLUMN public.product_variants.origem IS 'master=veio da planilha base; legado=já estava no DB sem master; coringa=AU001..16; manual=criado pelo admin via UI';
COMMENT ON COLUMN public.product_variants.editado_manualmente IS 'Setado TRUE quando admin edita via ProdutoEditDialog (D-08). Master subsequente respeita (D-05).';
COMMENT ON COLUMN public.product_variants.atributos IS 'Specs variáveis da master (Lumens, IRC, Material, Cabo, Dimensao, etc.) — D-02';
COMMENT ON COLUMN public.product_variants.nome IS 'Nome da variante (ex: "VISION 5W"). Diferente de products.nome (família, ex: "Arandela VISION").';

-- 7. RLS em products (replica padrão de produtos antigo)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read products"
  ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. RLS em product_variants (RLS já estava em produtos; reaplicar policies usando o novo nome)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Drop possíveis policies antigas com o nome de "produtos" (se existirem) e recriar
DROP POLICY IF EXISTS "Anyone authenticated can read produtos" ON public.product_variants;
DROP POLICY IF EXISTS "Admins manage produtos" ON public.product_variants;

CREATE POLICY "Anyone authenticated can read product_variants"
  ON public.product_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage product_variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9. View de compatibilidade `produtos` (backward-compat — D-03 + Pattern 1 RESEARCH)
-- Expõe MESMAS colunas que a tabela antiga tinha. Leitura idêntica.
-- WRITES (UPDATE/INSERT/DELETE) NÃO funcionam direto na view — devem ir para product_variants.
-- Plans 03 e 04 migram os 3 writes existentes (ProdutoEditDialog, ImportImagens, edge fn).
CREATE VIEW public.produtos AS
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
    pv.created_at
  FROM public.product_variants pv;

COMMENT ON VIEW public.produtos IS 'View de compatibilidade backward-compat. Lê de product_variants. Não use para INSERT/UPDATE/DELETE — vá direto em product_variants.';

-- 10. Permitir leitura da view ao role authenticated (views herdam permissions da base + grants)
GRANT SELECT ON public.produtos TO authenticated;
GRANT SELECT ON public.produtos TO anon;

COMMIT;
