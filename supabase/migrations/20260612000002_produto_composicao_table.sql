-- Migration: tabela produto_composicao — base de sugestoes SKU<->SKU de sistemas compostos (Phase 19 / Plan 03 / D-06)
-- Comeca VAZIA. Populada incrementalmente depois (admin/CSV). NUNCA um ponto de falha do fluxo:
--   as regras de conector obrigatorio por FAMILIA vivem no codigo (REGRAS_COMPOSICAO em src/types/orcamento.ts, D-07).
--   Esta tabela e reservada para sugestoes SKU<->SKU de modulos/acessorios compativeis.
-- Aditiva. RLS: leitura para authenticated, escrita so admin (has_role).
-- Padrao has_role cast: 'admin'::app_role (replicado de 20260515000001_aniversario_envios_table.sql).

BEGIN;

CREATE TABLE public.produto_composicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pai_codigo TEXT NOT NULL REFERENCES public.product_variants(codigo),
  filho_codigo TEXT NOT NULL REFERENCES public.product_variants(codigo),
  papel TEXT NOT NULL CHECK (papel IN (
    'modulo', 'driver_recomendado', 'driver_obrigatorio',
    'conector_energia', 'kit_fixacao', 'acessorio_opcional'
  )),
  ordem INTEGER NOT NULL DEFAULT 0,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pai_codigo, filho_codigo, papel)
);

CREATE INDEX idx_composicao_pai ON public.produto_composicao(pai_codigo);
CREATE INDEX idx_composicao_filho ON public.produto_composicao(filho_codigo);

COMMENT ON TABLE public.produto_composicao IS
  'Phase 19 D-06/D-07: sugestoes SKU<->SKU de componentes compativeis (pai->filho com papel). Comeca vazia. Regras de familia obrigatoria NAO vivem aqui (vivem em REGRAS_COMPOSICAO no codigo).';

-- ===== RLS: leitura authenticated, escrita so admin =====

ALTER TABLE public.produto_composicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read composicao"
  ON public.produto_composicao
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin write composicao"
  ON public.produto_composicao
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON POLICY "read composicao" ON public.produto_composicao IS
  'Phase 19 D-06: qualquer usuario autenticado le as sugestoes de composicao (dados de catalogo).';
COMMENT ON POLICY "admin write composicao" ON public.produto_composicao IS
  'Phase 19 D-06: INSERT/UPDATE/DELETE so para admin (has_role). Service role bypass RLS naturalmente.';

COMMIT;
