
-- Create arquivo_pastas table for folder hierarchy
CREATE TABLE public.arquivo_pastas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  pasta_pai_id UUID REFERENCES public.arquivo_pastas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add projeto_id and pasta_id columns to cliente_arquivos
ALTER TABLE public.cliente_arquivos
  ADD COLUMN projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  ADD COLUMN pasta_id UUID REFERENCES public.arquivo_pastas(id) ON DELETE SET NULL;

-- Enable RLS on arquivo_pastas
ALTER TABLE public.arquivo_pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read arquivo_pastas"
  ON public.arquivo_pastas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert arquivo_pastas"
  ON public.arquivo_pastas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update arquivo_pastas"
  ON public.arquivo_pastas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete arquivo_pastas"
  ON public.arquivo_pastas FOR DELETE TO authenticated USING (true);
