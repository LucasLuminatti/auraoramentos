-- Phase 7 / Plan 01: ADD COLUMN user_id em arquitetos + clientes (RLS-03)
-- Refs: D-01 (FK ON DELETE RESTRICT — divergência Drive D-05 que usou SET NULL),
--       D-02 (backfill admin mais antigo — pattern Drive D-04),
--       D-03 (NOT NULL após backfill), D-04 (index BTREE),
--       D-05 (COMMENT citando fase + decisão),
--       D-06 (NÃO criar RLS policies — Phase 9 cuida disso).
--
-- IMPORTANTE: Esta migration NÃO mexe em policies. As policies "Anyone can read"
-- (clientes/arquitetos) e "Admins can manage arquitetos" permanecem inalteradas.
-- Phase 9 (RLS-01/RLS-02) vai trocar as policies para `user_id = auth.uid() OR has_role(admin)`.

BEGIN;

-- =========================================================================
-- Bloco 1 — Pre-flight assert (Drive Pitfall 6)
-- Aborta migration se não existir admin com colaborador. Backfill precisa de pelo menos 1.
-- =========================================================================
DO $$
DECLARE admin_count int;
BEGIN
  SELECT count(*) INTO admin_count
    FROM public.user_roles ur
    INNER JOIN public.colaboradores c ON c.user_id = ur.user_id
    WHERE ur.role = 'admin';
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'Migration aborted: no admin user found (Drive Pitfall 6 — backfill needs at least one admin in user_roles + colaboradores)';
  END IF;
END $$;

-- =========================================================================
-- Bloco 2 — ADD COLUMN user_id (nullable inicialmente)
-- D-01: ON DELETE RESTRICT (não SET NULL como Drive). Cliente/arquiteto carrega histórico
-- de orçamentos; bloquear delete do auth.user até admin reassignar manualmente.
-- =========================================================================
ALTER TABLE public.arquitetos
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.clientes
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX idx_arquitetos_user_id ON public.arquitetos(user_id);
CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);

COMMENT ON COLUMN public.arquitetos.user_id IS
  'auth.users.id do colaborador dono do arquiteto. Phase 7 RLS-03 / pattern Drive D-02 errata. Phase 9 cria policies USING (user_id = auth.uid() OR has_role admin).';
COMMENT ON COLUMN public.clientes.user_id IS
  'auth.users.id do colaborador dono do cliente. Phase 7 RLS-03 / pattern Drive D-02 errata. Phase 9 cria policies USING (user_id = auth.uid() OR has_role admin).';

-- =========================================================================
-- Bloco 3 — Backfill: legados → admin mais antigo (D-02 / Drive D-04)
-- ORDER BY created_at ASC LIMIT 1 garante determinismo se múltiplos admins existirem.
-- =========================================================================
WITH admin_user AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  INNER JOIN public.colaboradores c ON c.user_id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY c.created_at ASC
  LIMIT 1
)
UPDATE public.arquitetos
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
UPDATE public.clientes
   SET user_id = (SELECT user_id FROM admin_user)
 WHERE user_id IS NULL;

-- =========================================================================
-- Bloco 4 — NOT NULL após backfill (D-03)
-- =========================================================================
ALTER TABLE public.arquitetos ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.clientes   ALTER COLUMN user_id SET NOT NULL;

-- NOTA: Sem RLS policies aqui (D-06). Phase 9 (RLS-01/RLS-02) cuida disso.
--       As policies atuais "Anyone can read" continuam ativas e não são afetadas.

COMMIT;
