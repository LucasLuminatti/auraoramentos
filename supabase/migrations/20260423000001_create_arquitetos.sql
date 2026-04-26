-- Entidade nova: arquiteto. Cliente origina do arquiteto; produto pode ser "do arquiteto X".
-- Refs: REQUIREMENTS ARQ-01, PROJECT.md "Arquiteto = entidade propria com FK".

CREATE TABLE public.arquitetos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  contato TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.arquitetos ENABLE ROW LEVEL SECURITY;

-- Leitura aberta a qualquer autenticado (consistente com clientes/produtos atuais).
CREATE POLICY "Anyone can read arquitetos"
  ON public.arquitetos FOR SELECT
  USING (true);

-- Escrita restrita a admin (mais estrito que clientes/colaboradores — nova entidade,
-- comecamos com a security certa desde o dia 1; CRUD fica em Fase 2).
CREATE POLICY "Admins can manage arquitetos"
  ON public.arquitetos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index para busca por nome (autocomplete/CRUD admin em Fase 2; volume baixo, btree serve).
CREATE INDEX idx_arquitetos_nome ON public.arquitetos (nome);

COMMENT ON TABLE public.arquitetos IS 'Arquitetos que originam projetos. Cliente e produto podem ter arquiteto_id (nullable, ON DELETE SET NULL).';
