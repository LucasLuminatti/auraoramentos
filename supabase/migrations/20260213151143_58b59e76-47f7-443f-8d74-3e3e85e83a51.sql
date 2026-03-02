
-- Políticas de escrita para clientes
CREATE POLICY "Anyone can insert clientes" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clientes" ON public.clientes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete clientes" ON public.clientes FOR DELETE USING (true);

-- Políticas de escrita para colaboradores
CREATE POLICY "Anyone can insert colaboradores" ON public.colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update colaboradores" ON public.colaboradores FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete colaboradores" ON public.colaboradores FOR DELETE USING (true);

-- Políticas de escrita para orcamentos
CREATE POLICY "Anyone can insert orcamentos" ON public.orcamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update orcamentos" ON public.orcamentos FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete orcamentos" ON public.orcamentos FOR DELETE USING (true);
