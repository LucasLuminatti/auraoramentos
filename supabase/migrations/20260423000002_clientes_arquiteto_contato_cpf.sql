-- Clientes ganham: vinculo com arquiteto (nullable), contato e CPF/CNPJ (opcionais).
-- Refs: REQUIREMENTS ARQ-03 (FK), CLI-01 (contato), CLI-02 (CPF/CNPJ).
-- Todas nullable — registros existentes em prod permanecem validos sem alteracao.

ALTER TABLE public.clientes
  ADD COLUMN arquiteto_id UUID REFERENCES public.arquitetos(id) ON DELETE SET NULL,
  ADD COLUMN contato TEXT,
  ADD COLUMN cpf_cnpj TEXT;

CREATE INDEX idx_clientes_arquiteto_id ON public.clientes (arquiteto_id);

COMMENT ON COLUMN public.clientes.arquiteto_id IS 'Arquiteto que originou este cliente. Nullable: cliente avulso e valido. ON DELETE SET NULL.';
COMMENT ON COLUMN public.clientes.contato IS 'Nome/info de contato do cliente (opcional, texto livre).';
COMMENT ON COLUMN public.clientes.cpf_cnpj IS 'CPF ou CNPJ do cliente. Sem validacao semantica neste marco (REQUIREMENTS out-of-scope).';
