
-- Create produtos table
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth needed for product lookup)
CREATE POLICY "Anyone can read produtos"
  ON public.produtos
  FOR SELECT
  USING (true);

-- Create index for search
CREATE INDEX idx_produtos_codigo ON public.produtos (codigo);
CREATE INDEX idx_produtos_descricao ON public.produtos USING GIN (to_tsvector('portuguese', descricao));
