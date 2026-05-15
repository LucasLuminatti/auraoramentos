-- Phase 12 / Plan 01 — Tabela log de envios de aniversário (AUTO-01/AUTO-02)
-- Refs: CONTEXT D-02 (UNIQUE cliente_id+ano), D-05 (multi-admin via has_role),
--       D-06 (skipped_no_owner), D-09 (failed sem retry)
-- Padrão has_role cast: 'admin'::app_role (replicado de 20260514000002_orcamentos_status_rls.sql)

BEGIN;

-- ===== Tabela log =====

CREATE TABLE public.aniversario_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ano_referencia INT NOT NULL,
  destinatarios JSONB NOT NULL,  -- {colab_email: string|null, admin_emails: string[]}
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_no_owner')),
  error_msg TEXT NULL,
  UNIQUE (cliente_id, ano_referencia)
);

CREATE INDEX idx_aniversario_envios_cliente ON public.aniversario_envios(cliente_id);
CREATE INDEX idx_aniversario_envios_status_failed ON public.aniversario_envios(status) WHERE status = 'failed';

COMMENT ON TABLE public.aniversario_envios IS
  'Log de envios de email de aniversário (Phase 12). UNIQUE(cliente_id, ano_referencia) garante 1 envio/ano. Status sent|failed|skipped_no_owner.';

-- ===== RLS: admin SELECT-only, service role bypass =====

ALTER TABLE public.aniversario_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read aniversario_envios"
  ON public.aniversario_envios
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON POLICY "Admins can read aniversario_envios" ON public.aniversario_envios IS
  'Phase 12 D-02: admin (has_role) lê tudo pra auditoria; colab não acessa direto. Service role bypass RLS naturalmente (edge fn escreve).';

-- Nenhuma policy INSERT/UPDATE/DELETE pra authenticated — só service role escreve.

-- ===== Stored function: buscar aniversariantes D-5 =====
-- Cobre edge case 29/02 em ano não-bissexto (D-08) e cliente órfão LEFT JOIN (D-06)
-- Filtra clientes já notificados (NOT IN aniversario_envios pro ano_referencia)

CREATE OR REPLACE FUNCTION public.buscar_aniversariantes_d5()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  data_nascimento DATE,
  contato TEXT,
  user_id UUID,
  colab_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT (CURRENT_DATE + INTERVAL '5 days')::date AS d
  ),
  ja_notificados AS (
    SELECT cliente_id
    FROM public.aniversario_envios
    WHERE ano_referencia = EXTRACT(YEAR FROM (SELECT d FROM target))::int
  )
  SELECT
    c.id,
    c.nome,
    c.data_nascimento,
    c.contato,
    c.user_id,
    u.email::text AS colab_email
  FROM public.clientes c
  CROSS JOIN target t
  LEFT JOIN auth.users u ON u.id = c.user_id
  WHERE c.data_nascimento IS NOT NULL
    AND c.id NOT IN (SELECT cliente_id FROM ja_notificados)
    AND (
      -- Caso comum: mês/dia bate exato
      (EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM t.d)
       AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM t.d))
      OR
      -- Caso 29/02 em ano não-bissexto: target = 28/02 e amanhã (1/3) confirma não-bissexto
      (EXTRACT(MONTH FROM c.data_nascimento) = 2
       AND EXTRACT(DAY FROM c.data_nascimento) = 29
       AND EXTRACT(MONTH FROM t.d) = 2
       AND EXTRACT(DAY FROM t.d) = 28
       AND EXTRACT(MONTH FROM (t.d + INTERVAL '1 day')) = 3)
    );
$$;

COMMENT ON FUNCTION public.buscar_aniversariantes_d5() IS
  'Phase 12 D-07/D-08: clientes que fazem aniversário em today+5d, com email do colab dono via JOIN auth.users. Cobre 29/02 em ano não-bissexto (dispara em 28/02). Filtra já notificados via UNIQUE(cliente_id, ano_referencia).';

REVOKE EXECUTE ON FUNCTION public.buscar_aniversariantes_d5() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.buscar_aniversariantes_d5() FROM authenticated;

-- ===== Stored function: buscar emails de admins =====
-- Evita N+1 via supabase.auth.admin.getUserById no edge function

CREATE OR REPLACE FUNCTION public.buscar_admins_emails()
RETURNS TABLE (email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'admin'::app_role
    AND u.email IS NOT NULL
    AND length(trim(u.email)) > 0;
$$;

COMMENT ON FUNCTION public.buscar_admins_emails() IS
  'Phase 12 D-05: lista emails de admins do sistema (multi-admin via has_role). Substitui hardcode de ADMIN_EMAIL — divergência consciente do REQ AUTO-02.';

REVOKE EXECUTE ON FUNCTION public.buscar_admins_emails() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.buscar_admins_emails() FROM authenticated;

COMMIT;
