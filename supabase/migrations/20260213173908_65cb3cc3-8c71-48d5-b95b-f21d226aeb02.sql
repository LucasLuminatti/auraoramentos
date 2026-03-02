
-- Add user_id column to colaboradores table
ALTER TABLE public.colaboradores ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create unique index so each user has only one colaborador
CREATE UNIQUE INDEX idx_colaboradores_user_id ON public.colaboradores(user_id);

-- Update RLS policies for colaboradores to be user-scoped
DROP POLICY IF EXISTS "Anyone can read colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Authenticated users can delete colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Authenticated users can insert colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Authenticated users can update colaboradores" ON public.colaboradores;

CREATE POLICY "Users can read all colaboradores" ON public.colaboradores FOR SELECT USING (true);
CREATE POLICY "Users can insert their own colaborador" ON public.colaboradores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own colaborador" ON public.colaboradores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own colaborador" ON public.colaboradores FOR DELETE USING (auth.uid() = user_id);
