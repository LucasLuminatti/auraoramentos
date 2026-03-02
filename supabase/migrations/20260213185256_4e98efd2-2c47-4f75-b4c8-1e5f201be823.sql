
-- Create projetos table
CREATE TABLE public.projetos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read projetos" ON public.projetos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert projetos" ON public.projetos FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update projetos" ON public.projetos FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete projetos" ON public.projetos FOR DELETE USING (true);

-- Add projeto_id to orcamentos (nullable for existing rows)
ALTER TABLE public.orcamentos ADD COLUMN projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE;
