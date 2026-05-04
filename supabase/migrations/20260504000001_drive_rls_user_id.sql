-- Phase 4 / Plan 01: RLS por user_id em cliente_arquivos + arquivo_pastas + bucket privado
-- Refs: D-02 (errata: user_id em vez de colaborador_id), D-03 (RLS direta com auth.uid()),
--       D-04 (backfill admin mais antigo), D-06 (bucket privado), D-09 (errata: storage policy via tabela)
-- Estratégia B do RESEARCH: storage policies delegam acesso à tabela cliente_arquivos.

BEGIN;

-- =========================================================================
-- Bloco 1 — Pre-flight assert (Pitfall 6 do RESEARCH)
-- Garante que existe pelo menos 1 admin com colaborador, senão backfill estoura NOT NULL
-- =========================================================================
DO $$
DECLARE admin_count int;
BEGIN
  SELECT count(*) INTO admin_count
    FROM public.user_roles ur
    INNER JOIN public.colaboradores c ON c.user_id = ur.user_id
    WHERE ur.role = 'admin';
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'Migration aborted: no admin user found (Pitfall 6 — backfill needs at least one admin in user_roles + colaboradores)';
  END IF;
END $$;

-- =========================================================================
-- Bloco 2 — ADD COLUMN user_id (nullable inicialmente)
-- ON DELETE SET NULL (D-05 — não cascade; arquivos órfãos viram nulos)
-- =========================================================================
ALTER TABLE public.cliente_arquivos
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.arquivo_pastas
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_cliente_arquivos_user_id ON public.cliente_arquivos(user_id);
CREATE INDEX idx_arquivo_pastas_user_id ON public.arquivo_pastas(user_id);

COMMENT ON COLUMN public.cliente_arquivos.user_id IS
  'auth.users.id do colaborador dono do arquivo. RLS direta: user_id = auth.uid() OR has_role(...,admin). Phase 4 D-02 errata.';
COMMENT ON COLUMN public.arquivo_pastas.user_id IS
  'auth.users.id do colaborador dono da pasta. Phase 4 D-02 errata.';

-- =========================================================================
-- Bloco 3 — Backfill: legados → admin mais antigo (D-04)
-- A1 do RESEARCH: ORDER BY created_at ASC LIMIT 1 garante determinismo se múltiplos admins
-- =========================================================================
WITH admin_user AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  INNER JOIN public.colaboradores c ON c.user_id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY c.created_at ASC
  LIMIT 1
)
UPDATE public.cliente_arquivos
   SET user_id = (SELECT user_id FROM admin_user)
 WHERE user_id IS NULL;

WITH admin_user AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  INNER JOIN public.colaboradores c ON c.user_id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY c.created_at ASC
  LIMIT 1
)
UPDATE public.arquivo_pastas
   SET user_id = (SELECT user_id FROM admin_user)
 WHERE user_id IS NULL;

-- =========================================================================
-- Bloco 4 — NOT NULL após backfill
-- =========================================================================
ALTER TABLE public.cliente_arquivos ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.arquivo_pastas    ALTER COLUMN user_id SET NOT NULL;

-- =========================================================================
-- Bloco 5 — RLS em cliente_arquivos (D-03)
-- Drop policies legadas abertas (USING true) e criar novas direta com auth.uid()
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can read cliente_arquivos" ON public.cliente_arquivos;
DROP POLICY IF EXISTS "Authenticated users can insert cliente_arquivos" ON public.cliente_arquivos;
DROP POLICY IF EXISTS "Authenticated users can update cliente_arquivos" ON public.cliente_arquivos;
DROP POLICY IF EXISTS "Authenticated users can delete cliente_arquivos" ON public.cliente_arquivos;

ALTER TABLE public.cliente_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colabs read own arquivos, admins read all"
  ON public.cliente_arquivos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs insert own arquivos"
  ON public.cliente_arquivos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Colabs update own arquivos, admins update all"
  ON public.cliente_arquivos FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs delete own arquivos, admins delete all"
  ON public.cliente_arquivos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- Bloco 6 — RLS em arquivo_pastas (mesmo pattern)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can read arquivo_pastas" ON public.arquivo_pastas;
DROP POLICY IF EXISTS "Authenticated users can insert arquivo_pastas" ON public.arquivo_pastas;
DROP POLICY IF EXISTS "Authenticated users can update arquivo_pastas" ON public.arquivo_pastas;
DROP POLICY IF EXISTS "Authenticated users can delete arquivo_pastas" ON public.arquivo_pastas;

ALTER TABLE public.arquivo_pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colabs read own pastas, admins read all"
  ON public.arquivo_pastas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs insert own pastas"
  ON public.arquivo_pastas FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Colabs update own pastas, admins update all"
  ON public.arquivo_pastas FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs delete own pastas, admins delete all"
  ON public.arquivo_pastas FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- Bloco 7 — Bucket privado (D-06)
-- =========================================================================
UPDATE storage.buckets SET public = false WHERE id = 'cliente-arquivos';

-- =========================================================================
-- Bloco 8 — Storage policies (D-09 errata: via tabela cliente_arquivos, NÃO path-prefix)
-- Pitfall 3 evitado: sem path-prefix, legados continuam acessíveis via tabela RLS
-- =========================================================================

-- Drop policies abertas/antigas do bucket cliente-arquivos
-- Nomes da migration original 20260302192445:
DROP POLICY IF EXISTS "Public can read cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete cliente-arquivos" ON storage.objects;
-- Variantes possíveis (idempotência):
DROP POLICY IF EXISTS "Public can view cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- SELECT (download via signed URL): permitido se há registro em cliente_arquivos com path == name
-- e o caller é dono OU admin. createSignedUrl chama com bearer do usuário, então auth.uid() funciona.
CREATE POLICY "Read cliente-arquivos via cliente_arquivos table"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cliente-arquivos'
    AND EXISTS (
      SELECT 1 FROM public.cliente_arquivos ca
      WHERE ca.arquivo_path = storage.objects.name
        AND (ca.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- INSERT: qualquer authenticated pode subir blob; consistência (user_id no row da tabela)
-- é garantida pelo INSERT da app que roda na MESMA transação lógica.
CREATE POLICY "Authenticated upload cliente-arquivos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cliente-arquivos');

-- DELETE: dono ou admin via tabela cliente_arquivos
CREATE POLICY "Delete cliente-arquivos via cliente_arquivos table"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cliente-arquivos'
    AND EXISTS (
      SELECT 1 FROM public.cliente_arquivos ca
      WHERE ca.arquivo_path = storage.objects.name
        AND (ca.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

COMMIT;
