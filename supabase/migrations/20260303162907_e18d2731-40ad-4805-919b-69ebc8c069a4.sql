
-- Add columns for negotiation closing flow
ALTER TABLE public.orcamentos
  ADD COLUMN fechado_at timestamptz,
  ADD COLUMN motivo_perda text,
  ADD COLUMN motivo_perda_detalhe text;
