-- Produtos ganham vinculo com arquiteto (nullable).
-- Ref: REQUIREMENTS ARQ-04. ARQ-05 (orcamentos via cliente) nao precisa schema change.

ALTER TABLE public.produtos
  ADD COLUMN arquiteto_id UUID REFERENCES public.arquitetos(id) ON DELETE SET NULL;

CREATE INDEX idx_produtos_arquiteto_id ON public.produtos (arquiteto_id);

COMMENT ON COLUMN public.produtos.arquiteto_id IS 'Arquiteto dono do produto (ex: linha exclusiva). Nullable. ON DELETE SET NULL. Backfill manual via admin (PROD-03, Fase 2).';
