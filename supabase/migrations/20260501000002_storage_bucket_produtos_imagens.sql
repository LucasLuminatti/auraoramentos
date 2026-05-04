-- Phase 3 / Plan 01: cria bucket Supabase Storage 'produtos-imagens' (plural, conforme D-14)
-- Bucket antigo 'produto-imagens' (singular) usado em ImportImagens.tsx:141 NÃO é tocado nesta migration.
-- Plan 04 será responsável por migrar referências e (se houver dados) migrar arquivos via UPDATE em massa
-- de imagem_url usando REPLACE('produto-imagens', 'produtos-imagens'), ou por script de migração de objetos.
-- Refs: D-14, Pattern 3 (RESEARCH), Pitfall 7 (RESEARCH).

BEGIN;

-- 1. Cria bucket público (leitura aberta para PDFs e admin)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('produtos-imagens', 'produtos-imagens', true)
  ON CONFLICT (id) DO NOTHING;

-- 2. Policy: leitura pública (imagens aparecem em PDFs, autocomplete, lista admin)
DROP POLICY IF EXISTS "Anyone can read produtos-imagens" ON storage.objects;
CREATE POLICY "Anyone can read produtos-imagens"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produtos-imagens');

-- 3. Policy: insert/update/delete restrito a role admin
DROP POLICY IF EXISTS "Admins can manage produtos-imagens" ON storage.objects;
CREATE POLICY "Admins can manage produtos-imagens"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'produtos-imagens' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'produtos-imagens' AND public.has_role(auth.uid(), 'admin'));

COMMIT;
