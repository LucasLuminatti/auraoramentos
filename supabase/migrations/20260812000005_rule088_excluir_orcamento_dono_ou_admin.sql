-- Migration: RULE-088 / CONF-03 — quem pode excluir orçamento
-- Decisão do Lenny (2026-08-12): cada colaborador exclui os orçamentos QUE ELE CRIOU;
-- admin exclui os de qualquer um.
--
-- Estado anterior: "Authenticated users can delete orcamentos" USING (true) — qualquer
-- usuário logado apagava orçamento de qualquer colega, e o CASCADE levava junto os anexos
-- da revisão (cliente_arquivos.orcamento_id ON DELETE CASCADE).
--
-- O dono é `orcamentos.colaborador_id -> colaboradores.user_id` (colaboradores.user_id é
-- único e aponta para auth.users).

DROP POLICY IF EXISTS "Authenticated users can delete orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Anyone can delete orcamentos" ON public.orcamentos;

CREATE POLICY "Owner or admin can delete orcamentos"
  ON public.orcamentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = orcamentos.colaborador_id
        AND c.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

COMMENT ON TABLE public.orcamentos IS
  'Orçamentos/revisões. Exclusão (RULE-088): só o colaborador que criou ou um admin.';
