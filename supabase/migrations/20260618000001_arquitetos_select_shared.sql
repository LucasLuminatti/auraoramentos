-- Feature 4: arquitetos com leitura compartilhada entre todos os colaboradores.
-- Mudança de direção em relação à Phase 9 (RLS-02): antes cada colab só lia os
-- próprios arquitetos; agora qualquer colaborador autenticado pode VER e USAR
-- qualquer arquiteto (para atrelar ao seu cliente/projeto). Editar/excluir
-- continua restrito ao dono (user_id) ou admin — INSERT/UPDATE/DELETE inalterados.
--
-- Decisão Lenny (2026-06-18): "todo mundo consegue ver os arquitetos de todo mundo;
-- a outra colaboradora pode usar o mesmo arquiteto se já existir na base".
-- Clientes permanecem isolados por colaborador (sem alteração).

BEGIN;

-- Substitui a policy de SELECT restrita por leitura aberta a qualquer autenticado.
DROP POLICY IF EXISTS "Colabs read own arquitetos, admins read all" ON public.arquitetos;

CREATE POLICY "Authenticated read all arquitetos"
  ON public.arquitetos FOR SELECT TO authenticated
  USING (true);

COMMENT ON POLICY "Authenticated read all arquitetos" ON public.arquitetos IS
  'Feature 4 (2026-06-18): arquitetos sao um cadastro compartilhado. Qualquer colaborador autenticado le todos os arquitetos para reutilizar em clientes/orcamentos. Editar/excluir continua restrito ao dono (user_id) ou admin via as policies de UPDATE/DELETE.';

COMMIT;
