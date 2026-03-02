
-- Tabela clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read clientes" ON public.clientes FOR SELECT USING (true);

-- Tabela colaboradores
CREATE TABLE public.colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT,
  departamento TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read colaboradores" ON public.colaboradores FOR SELECT USING (true);

-- Tabela orcamentos
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read orcamentos" ON public.orcamentos FOR SELECT USING (true);
