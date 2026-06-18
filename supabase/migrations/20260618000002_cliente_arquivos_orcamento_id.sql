-- Feature 7: anexos vinculados a uma revisão (orçamento) específica.
-- Aditivo: nova coluna opcional orcamento_id. Anexos antigos (cliente/projeto) seguem
-- válidos com orcamento_id NULL. ON DELETE CASCADE: ao excluir um orçamento/revisão,
-- seus anexos somem junto (o registro; o blob no storage é removido pela UI).

BEGIN;

ALTER TABLE public.cliente_arquivos
  ADD COLUMN IF NOT EXISTS orcamento_id uuid
  REFERENCES public.orcamentos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cliente_arquivos_orcamento_id
  ON public.cliente_arquivos(orcamento_id);

COMMENT ON COLUMN public.cliente_arquivos.orcamento_id IS
  'Feature 7 (2026-06-18): anexo vinculado a uma revisão (orçamento) específica. NULL = anexo geral do cliente/projeto (comportamento legado).';

COMMIT;
