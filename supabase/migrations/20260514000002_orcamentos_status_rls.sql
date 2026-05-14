-- Phase 10 / WIZ-04 (D-15, D-16): RLS UPDATE em orcamentos
--
-- Substitui a policy permissiva atual ("Authenticated users can update orcamentos"
-- USING (true)) por policies que:
--   1. Restringem UPDATE ao colaborador dono OU admin (has_role)
--   2. Bloqueiam server-side qualquer UPDATE em rows onde status='aprovado'
--      (camada de defesa para o invariante one-way de WIZ-04)
--
-- SELECT continua aberto (USING (true)) -- fora de escopo Phase 10 (D-32).
-- Padrao replicado de supabase/migrations/20260514000001_arquitetos_clientes_rls.sql

BEGIN;

-- Drop policy permissiva legada (se existir com qualquer um dos nomes possiveis)
DROP POLICY IF EXISTS "Authenticated users can update orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Colab can update own orcamentos non-aprovado" ON public.orcamentos;
DROP POLICY IF EXISTS "Admin can update orcamentos non-aprovado" ON public.orcamentos;

-- Policy: colab dono pode atualizar seus orcamentos, mas nao pode alterar rows ja aprovadas
CREATE POLICY "Colab can update own orcamentos non-aprovado"
  ON public.orcamentos
  FOR UPDATE
  TO authenticated
  USING (
    colaborador_id = (SELECT id FROM public.colaboradores WHERE user_id = auth.uid())
    AND status != 'aprovado'
  )
  WITH CHECK (
    status IN ('rascunho', 'aprovado', 'perdido', 'pendente')
  );

COMMENT ON POLICY "Colab can update own orcamentos non-aprovado" ON public.orcamentos IS
  'Phase 10 / WIZ-04 D-15 + D-16: colab dono pode atualizar seus orcamentos (incluindo marcar como aprovado), mas nao pode alterar row ja aprovada (one-way irreversivel).';

-- Policy: admin pode atualizar qualquer orcamento, mas tambem nao pode alterar rows ja aprovadas
CREATE POLICY "Admin can update orcamentos non-aprovado"
  ON public.orcamentos
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND status != 'aprovado'
  )
  WITH CHECK (
    status IN ('rascunho', 'aprovado', 'perdido', 'pendente')
  );

COMMENT ON POLICY "Admin can update orcamentos non-aprovado" ON public.orcamentos IS
  'Phase 10 / WIZ-04 D-15 + D-16: admin pode atualizar qualquer orcamento, mas tambem nao pode alterar row ja aprovada (one-way irreversivel mesmo para admin).';

COMMIT;
