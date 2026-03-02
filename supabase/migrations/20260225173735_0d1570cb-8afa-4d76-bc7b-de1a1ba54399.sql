
-- Tabela de exceções de preço
CREATE TABLE public.price_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  orcamento_id uuid,
  projeto_id uuid REFERENCES public.projetos(id),
  solicitante_id uuid NOT NULL,
  produto_codigo text NOT NULL,
  produto_descricao text NOT NULL,
  preco_solicitado numeric NOT NULL,
  preco_minimo numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  resolvido_por uuid,
  resolvido_at timestamptz
);

ALTER TABLE public.price_exceptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all exceptions
CREATE POLICY "Authenticated users can read exceptions"
ON public.price_exceptions FOR SELECT TO authenticated
USING (true);

-- Authenticated users can create exceptions
CREATE POLICY "Authenticated users can create exceptions"
ON public.price_exceptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = solicitante_id);

-- Only admins can update exception status
CREATE POLICY "Admins can update exceptions"
ON public.price_exceptions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de mensagens do chat de exceção
CREATE TABLE public.exception_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  exception_id uuid NOT NULL REFERENCES public.price_exceptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  content text NOT NULL
);

ALTER TABLE public.exception_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read messages
CREATE POLICY "Authenticated users can read messages"
ON public.exception_messages FOR SELECT TO authenticated
USING (true);

-- Authenticated users can send messages
CREATE POLICY "Authenticated users can send messages"
ON public.exception_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.exception_messages, public.price_exceptions;
