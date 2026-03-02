
-- Create table for client file attachments
CREATE TABLE public.cliente_arquivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral',
  arquivo_path TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  tamanho INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cliente_arquivos ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can read cliente_arquivos"
ON public.cliente_arquivos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert cliente_arquivos"
ON public.cliente_arquivos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cliente_arquivos"
ON public.cliente_arquivos FOR DELETE
TO authenticated
USING (true);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('cliente-arquivos', 'cliente-arquivos', true);

-- Storage policies
CREATE POLICY "Public can read cliente-arquivos"
ON storage.objects FOR SELECT
USING (bucket_id = 'cliente-arquivos');

CREATE POLICY "Authenticated users can upload cliente-arquivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cliente-arquivos');

CREATE POLICY "Authenticated users can delete cliente-arquivos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'cliente-arquivos');
