
-- Tabela de solicitações de acesso
CREATE TABLE public.access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  CONSTRAINT access_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT access_requests_email_unique UNIQUE (email)
);

-- Tabela de usuários permitidos
CREATE TABLE public.allowed_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para access_requests: somente service role pode escrever (via edge functions)
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Nenhuma política de leitura pública — somente service role acessa (edge functions usam service role key)

-- RLS para allowed_users: leitura pública (auth page verifica), escrita somente service role
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read allowed_users"
  ON public.allowed_users
  FOR SELECT
  USING (true);
