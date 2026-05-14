-- Phase 9: Multi-tenancy RLS em arquitetos + clientes (RLS-01, RLS-02)
-- Refs:
--   D-01: pattern Drive Blocos 5+6 (supabase/migrations/20260504000001_drive_rls_user_id.sql) replicado 1:1
--   D-02: drop das policies legadas "Anyone can read", "Admins can manage", "Authenticated users can ..."
--   D-03: RLS ja enabled em ambas (Phase 7); ENABLE ROW LEVEL SECURITY mantido idempotente
--   D-04: ALTER COLUMN user_id SET DEFAULT auth.uid() em ambas (defesa contra regressao Phase 7)
--   D-05: WITH CHECK strict no INSERT (user_id = auth.uid()) -- defesa em camadas
--   D-06: admin NAO pode criar arquiteto/cliente em nome de outro colab (replica Drive)
--   D-07: migration UNICA, BEGIN/COMMIT atomico
-- Phase 7 ref: migration 20260511000001_arquitetos_clientes_user_id.sql ja adicionou user_id NOT NULL + FK RESTRICT + index.
-- Phase 8 ref: commit 71d28d7 (08-05) ja injeta user_id no payload do dialog; vira redundancia segura apos D-04.
-- PRE-PUSH snapshot (09-02): 2 policies em arquitetos + 4 em clientes confirmadas via pg_policies 2026-05-14.
--   Zero divergencias com D-02 -- 6 DROPs exatos.

BEGIN;

-- =========================================================================
-- Bloco 1 -- DEFAULT auth.uid() em user_id (D-04)
-- Cinto-e-suspensorios: callers que esquecerem user_id no payload pegam o uid de quem esta logado.
-- =========================================================================
ALTER TABLE public.arquitetos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.clientes   ALTER COLUMN user_id SET DEFAULT auth.uid();

-- =========================================================================
-- Bloco 2 -- DROP das policies legadas (D-02)
-- Nomes confirmados via snapshot PRE-PUSH (09-02 / 09-PUSH-LOG.md).
-- IF EXISTS garante idempotencia.
-- =========================================================================

-- arquitetos (2 drops confirmados)
DROP POLICY IF EXISTS "Anyone can read arquitetos"    ON public.arquitetos;
DROP POLICY IF EXISTS "Admins can manage arquitetos"  ON public.arquitetos;

-- clientes (4 drops confirmados)
DROP POLICY IF EXISTS "Anyone can read clientes"                    ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can insert clientes"     ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can update clientes"     ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can delete clientes"     ON public.clientes;

-- =========================================================================
-- Bloco 3 -- ENABLE ROW LEVEL SECURITY (D-03, idempotente)
-- RLS ja estava true em ambas (Phase 7) -- este bloco e redundante mas seguro.
-- =========================================================================
ALTER TABLE public.arquitetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes   ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Bloco 4 -- Policies em arquitetos (RLS-02 / pattern Drive Bloco 5 replicado 1:1)
-- =========================================================================
CREATE POLICY "Colabs read own arquitetos, admins read all"
  ON public.arquitetos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs insert own arquitetos"
  ON public.arquitetos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Colabs update own arquitetos, admins update all"
  ON public.arquitetos FOR UPDATE TO authenticated
  USING  (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs delete own arquitetos, admins delete all"
  ON public.arquitetos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

COMMENT ON POLICY "Colabs read own arquitetos, admins read all" ON public.arquitetos IS
  'Phase 9 RLS-02 / padrao Drive D-02. Colab ve so os arquitetos que cadastrou; admin ve tudo via has_role.';
COMMENT ON POLICY "Colabs insert own arquitetos" ON public.arquitetos IS
  'Phase 9 RLS-02 / padrao Drive D-02. WITH CHECK strict: user_id = auth.uid() (admin nao pode criar em nome de outro -- D-06).';
COMMENT ON POLICY "Colabs update own arquitetos, admins update all" ON public.arquitetos IS
  'Phase 9 RLS-02 / padrao Drive D-02. Update permitido para dono ou admin.';
COMMENT ON POLICY "Colabs delete own arquitetos, admins delete all" ON public.arquitetos IS
  'Phase 9 RLS-02 / padrao Drive D-02. Delete permitido para dono ou admin.';

-- =========================================================================
-- Bloco 5 -- Policies em clientes (RLS-01 / pattern Drive Bloco 6 replicado 1:1)
-- =========================================================================
CREATE POLICY "Colabs read own clientes, admins read all"
  ON public.clientes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs insert own clientes"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Colabs update own clientes, admins update all"
  ON public.clientes FOR UPDATE TO authenticated
  USING  (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs delete own clientes, admins delete all"
  ON public.clientes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

COMMENT ON POLICY "Colabs read own clientes, admins read all" ON public.clientes IS
  'Phase 9 RLS-01 / padrao Drive D-02. Colab ve so os clientes que cadastrou; admin ve tudo via has_role.';
COMMENT ON POLICY "Colabs insert own clientes" ON public.clientes IS
  'Phase 9 RLS-01 / padrao Drive D-02. WITH CHECK strict: user_id = auth.uid() (admin nao pode criar em nome de outro -- D-06).';
COMMENT ON POLICY "Colabs update own clientes, admins update all" ON public.clientes IS
  'Phase 9 RLS-01 / padrao Drive D-02. Update permitido para dono ou admin.';
COMMENT ON POLICY "Colabs delete own clientes, admins delete all" ON public.clientes IS
  'Phase 9 RLS-01 / padrao Drive D-02. Delete permitido para dono ou admin.';

COMMIT;
