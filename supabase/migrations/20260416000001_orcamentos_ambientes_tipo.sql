-- Persistência do conteúdo de orçamentos: estrutura dos ambientes + tipo da revisão.
-- Até aqui a tabela só guardava metadados (cliente, colaborador, valor, status),
-- mas o conteúdo (ambientes/sistemas/luminárias) só existia em memória no frontend.

ALTER TABLE public.orcamentos
  ADD COLUMN ambientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tipo text;

COMMENT ON COLUMN public.orcamentos.ambientes IS 'Snapshot dos ambientes no momento da geração do PDF (Ambiente[] serializado).';
COMMENT ON COLUMN public.orcamentos.tipo IS 'Tipo do orçamento: Primeiro Orçamento | Revisão 01..05.';
