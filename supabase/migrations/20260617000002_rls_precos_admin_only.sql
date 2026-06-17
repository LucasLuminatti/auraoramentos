-- Segurança: alteração de preço (e qualquer write em product_variants) deve ser
-- restrita a admin. Existia uma policy permissiva que deixava QUALQUER usuário
-- autenticado dar UPDATE — a trava de admin era só na UI, não no banco.
--
-- Removendo essa policy, sobra apenas "Admins manage product_variants" (ALL com
-- has_role(admin)), que governa o UPDATE. Admin continua editando preço normalmente;
-- colaborador é bloqueado no nível do banco.
--
-- Reversível: para reverter, recriar a policy abaixo.
-- CREATE POLICY "Authenticated users can update produtos" ON public.product_variants
--   FOR UPDATE TO public USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update produtos" ON public.product_variants;
