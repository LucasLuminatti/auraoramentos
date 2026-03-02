
-- Criar bucket público para imagens de produtos
INSERT INTO storage.buckets (id, name, public) VALUES ('produto-imagens', 'produto-imagens', true);

-- RLS: leitura pública
CREATE POLICY "Public read produto-imagens" ON storage.objects FOR SELECT USING (bucket_id = 'produto-imagens');

-- RLS: upload autenticado
CREATE POLICY "Auth upload produto-imagens" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'produto-imagens' AND auth.role() = 'authenticated');

-- RLS: update autenticado
CREATE POLICY "Auth update produto-imagens" ON storage.objects FOR UPDATE USING (bucket_id = 'produto-imagens' AND auth.role() = 'authenticated');

-- RLS: delete autenticado
CREATE POLICY "Auth delete produto-imagens" ON storage.objects FOR DELETE USING (bucket_id = 'produto-imagens' AND auth.role() = 'authenticated');

-- Adicionar coluna imagem_url na tabela produtos
ALTER TABLE public.produtos ADD COLUMN imagem_url text;

-- Política de UPDATE para produtos (autenticados podem atualizar imagem_url)
CREATE POLICY "Authenticated users can update produtos" ON public.produtos FOR UPDATE USING (auth.role() = 'authenticated');
