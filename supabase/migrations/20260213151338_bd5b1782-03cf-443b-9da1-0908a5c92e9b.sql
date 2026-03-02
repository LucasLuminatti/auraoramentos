
-- Restringir escrita nas tabelas apenas a usuários autenticados

-- clientes
DROP POLICY "Anyone can insert clientes" ON public.clientes;
DROP POLICY "Anyone can update clientes" ON public.clientes;
DROP POLICY "Anyone can delete clientes" ON public.clientes;

CREATE POLICY "Authenticated users can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (true);

-- colaboradores
DROP POLICY "Anyone can insert colaboradores" ON public.colaboradores;
DROP POLICY "Anyone can update colaboradores" ON public.colaboradores;
DROP POLICY "Anyone can delete colaboradores" ON public.colaboradores;

CREATE POLICY "Authenticated users can insert colaboradores" ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update colaboradores" ON public.colaboradores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete colaboradores" ON public.colaboradores FOR DELETE TO authenticated USING (true);

-- orcamentos
DROP POLICY "Anyone can insert orcamentos" ON public.orcamentos;
DROP POLICY "Anyone can update orcamentos" ON public.orcamentos;
DROP POLICY "Anyone can delete orcamentos" ON public.orcamentos;

CREATE POLICY "Authenticated users can insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (true);
